package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"

	vexilv1alpha1 "github.com/vexil-platform/vexil/pkg/apis/v1alpha1"
)

var scheme = runtime.NewScheme()

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	utilruntime.Must(vexilv1alpha1.AddToScheme(scheme))
}

// resolvedFlag is the simplified flag view served to SDKs.
type resolvedFlag struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Value       string `json:"value"`
	Disabled    bool   `json:"disabled"`
	Description string `json:"description,omitempty"`
}

// flagStore is a thread-safe in-memory store of resolved flags.
type flagStore struct {
	mu          sync.RWMutex
	flags       map[string]resolvedFlag
	subMu       sync.Mutex
	subscribers map[chan resolvedFlag]struct{}
}

func newFlagStore() *flagStore {
	return &flagStore{
		flags:       make(map[string]resolvedFlag),
		subscribers: make(map[chan resolvedFlag]struct{}),
	}
}

func (s *flagStore) Set(f resolvedFlag) {
	s.mu.Lock()
	s.flags[f.Name] = f
	s.mu.Unlock()
	s.broadcast(f)
}

func (s *flagStore) Delete(name string) {
	s.mu.Lock()
	delete(s.flags, name)
	s.mu.Unlock()
}

func (s *flagStore) Get(name string) (resolvedFlag, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	f, ok := s.flags[name]
	return f, ok
}

func (s *flagStore) All() []resolvedFlag {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]resolvedFlag, 0, len(s.flags))
	for _, f := range s.flags {
		result = append(result, f)
	}
	return result
}

func (s *flagStore) Subscribe() chan resolvedFlag {
	ch := make(chan resolvedFlag, 64)
	s.subMu.Lock()
	s.subscribers[ch] = struct{}{}
	s.subMu.Unlock()
	return ch
}

func (s *flagStore) Unsubscribe(ch chan resolvedFlag) {
	s.subMu.Lock()
	delete(s.subscribers, ch)
	s.subMu.Unlock()
	close(ch)
}

func (s *flagStore) broadcast(f resolvedFlag) {
	s.subMu.Lock()
	defer s.subMu.Unlock()
	for ch := range s.subscribers {
		select {
		case ch <- f:
		default: // drop if subscriber is slow
		}
	}
}

func resolveFlag(ff *vexilv1alpha1.FeatureFlag) resolvedFlag {
	value := ff.Spec.DefaultValue
	if ff.Status.CurrentValue != "" {
		value = ff.Status.CurrentValue
	}
	return resolvedFlag{
		Name:        ff.Name,
		Type:        string(ff.Spec.Type),
		Value:       value,
		Disabled:    ff.Spec.Disabled,
		Description: ff.Spec.Description,
	}
}

func getNamespace() string {
	if ns := os.Getenv("VEXIL_NAMESPACE"); ns != "" {
		return ns
	}
	if data, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace"); err == nil {
		return string(data)
	}
	return "default"
}

func startWatcher(ctx context.Context, store *flagStore, logger *slog.Logger) error {
	cfg, err := rest.InClusterConfig()
	if err != nil {
		return fmt.Errorf("in-cluster config: %w", err)
	}

	k8sClient, err := client.NewWithWatch(cfg, client.Options{Scheme: scheme})
	if err != nil {
		return fmt.Errorf("creating client: %w", err)
	}

	ns := getNamespace()
	logger.Info("watching FeatureFlags", "namespace", ns)

	// Initial list
	var flagList vexilv1alpha1.FeatureFlagList
	if err := k8sClient.List(ctx, &flagList, client.InNamespace(ns)); err != nil {
		return fmt.Errorf("initial list: %w", err)
	}
	for i := range flagList.Items {
		store.Set(resolveFlag(&flagList.Items[i]))
	}
	logger.Info("loaded initial flags", "count", len(flagList.Items))

	// Watch for changes
	go func() {
		for {
			if ctx.Err() != nil {
				return
			}
			watcher, err := k8sClient.Watch(ctx, &vexilv1alpha1.FeatureFlagList{}, client.InNamespace(ns))
			if err != nil {
				logger.Error("watch error, retrying", "error", err)
				time.Sleep(5 * time.Second)
				continue
			}
			for event := range watcher.ResultChan() {
				ff, ok := event.Object.(*vexilv1alpha1.FeatureFlag)
				if !ok {
					continue
				}
				switch event.Type {
				case watch.Added, watch.Modified:
					store.Set(resolveFlag(ff))
					logger.Debug("flag updated", "name", ff.Name, "value", ff.Spec.DefaultValue)
				case watch.Deleted:
					store.Delete(ff.Name)
					logger.Debug("flag deleted", "name", ff.Name)
				}
			}
			logger.Warn("watch channel closed, reconnecting")
			time.Sleep(time.Second)
		}
	}()

	return nil
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	port := os.Getenv("VEXIL_SIDECAR_PORT")
	if port == "" {
		port = "8514"
	}

	store := newFlagStore()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := startWatcher(ctx, store, logger); err != nil {
		logger.Error("failed to start watcher", "error", err)
		os.Exit(1)
	}

	mux := http.NewServeMux()

	// GET /flags — all flags
	mux.HandleFunc("GET /flags", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(store.All())
	})

	// GET /flags/stream — SSE
	mux.HandleFunc("GET /flags/stream", func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		flusher.Flush()

		ch := store.Subscribe()
		defer store.Unsubscribe(ch)

		for {
			select {
			case <-r.Context().Done():
				return
			case flag := <-ch:
				data, _ := json.Marshal(flag)
				fmt.Fprintf(w, "event: update\ndata: %s\n\n", data)
				flusher.Flush()
			}
		}
	})

	// GET /flags/{name} — single flag JSON
	mux.HandleFunc("GET /flags/{name}", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if name == "stream" {
			return // handled above
		}
		f, ok := store.Get(name)
		if !ok {
			http.Error(w, `{"error":"flag not found"}`, http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(f)
	})

	// GET /flags/{name}/value — raw value
	mux.HandleFunc("GET /flags/{name}/value", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		f, ok := store.Get(name)
		if !ok {
			http.Error(w, "flag not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(f.Value))
	})

	// GET /healthz
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	server := &http.Server{
		Addr:    "127.0.0.1:" + port,
		Handler: mux,
	}

	go func() {
		logger.Info("sidecar starting", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	logger.Info("shutting down")
	cancel()
	server.Shutdown(context.Background())

	// suppress unused import
	_ = metav1.Now
	_ = cache.MetaNamespaceKeyFunc
}

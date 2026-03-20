package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"flag"
	"log/slog"
	"os"

	"golang.org/x/crypto/bcrypt"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/vexil-platform/vexil/internal/apiserver"
	"github.com/vexil-platform/vexil/internal/apiserver/store"
	"github.com/vexil-platform/vexil/internal/multicluster"
)

func main() {
	var port int
	var corsOrigins string
	var adminPassword string

	flag.IntVar(&port, "port", 8090, "API server port")
	flag.StringVar(&corsOrigins, "cors-origins", "http://localhost:3000", "Allowed CORS origins")
	flag.StringVar(&adminPassword, "admin-password", "", "Admin user password (or set VEXIL_ADMIN_PASSWORD)")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	// Initialize store (in-memory for MVP, Postgres later)
	st := store.NewMemoryStore()
	defer st.Close()

	// Create admin user
	if adminPassword == "" {
		adminPassword = os.Getenv("VEXIL_ADMIN_PASSWORD")
	}
	if adminPassword == "" {
		b := make([]byte, 8)
		if _, err := rand.Read(b); err != nil {
			logger.Error("failed to generate admin password", "error", err)
			os.Exit(1)
		}
		adminPassword = hex.EncodeToString(b)
		logger.Info("admin password generated", "password", adminPassword)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		logger.Error("failed to hash admin password", "error", err)
		os.Exit(1)
	}
	if err := st.CreateUser(context.Background(), store.User{
		Username:     "admin",
		PasswordHash: string(hash),
		Role:         "admin",
	}); err != nil {
		logger.Error("failed to create admin user", "error", err)
		os.Exit(1)
	}

	// Initialize multicluster manager
	clusterMgr := multicluster.NewManager()

	// Auto-register the local cluster if running inside K8s
	if err := registerLocalCluster(clusterMgr, logger); err != nil {
		logger.Warn("could not auto-register local cluster", "error", err)
	}

	cfg := apiserver.Config{
		Port:        port,
		CORSOrigins: corsOrigins,
	}

	srv := apiserver.New(cfg, st, clusterMgr)

	logger.Info("Vexil API server starting", "port", port)
	if err := srv.Run(context.Background()); err != nil {
		logger.Error("server error", "error", err)
		os.Exit(1)
	}
}

// registerLocalCluster detects if we're running inside a K8s cluster
// and auto-registers it as the "local" cluster.
func registerLocalCluster(mgr *multicluster.Manager, logger *slog.Logger) error {
	// Try in-cluster config first (running inside K8s)
	cfg, err := rest.InClusterConfig()
	if err != nil {
		// Fallback to kubeconfig (local development)
		loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
		configOverrides := &clientcmd.ConfigOverrides{}
		kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)

		cfg, err = kubeConfig.ClientConfig()
		if err != nil {
			return err
		}
	}

	clusterID := os.Getenv("VEXIL_CLUSTER_ID")
	if clusterID == "" {
		clusterID = "local"
	}
	clusterName := os.Getenv("VEXIL_CLUSTER_NAME")
	if clusterName == "" {
		clusterName = "Local Cluster"
	}

	info := multicluster.ClusterInfo{
		ID:          clusterID,
		DisplayName: clusterName,
		APIServer:   cfg.Host,
	}

	if err := mgr.AddClusterFromConfig(info, cfg); err != nil {
		return err
	}

	logger.Info("auto-registered local cluster",
		"id", clusterID,
		"name", clusterName,
		"apiServer", cfg.Host,
	)
	return nil
}

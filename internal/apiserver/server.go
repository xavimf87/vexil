package apiserver

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/vexil-platform/vexil/internal/apiserver/handlers"
	"github.com/vexil-platform/vexil/internal/apiserver/middleware"
	"github.com/vexil-platform/vexil/internal/apiserver/store"
	"github.com/vexil-platform/vexil/internal/multicluster"
)

// Config holds the API server configuration.
type Config struct {
	Port        int    `json:"port"`
	DatabaseURL string `json:"databaseURL"`
	CORSOrigins string `json:"corsOrigins"`
}

// Server is the Vexil API server.
type Server struct {
	config     Config
	store      store.Store
	clusterMgr *multicluster.Manager
	logger     *slog.Logger
	httpServer *http.Server
}

// New creates a new API server.
func New(cfg Config, st store.Store, clusterMgr *multicluster.Manager) *Server {
	return &Server{
		config:     cfg,
		store:      st,
		clusterMgr: clusterMgr,
		logger:     slog.Default(),
	}
}

// Run starts the API server and blocks until shutdown.
func (s *Server) Run(ctx context.Context) error {
	mux := http.NewServeMux()

	// API routes
	authHandler := handlers.NewAuthHandler(s.store)
	flagHandler := handlers.NewFlagHandler(s.clusterMgr, s.store)
	clusterHandler := handlers.NewClusterHandler(s.clusterMgr, s.store)
	workloadHandler := handlers.NewWorkloadHandler(s.clusterMgr)
	auditHandler := handlers.NewAuditHandler(s.store)

	// Helper to wrap a handler with role requirements
	withRoles := func(roles []string, handler http.HandlerFunc) http.Handler {
		return middleware.RequireRole(roles...)(handler)
	}

	adminOnly := []string{"admin"}
	editorUp := []string{"admin", "editor"}

	// Auth
	mux.HandleFunc("POST /api/v1/auth/login", authHandler.Login)
	mux.HandleFunc("POST /api/v1/auth/logout", authHandler.Logout)
	mux.HandleFunc("GET /api/v1/auth/me", authHandler.Me)

	// Users
	mux.HandleFunc("GET /api/v1/users", authHandler.ListUsers)
	mux.Handle("POST /api/v1/users", withRoles(adminOnly, authHandler.CreateUser))
	mux.HandleFunc("PUT /api/v1/users/{username}", authHandler.UpdateUser)
	mux.Handle("DELETE /api/v1/users/{username}", withRoles(adminOnly, authHandler.DeleteUser))

	// Flags
	mux.HandleFunc("GET /api/v1/flags", flagHandler.List)
	mux.Handle("POST /api/v1/flags", withRoles(editorUp, flagHandler.Create))
	mux.HandleFunc("GET /api/v1/flags/{namespace}/{name}", flagHandler.Get)
	mux.Handle("PUT /api/v1/flags/{namespace}/{name}", withRoles(editorUp, flagHandler.Update))
	mux.Handle("DELETE /api/v1/flags/{namespace}/{name}", withRoles(adminOnly, flagHandler.Delete))
	mux.Handle("POST /api/v1/flags/{namespace}/{name}/toggle", withRoles(editorUp, flagHandler.Toggle))

	// Clusters
	mux.HandleFunc("GET /api/v1/clusters", clusterHandler.List)
	mux.Handle("POST /api/v1/clusters", withRoles(adminOnly, clusterHandler.Register))
	mux.HandleFunc("GET /api/v1/clusters/{id}", clusterHandler.Get)
	mux.Handle("DELETE /api/v1/clusters/{id}", withRoles(adminOnly, clusterHandler.Remove))

	// Workloads
	mux.HandleFunc("GET /api/v1/clusters/{id}/namespaces", workloadHandler.ListNamespaces)
	mux.HandleFunc("GET /api/v1/clusters/{id}/workloads", workloadHandler.List)
	mux.HandleFunc("GET /api/v1/clusters/{id}/workloads/{namespace}/{name}", workloadHandler.Get)

	// Audit
	mux.HandleFunc("GET /api/v1/audit", auditHandler.List)

	// Health
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Apply middleware
	handler := middleware.CORS(s.config.CORSOrigins)(
		middleware.Auth(authHandler)(
			middleware.Logger(s.logger)(
				middleware.Recovery()(mux),
			),
		),
	)

	s.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%d", s.config.Port),
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	errCh := make(chan error, 1)
	go func() {
		s.logger.Info("starting API server", "port", s.config.Port)
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return err
	case <-sigCh:
		s.logger.Info("shutting down API server")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return s.httpServer.Shutdown(shutdownCtx)
	case <-ctx.Done():
		s.logger.Info("context cancelled, shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return s.httpServer.Shutdown(shutdownCtx)
	}
}

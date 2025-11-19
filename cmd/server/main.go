package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"github.com/urfave/cli/v2"
	"go.uber.org/zap"

	"volaticloud/internal/ent"
	_ "volaticloud/internal/ent/runtime"
	"volaticloud/internal/graph"
	"volaticloud/internal/logger"
	"volaticloud/internal/monitor"
)

func main() {
	// Initialize logger
	ctx := context.Background()
	ctx, log := logger.PrepareLogger(ctx)
	defer func() { _ = logger.Sync(ctx) }()

	app := &cli.App{
		Name:    "volaticloud",
		Usage:   "VolatiCloud Control Plane - Manage freqtrade trading bots",
		Version: "0.1.0",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:    "host",
				Usage:   "Server host",
				Value:   "0.0.0.0",
				EnvVars: []string{"VOLATICLOUD_HOST"},
			},
			&cli.IntFlag{
				Name:    "port",
				Usage:   "Server port",
				Value:   8080,
				EnvVars: []string{"VOLATICLOUD_PORT"},
			},
			&cli.StringFlag{
				Name:    "database",
				Usage:   "Database connection string (sqlite://path/to/db.sqlite or postgresql://...)",
				Value:   "sqlite://./data/volaticloud.db",
				EnvVars: []string{"VOLATICLOUD_DATABASE"},
			},
			&cli.StringSliceFlag{
				Name:    "etcd-endpoints",
				Usage:   "Etcd endpoints for distributed monitoring (comma-separated). If empty, runs in single-instance mode",
				EnvVars: []string{"VOLATICLOUD_ETCD_ENDPOINTS"},
			},
			&cli.DurationFlag{
				Name:    "monitor-interval",
				Usage:   "How often to check bot status",
				Value:   30 * time.Second,
				EnvVars: []string{"VOLATICLOUD_MONITOR_INTERVAL"},
			},
		},
		Action: func(c *cli.Context) error {
			return runServer(ctx, c)
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatal("Application error", zap.Error(err))
	}
}

// parseDatabase parses the database connection string and returns driver and DSN
func parseDatabase(dbURL string) (driver, dsn string, err error) {
	if strings.HasPrefix(dbURL, "sqlite://") {
		driver = "sqlite3"
		dsn = strings.TrimPrefix(dbURL, "sqlite://")

		// Create directory if it doesn't exist
		dir := filepath.Dir(dsn)
		if dir != "" && dir != "." {
			if err := os.MkdirAll(dir, 0755); err != nil {
				return "", "", fmt.Errorf("failed to create database directory: %w", err)
			}
		}

		// Add SQLite parameters for better performance
		if !strings.Contains(dsn, "?") {
			dsn += "?_fk=1"
		}

		return driver, dsn, nil
	} else if strings.HasPrefix(dbURL, "postgresql://") || strings.HasPrefix(dbURL, "postgres://") {
		driver = "postgres"
		dsn = dbURL
		return driver, dsn, nil
	}

	return "", "", fmt.Errorf("unsupported database URL format: %s (use sqlite:// or postgresql://)", dbURL)
}

func runServer(parentCtx context.Context, c *cli.Context) error {
	// Get logger from parent context
	log := logger.GetLogger(parentCtx)

	// Setup context with cancellation
	ctx, cancel := context.WithCancel(parentCtx)
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Info("Shutdown signal received, cleaning up...")
		cancel()
	}()

	// Parse database connection
	dbURL := c.String("database")
	driver, dsn, err := parseDatabase(dbURL)
	if err != nil {
		return err
	}

	// Initialize database connection with ZAP logger
	client, err := ent.Open(
		driver,
		dsn,
		ent.Log(logger.EntAdapterFromContext(ctx)),
	)
	if err != nil {
		return fmt.Errorf("failed opening connection to %s: %w", driver, err)
	}
	defer func() { _ = client.Close() }()

	// Run auto migration
	if err := client.Schema.Create(ctx); err != nil {
		return fmt.Errorf("failed creating schema resources: %w", err)
	}

	host := c.String("host")
	port := c.Int("port")

	// Initialize monitor manager
	etcdEndpoints := c.StringSlice("etcd-endpoints")
	monitorInterval := c.Duration("monitor-interval")

	monitorManager, err := monitor.NewManager(monitor.Config{
		DatabaseClient:  client,
		EtcdEndpoints:   etcdEndpoints,
		MonitorInterval: monitorInterval,
	})
	if err != nil {
		return fmt.Errorf("failed to create monitor manager: %w", err)
	}

	// Start monitor manager
	if err := monitorManager.Start(ctx); err != nil {
		return fmt.Errorf("failed to start monitor manager: %w", err)
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := monitorManager.Stop(shutdownCtx); err != nil {
			log.Error("Error stopping monitor manager", zap.Error(err))
		}
	}()

	// Setup GraphQL server
	srv := handler.NewDefaultServer(graph.NewExecutableSchema(graph.Config{
		Resolvers: graph.NewResolver(client),
	}))

	// Setup Chi router
	router := chi.NewRouter()

	// Middleware
	router.Use(middleware.Logger)
	router.Use(middleware.Recoverer)
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Compress(5))

	// CORS middleware for dashboard
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:5174", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// GraphQL routes
	router.Handle("/", playground.Handler("GraphQL Playground", "/query"))
	router.Handle("/query", srv)

	// Health check endpoint
	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// HTTP server
	addr := fmt.Sprintf("%s:%d", host, port)
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Info("VolatiCloud Control Plane")
	log.Info("======================")
	log.Info("✓ Database", zap.String("driver", driver), zap.String("dsn", dsn))
	log.Info("✓ Schema migrated")
	log.Info("✓ GraphQL endpoint", zap.String("url", fmt.Sprintf("http://%s/query", addr)))
	log.Info("✓ GraphQL playground", zap.String("url", fmt.Sprintf("http://%s/", addr)))
	log.Info("✓ Health check", zap.String("url", fmt.Sprintf("http://%s/health", addr)))
	log.Info("")

	// Display monitor status
	if monitorManager.IsDistributed() {
		log.Info("✓ Bot monitoring: DISTRIBUTED mode",
			zap.String("instance", monitorManager.GetInstanceID()),
			zap.Int("active_instances", monitorManager.GetInstanceCount()),
			zap.Duration("interval", monitorInterval))
	} else {
		log.Info("✓ Bot monitoring: SINGLE-INSTANCE mode",
			zap.String("instance", monitorManager.GetInstanceID()),
			zap.Duration("interval", monitorInterval))
	}

	log.Info("")
	log.Info("🚀 Server ready", zap.String("address", fmt.Sprintf("http://%s", addr)))

	// Start server in goroutinex
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server error", zap.Error(err))
		}
	}()

	// Wait for shutdown
	<-ctx.Done()

	// Graceful shutdown
	log.Info("Shutting down server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Error("Server shutdown error", zap.Error(err))
	}

	log.Info("Server stopped")
	return nil
}

package main

import (
	"context"
	"fmt"
	"log"
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

	"anytrade/internal/ent"
	_ "anytrade/internal/ent/runtime"
	"anytrade/internal/graph"
	"anytrade/internal/monitor"
)

func main() {
	app := &cli.App{
		Name:    "anytrade",
		Usage:   "AnyTrade Control Plane - Manage freqtrade trading bots",
		Version: "0.1.0",
		Commands: []*cli.Command{
			{
				Name:  "server",
				Usage: "Start the control plane server",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "host",
						Usage:   "Server host",
						Value:   "0.0.0.0",
						EnvVars: []string{"ANYTRADE_HOST"},
					},
					&cli.IntFlag{
						Name:    "port",
						Usage:   "Server port",
						Value:   8080,
						EnvVars: []string{"ANYTRADE_PORT"},
					},
					&cli.StringFlag{
						Name:    "database",
						Usage:   "Database connection string (sqlite://path/to/db.sqlite or postgresql://...)",
						Value:   "sqlite://./data/anytrade.db",
						EnvVars: []string{"ANYTRADE_DATABASE"},
					},
					&cli.StringSliceFlag{
						Name:    "etcd-endpoints",
						Usage:   "Etcd endpoints for distributed monitoring (comma-separated). If empty, runs in single-instance mode",
						EnvVars: []string{"ANYTRADE_ETCD_ENDPOINTS"},
					},
					&cli.DurationFlag{
						Name:    "monitor-interval",
						Usage:   "How often to check bot status",
						Value:   30 * time.Second,
						EnvVars: []string{"ANYTRADE_MONITOR_INTERVAL"},
					},
				},
				Action: runServer,
			},
			{
				Name:  "migrate",
				Usage: "Run database migrations",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "database",
						Usage:   "Database connection string (sqlite://path/to/db.sqlite or postgresql://...)",
						Value:   "sqlite://./data/anytrade.db",
						EnvVars: []string{"ANYTRADE_DATABASE"},
					},
				},
				Action: runMigrate,
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatal(err)
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

func runServer(c *cli.Context) error {
	// Setup context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutdown signal received, cleaning up...")
		cancel()
	}()

	// Parse database connection
	dbURL := c.String("database")
	driver, dsn, err := parseDatabase(dbURL)
	if err != nil {
		return err
	}

	// Initialize database connection
	client, err := ent.Open(driver, dsn)
	if err != nil {
		return fmt.Errorf("failed opening connection to %s: %w", driver, err)
	}
	defer client.Close()

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
			log.Printf("Error stopping monitor manager: %v", err)
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

	log.Println("AnyTrade Control Plane")
	log.Println("======================")
	log.Printf("✓ Database: %s (%s)\n", driver, dsn)
	log.Println("✓ Schema migrated")
	log.Printf("✓ GraphQL endpoint: http://%s/query\n", addr)
	log.Printf("✓ GraphQL playground: http://%s/\n", addr)
	log.Printf("✓ Health check: http://%s/health\n", addr)
	log.Println("")

	// Display monitor status
	if monitorManager.IsDistributed() {
		log.Printf("✓ Bot monitoring: DISTRIBUTED mode (instance: %s)\n", monitorManager.GetInstanceID())
		log.Printf("  - Active instances: %d\n", monitorManager.GetInstanceCount())
		log.Printf("  - Monitor interval: %v\n", monitorInterval)
	} else {
		log.Printf("✓ Bot monitoring: SINGLE-INSTANCE mode (instance: %s)\n", monitorManager.GetInstanceID())
		log.Printf("  - Monitor interval: %v\n", monitorInterval)
	}

	log.Println("")
	log.Printf("🚀 Server ready at http://%s\n", addr)

	// Start server in goroutinex
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for shutdown
	<-ctx.Done()

	// Graceful shutdown
	log.Println("Shutting down server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped")
	return nil
}

func runMigrate(c *cli.Context) error {
	ctx := context.Background()

	// Parse database connection
	dbURL := c.String("database")
	driver, dsn, err := parseDatabase(dbURL)
	if err != nil {
		return err
	}

	// Initialize database connection
	client, err := ent.Open(driver, dsn)
	if err != nil {
		return fmt.Errorf("failed opening connection to %s: %w", driver, err)
	}
	defer client.Close()

	// Run auto migration
	log.Printf("Running database migrations on %s...\n", driver)
	if err := client.Schema.Create(ctx); err != nil {
		return fmt.Errorf("failed creating schema resources: %w", err)
	}

	log.Println("✓ Migrations completed successfully!")
	log.Printf("✓ Database: %s\n", dsn)
	return nil
}

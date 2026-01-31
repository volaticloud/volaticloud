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

	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"github.com/redis/go-redis/v9"
	"github.com/urfave/cli/v2"

	"volaticloud/internal/alert"
	"volaticloud/internal/alert/channel"
	"volaticloud/internal/auth"
	"volaticloud/internal/authz"
	"volaticloud/internal/billing"
	"volaticloud/internal/db"
	_ "volaticloud/internal/docker" // Register Docker runtime creator
	"volaticloud/internal/ent"
	"volaticloud/internal/ent/migrate"
	_ "volaticloud/internal/ent/runtime"
	"volaticloud/internal/graph"
	"volaticloud/internal/keycloak"
	_ "volaticloud/internal/kubernetes" // Register Kubernetes runtime creator
	"volaticloud/internal/monitor"
	"volaticloud/internal/proxy"
	"volaticloud/internal/pubsub"
)

func main() {
	// Load .env file if present (for local development)
	// Ignore error only if file doesn't exist (expected in production)
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		log.Printf("Warning: Error loading .env file: %v", err)
	}

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
			&cli.DurationFlag{
				Name:    "data-download-timeout",
				Usage:   "Maximum time allowed for runner data downloads",
				Value:   12 * time.Hour,
				EnvVars: []string{"VOLATICLOUD_DATA_DOWNLOAD_TIMEOUT"},
			},
			&cli.StringFlag{
				Name:    "keycloak-url",
				Usage:   "Keycloak server URL (e.g., https://keycloak.volaticloud.com)",
				EnvVars: []string{"VOLATICLOUD_KEYCLOAK_URL"},
			},
			&cli.StringFlag{
				Name:    "keycloak-realm",
				Usage:   "Keycloak realm name",
				Value:   "volaticloud",
				EnvVars: []string{"VOLATICLOUD_KEYCLOAK_REALM"},
			},
			&cli.StringFlag{
				Name:    "keycloak-client-id",
				Usage:   "Keycloak client ID for backend API",
				Value:   "volaticloud-api",
				EnvVars: []string{"VOLATICLOUD_KEYCLOAK_CLIENT_ID"},
			},
			&cli.StringFlag{
				Name:    "keycloak-client-secret",
				Usage:   "Keycloak client secret for UMA resource management",
				EnvVars: []string{"VOLATICLOUD_KEYCLOAK_CLIENT_SECRET"},
			},
			&cli.StringFlag{
				Name:    "keycloak-dashboard-client-id",
				Usage:   "Keycloak client ID for the dashboard (used in invitation redirects)",
				Value:   "dashboard",
				EnvVars: []string{"VOLATICLOUD_KEYCLOAK_DASHBOARD_CLIENT_ID"},
			},
			// Alert configuration
			&cli.StringFlag{
				Name:    "sendgrid-api-key",
				Usage:   "SendGrid API key for email alerts",
				EnvVars: []string{"VOLATICLOUD_SENDGRID_API_KEY"},
			},
			&cli.StringFlag{
				Name:    "alert-from-email",
				Usage:   "Sender email address for alerts",
				Value:   "alerts@volaticloud.com",
				EnvVars: []string{"VOLATICLOUD_ALERT_FROM_EMAIL"},
			},
			&cli.StringFlag{
				Name:    "alert-from-name",
				Usage:   "Sender display name for alerts",
				Value:   "VolatiCloud Alerts",
				EnvVars: []string{"VOLATICLOUD_ALERT_FROM_NAME"},
			},
			&cli.DurationFlag{
				Name:    "alert-batch-interval",
				Usage:   "How often to send batched alerts",
				Value:   time.Hour,
				EnvVars: []string{"VOLATICLOUD_ALERT_BATCH_INTERVAL"},
			},
			// Stripe billing configuration
			&cli.StringFlag{
				Name:    "stripe-api-key",
				Usage:   "Stripe API key for billing",
				EnvVars: []string{"VOLATICLOUD_STRIPE_API_KEY"},
			},
			&cli.StringFlag{
				Name:    "stripe-webhook-secret",
				Usage:   "Stripe webhook signing secret",
				EnvVars: []string{"VOLATICLOUD_STRIPE_WEBHOOK_SECRET"},
			},
			// Redis configuration for subscriptions
			&cli.StringFlag{
				Name:    "redis-url",
				Usage:   "Redis URL for GraphQL subscriptions (e.g., redis://localhost:6379). If empty, uses in-memory pub/sub",
				EnvVars: []string{"VOLATICLOUD_REDIS_URL"},
			},
			// WebSocket configuration
			&cli.StringSliceFlag{
				Name:    "cors-origins",
				Usage:   "Allowed CORS origins (comma-separated)",
				Value:   cli.NewStringSlice("http://localhost:5173", "http://localhost:5174", "http://localhost:3000"),
				EnvVars: []string{"VOLATICLOUD_CORS_ORIGINS"},
			},
			&cli.StringFlag{
				Name:    "frontend-url",
				Usage:   "Frontend URL for Stripe redirect URLs (e.g., https://app.volaticloud.com). Falls back to Origin header if not set",
				EnvVars: []string{"VOLATICLOUD_FRONTEND_URL"},
			},
		},
		Action: runServer,
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

	// Run auto migration with options for schema flexibility
	// Note: SQLite cannot alter FK constraints on existing tables.
	// Cascade deletes are enforced at application level in DeleteStrategyWithResource.
	if err := client.Schema.Create(
		ctx,
		migrate.WithDropIndex(true),
		migrate.WithDropColumn(true),
	); err != nil {
		return fmt.Errorf("failed creating schema resources: %w", err)
	}

	// Setup soft-delete hooks - converts Delete() to UPDATE SET deleted_at
	db.SetupSoftDelete(client)

	host := c.String("host")
	port := c.Int("port")

	// Initialize Keycloak client (REQUIRED in all environments)
	// Must be initialized before alert manager and monitor manager
	keycloakConfig := auth.KeycloakConfig{
		URL:               c.String("keycloak-url"),
		Realm:             c.String("keycloak-realm"),
		ClientID:          c.String("keycloak-client-id"),
		ClientSecret:      c.String("keycloak-client-secret"),
		DashboardClientID: c.String("keycloak-dashboard-client-id"),
	}

	// Validate that Keycloak is configured
	if keycloakConfig.URL == "" || keycloakConfig.ClientID == "" || keycloakConfig.ClientSecret == "" {
		return fmt.Errorf("keycloak configuration is required (URL, ClientID, ClientSecret must be set)")
	}

	keycloakClient, err := auth.InitKeycloak(ctx, keycloakConfig)
	if err != nil {
		return fmt.Errorf("failed to initialize Keycloak: %w", err)
	}

	// Initialize UMA client for resource-level authorization
	umaClient := keycloak.NewUMAClient(
		keycloakConfig.URL,
		keycloakConfig.Realm,
		keycloakConfig.ClientID,
		keycloakConfig.ClientSecret,
	)
	log.Println("✓ Keycloak UMA 2.0 authorization enabled")

	// Initialize Admin client for Keycloak group/user management
	adminClient := keycloak.NewAdminClient(keycloakConfig)
	log.Println("✓ Keycloak Admin API client initialized")

	// Register ENT hooks for automatic Keycloak resource sync
	// This ensures resources are created/deleted in Keycloak when entities are created/deleted
	authz.RegisterKeycloakHooks(client)

	// Initialize monitor manager
	etcdEndpoints := c.StringSlice("etcd-endpoints")
	monitorInterval := c.Duration("monitor-interval")

	monitorManager, err := monitor.NewManager(monitor.Config{
		DatabaseClient:      client,
		EtcdEndpoints:       etcdEndpoints,
		MonitorInterval:     monitorInterval,
		DataDownloadTimeout: c.Duration("data-download-timeout"),
	})
	if err != nil {
		return fmt.Errorf("failed to create monitor manager: %w", err)
	}

	// Initialize alert manager (optional - only if SendGrid is configured)
	var alertManager *alert.Manager
	sendgridAPIKey := c.String("sendgrid-api-key")
	if sendgridAPIKey != "" {
		alertManager, err = alert.NewManager(alert.Config{
			DatabaseClient: client,
			BatchInterval:  c.Duration("alert-batch-interval"),
		})
		if err != nil {
			return fmt.Errorf("failed to create alert manager: %w", err)
		}

		// Create SendGrid email channel
		emailChannel, err := channel.NewSendGridChannel(channel.SendGridConfig{
			APIKey:    sendgridAPIKey,
			FromEmail: c.String("alert-from-email"),
			FromName:  c.String("alert-from-name"),
		})
		if err != nil {
			return fmt.Errorf("failed to create SendGrid channel: %w", err)
		}
		alertManager.SetEmailChannel(emailChannel)
		alertManager.SetUMAClient(umaClient)

		// Start alert manager
		if err := alertManager.Start(ctx); err != nil {
			return fmt.Errorf("failed to start alert manager: %w", err)
		}
		defer func() {
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := alertManager.Stop(shutdownCtx); err != nil {
				log.Printf("Error stopping alert manager: %v", err)
			}
		}()

		log.Println("✓ Alert manager initialized with SendGrid email channel")
	} else {
		log.Println("⚠ Alert manager disabled (VOLATICLOUD_SENDGRID_API_KEY not set)")
	}

	// Initialize Stripe billing client (optional)
	var stripeClient *billing.StripeClient
	stripeAPIKey := c.String("stripe-api-key")
	stripeWebhookSecret := c.String("stripe-webhook-secret")
	if stripeAPIKey != "" {
		stripeClient = billing.NewStripeClient(stripeAPIKey)
		log.Println("✓ Stripe billing initialized")
	} else {
		log.Println("⚠ Stripe billing disabled (VOLATICLOUD_STRIPE_API_KEY not set)")
	}

	// Start monitor manager (inject alert manager into context if available)
	monitorCtx := ctx
	if alertManager != nil {
		monitorCtx = alert.SetManagerInContext(ctx, alertManager)
	}
	if err := monitorManager.Start(monitorCtx); err != nil {
		return fmt.Errorf("failed to start monitor manager: %w", err)
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := monitorManager.Stop(shutdownCtx); err != nil {
			log.Printf("Error stopping monitor manager: %v", err)
		}
	}()

	// Initialize pub/sub for GraphQL subscriptions
	var ps pubsub.PubSub
	redisURL := c.String("redis-url")
	if redisURL != "" {
		// Parse Redis URL and create client
		opt, err := redis.ParseURL(redisURL)
		if err != nil {
			log.Printf("Warning: failed to parse Redis URL, falling back to in-memory pub/sub: %v", err)
			ps = pubsub.NewMemoryPubSub()
			log.Println("✓ In-memory pub/sub enabled (Redis URL parse error)")
		} else {
			redisClient := redis.NewClient(opt)

			// Verify Redis connection with graceful degradation
			if err := redisClient.Ping(ctx).Err(); err != nil {
				log.Printf("Warning: Redis unavailable, falling back to in-memory pub/sub: %v", err)
				if closeErr := redisClient.Close(); closeErr != nil {
					log.Printf("Warning: failed to close Redis client: %v", closeErr)
				}
				ps = pubsub.NewMemoryPubSub()
				log.Println("✓ In-memory pub/sub enabled (Redis connection failed)")
			} else {
				ps = pubsub.NewRedisPubSub(redisClient)
				log.Printf("✓ Redis pub/sub enabled: %s", redisURL)
			}
		}
	} else {
		// Use in-memory pub/sub for single-instance deployments
		ps = pubsub.NewMemoryPubSub()
		log.Println("✓ In-memory pub/sub enabled (no Redis configured)")
	}
	defer func() {
		if err := ps.Close(); err != nil {
			log.Printf("Error closing pub/sub: %v", err)
		}
	}()

	// Connect pub/sub to alert manager for real-time notifications
	if alertManager != nil {
		alertManager.SetPubSub(ps)
	}

	// Get allowed CORS origins
	corsOrigins := c.StringSlice("cors-origins")

	// Setup GraphQL server with auth clients, directive handlers, and WebSocket support
	srv := graph.NewServerWithWebSocket(
		graph.NewExecutableSchema(graph.Config{
			Resolvers: graph.NewResolver(client, keycloakClient, umaClient, ps),
			Directives: graph.DirectiveRoot{
				IsAuthenticated: graph.IsAuthenticatedDirective,
				HasScope:        graph.HasScopeDirective,
				RequiresFeature: graph.RequiresFeatureDirective,
			},
		}),
		graph.WebSocketConfig{
			AllowedOrigins:        corsOrigins,
			KeepAlivePingInterval: 10 * time.Second,
			AuthClient:            keycloakClient,
		},
	)

	// Setup Chi router
	router := chi.NewRouter()

	// Global middleware (applies to ALL routes)
	router.Use(middleware.Logger)
	router.Use(middleware.Recoverer)
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Compress(5))

	// CORS middleware for dashboard routes (used with With() for specific routes)
	corsMiddleware := cors.Handler(cors.Options{
		AllowedOrigins:   corsOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	})

	// Create alert service (always available, uses DB client directly)
	alertService := alert.NewService(client, umaClient)

	// Middleware to inject ENT and UMA clients into context for GraphQL directives and ENT hooks
	injectClientsMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			// Inject ENT client (for GraphQL directives)
			ctx = graph.SetEntClientInContext(ctx, client)
			// Inject UMA client for GraphQL directives
			ctx = graph.SetUMAClientInContext(ctx, umaClient)
			// Inject UMA client for ENT hooks (authz package uses its own context key)
			ctx = authz.SetUMAClientInContext(ctx, umaClient)
			// Inject Admin client for ENT hooks (for GROUP_TITLE sync)
			ctx = authz.SetAdminClientInContext(ctx, adminClient)
			// Inject Admin client (for organization/user management)
			ctx = graph.SetAdminClientInContext(ctx, adminClient)
			// Inject alert service (always available)
			ctx = alert.SetServiceInContext(ctx, alertService)
			// Inject alert manager (only if configured)
			if alertManager != nil {
				ctx = alert.SetManagerInContext(ctx, alertManager)
			}
			// Inject Stripe billing client (only if configured)
			if stripeClient != nil {
				ctx = billing.SetStripeClientInContext(ctx, stripeClient)
			}
			// Inject frontend URL (for Stripe redirect URLs)
			if frontendURL := c.String("frontend-url"); frontendURL != "" {
				ctx = billing.SetFrontendURLInContext(ctx, frontendURL)
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	// Bot proxy handler (created once, used in gateway routes)
	botProxy := proxy.NewBotProxy(client)

	// All API routes under /gateway/v1 prefix
	router.Route("/gateway/v1", func(gw chi.Router) {
		// GraphQL Playground with optional auth (for development convenience)
		gw.With(corsMiddleware, auth.OptionalAuth(keycloakClient), injectClientsMiddleware).Handle("/", playground.Handler("GraphQL Playground", "/gateway/v1/query"))

		// GraphQL API with required authentication
		gw.With(corsMiddleware, auth.RequireAuth(keycloakClient), injectClientsMiddleware).Handle("/query", srv)

		// Health check endpoint - with CORS
		gw.With(corsMiddleware).Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		})

		// Bot proxy endpoint - NO CORS middleware
		// CORS is delegated to the target Freqtrade bot which handles its own CORS_origins
		gw.Route("/bot/{id}", func(r chi.Router) {
			r.Handle("/*", botProxy.Handler())
			r.Handle("/", botProxy.Handler())
		})

		// Stripe webhook endpoint - NO auth (uses Stripe signature verification)
		if stripeClient != nil && stripeWebhookSecret != "" {
			gw.With(httprate.LimitByIP(100, 1*time.Minute)).Post("/webhooks/stripe", billing.NewWebhookHandler(client, stripeClient, stripeWebhookSecret))
		}
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

	log.Println("VolatiCloud Control Plane")
	log.Println("======================")
	log.Printf("✓ Database: %s (%s)\n", driver, dsn)
	log.Println("✓ Schema migrated")
	log.Printf("✓ GraphQL endpoint: http://%s/gateway/v1/query\n", addr)
	log.Printf("✓ GraphQL WebSocket: ws://%s/gateway/v1/query\n", addr)
	log.Printf("✓ GraphQL playground: http://%s/gateway/v1/\n", addr)
	log.Printf("✓ Health check: http://%s/gateway/v1/health\n", addr)
	log.Printf("✓ Bot proxy: http://%s/gateway/v1/bot/{id}/*\n", addr)
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

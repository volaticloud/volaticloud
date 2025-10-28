package etcd

import (
	"context"
	"fmt"
	"time"

	clientv3 "go.etcd.io/etcd/client/v3"
	"go.etcd.io/etcd/client/v3/concurrency"
)

// Client wraps etcd client with convenience methods for distributed coordination
type Client struct {
	cli *clientv3.Client
}

// Config holds etcd client configuration
type Config struct {
	// Endpoints is the list of etcd server endpoints
	Endpoints []string

	// DialTimeout is the timeout for failing to establish a connection
	DialTimeout time.Duration

	// Username for authentication (optional)
	Username string

	// Password for authentication (optional)
	Password string
}

// NewClient creates a new etcd client
func NewClient(cfg Config) (*Client, error) {
	if len(cfg.Endpoints) == 0 {
		return nil, fmt.Errorf("etcd endpoints cannot be empty")
	}

	if cfg.DialTimeout == 0 {
		cfg.DialTimeout = 5 * time.Second
	}

	cli, err := clientv3.New(clientv3.Config{
		Endpoints:   cfg.Endpoints,
		DialTimeout: cfg.DialTimeout,
		Username:    cfg.Username,
		Password:    cfg.Password,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create etcd client: %w", err)
	}

	return &Client{cli: cli}, nil
}

// Close closes the etcd client connection
func (c *Client) Close() error {
	if c.cli != nil {
		return c.cli.Close()
	}
	return nil
}

// Put puts a key-value pair into etcd
func (c *Client) Put(ctx context.Context, key, value string) error {
	_, err := c.cli.Put(ctx, key, value)
	return err
}

// Get retrieves a value from etcd by key
func (c *Client) Get(ctx context.Context, key string) (string, error) {
	resp, err := c.cli.Get(ctx, key)
	if err != nil {
		return "", err
	}

	if len(resp.Kvs) == 0 {
		return "", fmt.Errorf("key not found: %s", key)
	}

	return string(resp.Kvs[0].Value), nil
}

// GetWithPrefix retrieves all key-value pairs with the given prefix
func (c *Client) GetWithPrefix(ctx context.Context, prefix string) (map[string]string, error) {
	resp, err := c.cli.Get(ctx, prefix, clientv3.WithPrefix())
	if err != nil {
		return nil, err
	}

	result := make(map[string]string, len(resp.Kvs))
	for _, kv := range resp.Kvs {
		result[string(kv.Key)] = string(kv.Value)
	}

	return result, nil
}

// Delete deletes a key from etcd
func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.cli.Delete(ctx, key)
	return err
}

// GrantLease grants a lease with the given TTL in seconds
func (c *Client) GrantLease(ctx context.Context, ttl int64) (clientv3.LeaseID, error) {
	resp, err := c.cli.Grant(ctx, ttl)
	if err != nil {
		return 0, err
	}
	return resp.ID, nil
}

// PutWithLease puts a key-value pair with a lease
func (c *Client) PutWithLease(ctx context.Context, key, value string, leaseID clientv3.LeaseID) error {
	_, err := c.cli.Put(ctx, key, value, clientv3.WithLease(leaseID))
	return err
}

// KeepAlive keeps a lease alive by sending keep-alive requests
// Returns a channel that receives keep-alive responses
func (c *Client) KeepAlive(ctx context.Context, leaseID clientv3.LeaseID) (<-chan *clientv3.LeaseKeepAliveResponse, error) {
	return c.cli.KeepAlive(ctx, leaseID)
}

// RevokeLease revokes a lease
func (c *Client) RevokeLease(ctx context.Context, leaseID clientv3.LeaseID) error {
	_, err := c.cli.Revoke(ctx, leaseID)
	return err
}

// Watch watches for changes on a key or prefix
func (c *Client) Watch(ctx context.Context, key string, opts ...clientv3.OpOption) clientv3.WatchChan {
	return c.cli.Watch(ctx, key, opts...)
}

// NewSession creates a new concurrency session for distributed locking and leader election
func (c *Client) NewSession(ctx context.Context, ttl int) (*concurrency.Session, error) {
	return concurrency.NewSession(c.cli, concurrency.WithTTL(ttl))
}

// NewElection creates a new election instance for leader election
func (c *Client) NewElection(session *concurrency.Session, prefix string) *concurrency.Election {
	return concurrency.NewElection(session, prefix)
}

// NewMutex creates a new distributed mutex
func (c *Client) NewMutex(session *concurrency.Session, key string) *concurrency.Mutex {
	return concurrency.NewMutex(session, key)
}

// Client returns the underlying etcd v3 client
func (c *Client) Client() *clientv3.Client {
	return c.cli
}

// HealthCheck checks if etcd is reachable and healthy
func (c *Client) HealthCheck(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	_, err := c.cli.Get(ctx, "health-check")
	return err
}
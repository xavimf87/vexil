// Package vexil provides a client for consuming Vexil feature flags.
//
// Usage:
//
//	// Env var mode (zero dependency, reads FLAG_* env vars)
//	client, _ := vexil.New(vexil.WithEnvProvider())
//
//	// Sidecar mode (real-time, connects to localhost:8514)
//	client, _ := vexil.New(vexil.WithSidecarProvider("localhost:8514"))
//
//	// ConfigMap mode (reads mounted files)
//	client, _ := vexil.New(vexil.WithConfigMapProvider("/etc/vexil"))
//
//	darkMode := client.Bool("dark-mode", false)
//	rateLimit := client.Int("api-rate-limit", 100)
package vexil

import (
	"encoding/json"
	"fmt"
	"strconv"
)

// Flag represents a resolved feature flag.
type Flag struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Value    string `json:"value"`
	Disabled bool   `json:"disabled"`
}

// Provider reads flag values from a source.
type Provider interface {
	GetFlag(name string) (Flag, error)
	GetAllFlags() ([]Flag, error)
	Close() error
}

// Client is the main entry point for consuming feature flags.
type Client struct {
	provider Provider
}

// Option configures a Client.
type Option func(*clientConfig)

type clientConfig struct {
	provider Provider
}

// WithEnvProvider reads flags from environment variables (FLAG_<UPPERCASE_NAME>).
func WithEnvProvider() Option {
	return func(c *clientConfig) {
		c.provider = &envProvider{}
	}
}

// WithSidecarProvider connects to the Vexil sidecar at the given address.
func WithSidecarProvider(addr string) Option {
	return func(c *clientConfig) {
		c.provider = newSidecarProvider(addr)
	}
}

// WithConfigMapProvider reads flags from a mounted ConfigMap path.
func WithConfigMapProvider(path string) Option {
	return func(c *clientConfig) {
		c.provider = &configMapProvider{path: path}
	}
}

// New creates a new Client with the given options.
// Defaults to env provider if no provider is specified.
func New(opts ...Option) (*Client, error) {
	cfg := &clientConfig{}
	for _, opt := range opts {
		opt(cfg)
	}
	if cfg.provider == nil {
		cfg.provider = &envProvider{}
	}
	return &Client{provider: cfg.provider}, nil
}

// Bool returns the boolean value of a flag, or defaultVal if not found or disabled.
func (c *Client) Bool(name string, defaultVal bool) bool {
	f, err := c.provider.GetFlag(name)
	if err != nil || f.Disabled {
		return defaultVal
	}
	v, err := strconv.ParseBool(f.Value)
	if err != nil {
		return defaultVal
	}
	return v
}

// String returns the string value of a flag, or defaultVal if not found or disabled.
func (c *Client) String(name string, defaultVal string) string {
	f, err := c.provider.GetFlag(name)
	if err != nil || f.Disabled {
		return defaultVal
	}
	return f.Value
}

// Int returns the integer value of a flag, or defaultVal if not found or disabled.
func (c *Client) Int(name string, defaultVal int) int {
	f, err := c.provider.GetFlag(name)
	if err != nil || f.Disabled {
		return defaultVal
	}
	v, err := strconv.Atoi(f.Value)
	if err != nil {
		return defaultVal
	}
	return v
}

// JSON unmarshals a JSON flag value into dst.
func (c *Client) JSON(name string, dst interface{}) error {
	f, err := c.provider.GetFlag(name)
	if err != nil {
		return err
	}
	if f.Disabled {
		return fmt.Errorf("flag %s is disabled", name)
	}
	return json.Unmarshal([]byte(f.Value), dst)
}

// Flag returns the raw Flag struct.
func (c *Client) Flag(name string) (Flag, error) {
	return c.provider.GetFlag(name)
}

// AllFlags returns all available flags.
func (c *Client) AllFlags() ([]Flag, error) {
	return c.provider.GetAllFlags()
}

// Close releases any resources held by the provider.
func (c *Client) Close() error {
	return c.provider.Close()
}

package vexil

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// sidecarProvider connects to the Vexil sidecar HTTP API.
type sidecarProvider struct {
	baseURL  string
	cache    sync.Map
	stopCh   chan struct{}
	client   *http.Client
}

func newSidecarProvider(addr string) *sidecarProvider {
	if !strings.HasPrefix(addr, "http") {
		addr = "http://" + addr
	}
	p := &sidecarProvider{
		baseURL: addr,
		stopCh:  make(chan struct{}),
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
	// Start SSE listener for real-time updates
	go p.streamUpdates()
	return p
}

func (p *sidecarProvider) GetFlag(name string) (Flag, error) {
	// Try cache first
	if val, ok := p.cache.Load(name); ok {
		return val.(Flag), nil
	}

	// Fallback to HTTP
	resp, err := p.client.Get(p.baseURL + "/flags/" + name)
	if err != nil {
		return Flag{}, fmt.Errorf("sidecar request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return Flag{}, fmt.Errorf("flag %s not found", name)
	}
	if resp.StatusCode != http.StatusOK {
		return Flag{}, fmt.Errorf("sidecar returned %d", resp.StatusCode)
	}

	var f Flag
	if err := json.NewDecoder(resp.Body).Decode(&f); err != nil {
		return Flag{}, err
	}
	p.cache.Store(name, f)
	return f, nil
}

func (p *sidecarProvider) GetAllFlags() ([]Flag, error) {
	resp, err := p.client.Get(p.baseURL + "/flags")
	if err != nil {
		return nil, fmt.Errorf("sidecar request failed: %w", err)
	}
	defer resp.Body.Close()

	var flags []Flag
	if err := json.NewDecoder(resp.Body).Decode(&flags); err != nil {
		return nil, err
	}
	// Update cache
	for _, f := range flags {
		p.cache.Store(f.Name, f)
	}
	return flags, nil
}

func (p *sidecarProvider) streamUpdates() {
	backoff := time.Second
	maxBackoff := 30 * time.Second

	for {
		select {
		case <-p.stopCh:
			return
		default:
		}

		req, err := http.NewRequest("GET", p.baseURL+"/flags/stream", nil)
		if err != nil {
			time.Sleep(backoff)
			continue
		}

		client := &http.Client{Timeout: 0} // no timeout for SSE
		resp, err := client.Do(req)
		if err != nil {
			time.Sleep(backoff)
			backoff = min(backoff*2, maxBackoff)
			continue
		}

		backoff = time.Second // reset on successful connect
		scanner := bufio.NewScanner(resp.Body)

		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")
			var f Flag
			if err := json.Unmarshal([]byte(data), &f); err == nil {
				p.cache.Store(f.Name, f)
			}
		}
		resp.Body.Close()
	}
}

func (p *sidecarProvider) Close() error {
	close(p.stopCh)
	return nil
}

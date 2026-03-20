package main

import (
	"encoding/json"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type FlagValue struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Source string `json:"source"`
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	sidecarAddr := os.Getenv("VEXIL_SIDECAR_ADDR")
	if sidecarAddr == "" {
		sidecarAddr = "http://localhost:8514"
	}

	configPath := os.Getenv("VEXIL_CONFIG_PATH")
	if configPath == "" {
		configPath = "/etc/vexil"
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		var allFlags []FlagValue

		// 1. Env var flags
		for _, env := range os.Environ() {
			parts := strings.SplitN(env, "=", 2)
			if len(parts) == 2 && strings.HasPrefix(parts[0], "FLAG_") {
				name := strings.ToLower(strings.TrimPrefix(parts[0], "FLAG_"))
				name = strings.ReplaceAll(name, "_", "-")
				allFlags = append(allFlags, FlagValue{
					Name:   name,
					Value:  parts[1],
					Source: "env:" + parts[0],
				})
			}
		}

		// 2. ConfigMap flags
		if info, err := os.Stat(configPath); err == nil && info.IsDir() {
			entries, _ := os.ReadDir(configPath)
			for _, e := range entries {
				if !e.IsDir() && !strings.HasPrefix(e.Name(), ".") {
					data, err := os.ReadFile(filepath.Join(configPath, e.Name()))
					if err == nil {
						allFlags = append(allFlags, FlagValue{
							Name:   e.Name(),
							Value:  strings.TrimSpace(string(data)),
							Source: "configmap:" + configPath,
						})
					}
				}
			}
		}

		// 3. Sidecar flags
		client := &http.Client{Timeout: 2 * time.Second}
		resp, err := client.Get(sidecarAddr + "/flags")
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == 200 {
				body, _ := io.ReadAll(resp.Body)
				var sidecarFlags []struct {
					Name     string `json:"name"`
					Value    string `json:"value"`
					Type     string `json:"type"`
					Disabled bool   `json:"disabled"`
				}
				if json.Unmarshal(body, &sidecarFlags) == nil {
					for _, f := range sidecarFlags {
						allFlags = append(allFlags, FlagValue{
							Name:   f.Name,
							Value:  f.Value,
							Source: "sidecar:" + sidecarAddr,
						})
					}
				}
			}
		}

		sort.Slice(allFlags, func(i, j int) bool {
			return allFlags[i].Name < allFlags[j].Name
		})

		w.Header().Set("Content-Type", "text/html")
		tmpl.Execute(w, map[string]interface{}{
			"Flags":    allFlags,
			"Hostname": hostname(),
			"Time":     time.Now().Format("15:04:05"),
		})
	})

	mux.HandleFunc("/api/flags", func(w http.ResponseWriter, r *http.Request) {
		var flags []FlagValue
		for _, env := range os.Environ() {
			parts := strings.SplitN(env, "=", 2)
			if len(parts) == 2 && strings.HasPrefix(parts[0], "FLAG_") {
				name := strings.ToLower(strings.TrimPrefix(parts[0], "FLAG_"))
				name = strings.ReplaceAll(name, "_", "-")
				flags = append(flags, FlagValue{Name: name, Value: parts[1], Source: "env"})
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(flags)
	})

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	log.Printf("Demo app listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func hostname() string {
	h, _ := os.Hostname()
	return h
}

var tmpl = template.Must(template.New("page").Parse(`<!DOCTYPE html>
<html>
<head>
  <title>Vexil Demo App</title>
  <meta http-equiv="refresh" content="3">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #f8fafc; color: #1e293b; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
    .card { background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 1.5rem; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 0.75rem; text-transform: uppercase; color: #64748b; padding: 0.5rem 1rem; border-bottom: 1px solid #e2e8f0; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; }
    .flag-name { font-weight: 600; }
    .flag-value { font-family: monospace; padding: 2px 8px; border-radius: 4px; font-size: 0.9rem; }
    .flag-true { background: #dcfce7; color: #166534; }
    .flag-false { background: #fee2e2; color: #991b1b; }
    .flag-other { background: #f1f5f9; color: #334155; }
    .source { font-size: 0.75rem; color: #94a3b8; font-family: monospace; }
    .empty { text-align: center; padding: 3rem; color: #94a3b8; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
    .badge-env { background: #dbeafe; color: #1e40af; }
    .badge-configmap { background: #fef3c7; color: #92400e; }
    .badge-sidecar { background: #ede9fe; color: #5b21b6; }
  </style>
</head>
<body>
  <h1>Vexil Demo App</h1>
  <p class="meta">Pod: {{.Hostname}} | Last refresh: {{.Time}} | Auto-refreshes every 3s</p>

  <div class="card">
    {{if .Flags}}
    <table>
      <thead>
        <tr>
          <th>Flag Name</th>
          <th>Current Value</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {{range .Flags}}
        <tr>
          <td class="flag-name">{{.Name}}</td>
          <td>
            <span class="flag-value {{if eq .Value "true"}}flag-true{{else if eq .Value "false"}}flag-false{{else}}flag-other{{end}}">
              {{.Value}}
            </span>
          </td>
          <td>
            <span class="source">{{.Source}}</span>
          </td>
        </tr>
        {{end}}
      </tbody>
    </table>
    {{else}}
    <div class="empty">
      <p>No feature flags detected.</p>
      <p style="margin-top:0.5rem">Create a FeatureFlag CRD targeting <code>app: demo</code></p>
    </div>
    {{end}}
  </div>
</body>
</html>`))

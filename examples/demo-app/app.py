"""Vexil Demo App — shows feature flags received via env vars, ConfigMaps, and sidecar."""

import os
import socket
from datetime import datetime
from pathlib import Path

import requests
from flask import Flask, jsonify, render_template_string

app = Flask(__name__)

SIDECAR_ADDR = os.environ.get("VEXIL_SIDECAR_ADDR", "http://localhost:8514")
CONFIG_PATH = os.environ.get("VEXIL_CONFIG_PATH", "/etc/vexil")

HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
  <title>Vexil Demo App</title>
  <meta http-equiv="refresh" content="3">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; color: #f8fafc; }
    .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
    .card { background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 1.5rem; margin-bottom: 1rem; }
    table { width: 100%%; border-collapse: collapse; }
    th { text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding: 0.5rem 1rem; border-bottom: 1px solid #334155; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid #1e293b; }
    .flag-name { font-weight: 600; color: #f1f5f9; }
    .flag-value { font-family: monospace; padding: 3px 10px; border-radius: 6px; font-size: 0.85rem; }
    .flag-true { background: #064e3b; color: #34d399; }
    .flag-false { background: #450a0a; color: #f87171; }
    .flag-other { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
    .source { font-size: 0.75rem; color: #475569; font-family: monospace; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.65rem; font-weight: 600; margin-right: 4px; }
    .badge-env { background: #1e3a5f; color: #60a5fa; }
    .badge-configmap { background: #422006; color: #fbbf24; }
    .badge-sidecar { background: #2e1065; color: #a78bfa; }
    .empty { text-align: center; padding: 3rem; color: #64748b; }
    .empty code { background: #334155; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; }
    .logo { color: #818cf8; }
  </style>
</head>
<body>
  <h1><span class="logo">&#9873;</span> Vexil Demo App</h1>
  <p class="meta">Pod: {{ hostname }} | Refreshed: {{ time }} | Auto-refreshes every 3s</p>

  <div class="card">
    {% if flags %}
    <table>
      <thead>
        <tr>
          <th>Flag</th>
          <th>Value</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {% for f in flags %}
        <tr>
          <td class="flag-name">{{ f.name }}</td>
          <td>
            <span class="flag-value {% if f.value == 'true' %}flag-true{% elif f.value == 'false' %}flag-false{% else %}flag-other{% endif %}">
              {{ f.value }}
            </span>
          </td>
          <td>
            {% if 'env:' in f.source %}
            <span class="badge badge-env">ENV</span>
            {% elif 'configmap:' in f.source %}
            <span class="badge badge-configmap">CONFIGMAP</span>
            {% elif 'sidecar:' in f.source %}
            <span class="badge badge-sidecar">SIDECAR</span>
            {% endif %}
            <span class="source">{{ f.source }}</span>
          </td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
    {% else %}
    <div class="empty">
      <p>No feature flags detected.</p>
      <p style="margin-top:0.5rem">Create a FeatureFlag CRD targeting <code>app: demo</code></p>
    </div>
    {% endif %}
  </div>
</body>
</html>"""


def collect_flags():
    """Collect flags from all three delivery methods."""
    flags = []

    # 1. Environment variable flags (FLAG_*)
    for key, value in sorted(os.environ.items()):
        if key.startswith("FLAG_"):
            name = key.removeprefix("FLAG_").lower().replace("_", "-")
            flags.append({"name": name, "value": value, "source": f"env:{key}"})

    # 2. ConfigMap flags (mounted files)
    config_dir = Path(CONFIG_PATH)
    if config_dir.is_dir():
        for entry in sorted(config_dir.iterdir()):
            if entry.is_file() and not entry.name.startswith("."):
                value = entry.read_text().strip()
                flags.append({"name": entry.name, "value": value, "source": f"configmap:{CONFIG_PATH}"})

    # 3. Sidecar flags (HTTP API)
    try:
        resp = requests.get(f"{SIDECAR_ADDR}/flags", timeout=2)
        if resp.ok:
            for f in resp.json():
                flags.append({"name": f["name"], "value": f["value"], "source": f"sidecar:{SIDECAR_ADDR}"})
    except Exception:
        pass

    flags.sort(key=lambda f: f["name"])
    return flags


@app.route("/")
def index():
    return render_template_string(
        HTML_TEMPLATE,
        flags=collect_flags(),
        hostname=socket.gethostname(),
        time=datetime.now().strftime("%H:%M:%S"),
    )


@app.route("/api/flags")
def api_flags():
    return jsonify(collect_flags())


@app.route("/healthz")
def healthz():
    return "ok"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)

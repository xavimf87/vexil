"""Vexil - Python SDK for Kubernetes-native Feature Flags.

Usage:
    from vexil import Client

    # Env var mode (reads FLAG_* environment variables)
    client = Client(provider="env")

    # Sidecar mode (connects to localhost:8514)
    client = Client(provider="sidecar")

    # ConfigMap mode (reads mounted files)
    client = Client(provider="configmap", path="/etc/vexil")

    dark_mode = client.bool("dark-mode", default=False)
    rate_limit = client.int("api-rate-limit", default=100)
"""

from vexil.client import Client
from vexil.flag import Flag

__all__ = ["Client", "Flag"]
__version__ = "0.1.0"

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen, Request

from vexil.flag import Flag


class Client:
    """Vexil feature flag client.

    Args:
        provider: One of "env", "sidecar", or "configmap".
        address: Sidecar address (default "localhost:8514").
        path: ConfigMap mount path (default "/etc/vexil").
    """

    def __init__(
        self,
        provider: str = "env",
        address: str = "localhost:8514",
        path: str = "/etc/vexil",
    ):
        self._provider = provider
        self._address = address if "://" in address else f"http://{address}"
        self._path = Path(path)

    def bool(self, name: str, default: bool = False) -> bool:
        """Get a boolean flag value."""
        flag = self._get_flag(name)
        if flag is None or flag.disabled:
            return default
        return flag.value.lower() in ("true", "1", "yes")

    def string(self, name: str, default: str = "") -> str:
        """Get a string flag value."""
        flag = self._get_flag(name)
        if flag is None or flag.disabled:
            return default
        return flag.value

    def int(self, name: str, default: int = 0) -> int:
        """Get an integer flag value."""
        flag = self._get_flag(name)
        if flag is None or flag.disabled:
            return default
        try:
            return int(flag.value)
        except (ValueError, TypeError):
            return default

    def json(self, name: str) -> Any:
        """Get a JSON flag value, parsed."""
        flag = self._get_flag(name)
        if flag is None or flag.disabled:
            return None
        return json.loads(flag.value)

    def flag(self, name: str) -> Flag | None:
        """Get the raw Flag object."""
        return self._get_flag(name)

    def all_flags(self) -> list[Flag]:
        """Get all available flags."""
        if self._provider == "env":
            return self._all_env()
        elif self._provider == "sidecar":
            return self._all_sidecar()
        elif self._provider == "configmap":
            return self._all_configmap()
        return []

    def _get_flag(self, name: str) -> Flag | None:
        if self._provider == "env":
            return self._get_env(name)
        elif self._provider == "sidecar":
            return self._get_sidecar(name)
        elif self._provider == "configmap":
            return self._get_configmap(name)
        return None

    # --- Env Provider ---

    @staticmethod
    def _flag_name_to_env(name: str) -> str:
        return "FLAG_" + name.upper().replace("-", "_")

    def _get_env(self, name: str) -> Flag | None:
        env_name = self._flag_name_to_env(name)
        value = os.environ.get(env_name)
        if value is None:
            return None
        return Flag(name=name, value=value)

    def _all_env(self) -> list[Flag]:
        flags = []
        for key, value in os.environ.items():
            if key.startswith("FLAG_"):
                name = key[5:].lower().replace("_", "-")
                flags.append(Flag(name=name, value=value))
        return flags

    # --- Sidecar Provider ---

    def _get_sidecar(self, name: str) -> Flag | None:
        try:
            req = Request(f"{self._address}/flags/{name}")
            with urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read())
                    return Flag(
                        name=data["name"],
                        type=data.get("type", "string"),
                        value=data["value"],
                        disabled=data.get("disabled", False),
                    )
        except (URLError, json.JSONDecodeError, KeyError):
            pass
        return None

    def _all_sidecar(self) -> list[Flag]:
        try:
            req = Request(f"{self._address}/flags")
            with urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read())
                    return [
                        Flag(
                            name=f["name"],
                            type=f.get("type", "string"),
                            value=f["value"],
                            disabled=f.get("disabled", False),
                        )
                        for f in data
                    ]
        except (URLError, json.JSONDecodeError):
            pass
        return []

    # --- ConfigMap Provider ---

    def _get_configmap(self, name: str) -> Flag | None:
        if self._path.is_dir():
            flag_file = self._path / name
            if flag_file.is_file():
                return Flag(name=name, value=flag_file.read_text().strip())
            return None

        if self._path.is_file():
            try:
                data = json.loads(self._path.read_text())
                if name in data:
                    return Flag(name=name, value=str(data[name]))
            except (json.JSONDecodeError, KeyError):
                pass
        return None

    def _all_configmap(self) -> list[Flag]:
        if self._path.is_dir():
            flags = []
            for f in sorted(self._path.iterdir()):
                if f.is_file() and not f.name.startswith("."):
                    flags.append(Flag(name=f.name, value=f.read_text().strip()))
            return flags

        if self._path.is_file():
            try:
                data = json.loads(self._path.read_text())
                return [Flag(name=k, value=str(v)) for k, v in data.items()]
            except json.JSONDecodeError:
                pass
        return []

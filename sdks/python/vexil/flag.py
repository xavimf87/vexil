from dataclasses import dataclass


@dataclass
class Flag:
    """A resolved feature flag."""

    name: str
    type: str = "string"
    value: str = ""
    disabled: bool = False

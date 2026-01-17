"""
ULID utilities.
Provides a stable ULID generator across different `ulid` package variants.
"""

def new_ulid() -> str:
    """
    Return a ULID string using whichever `ulid` implementation is available.

    Supports:
      - ulid.new() (ulid-py)
      - ulid.ULID() (python-ulid)
    """
    try:
        from ulid import new as _new_ulid  # type: ignore
        return str(_new_ulid())
    except ImportError:
        try:
            from ulid import ULID as _ULID  # type: ignore
        except Exception as exc:
            raise RuntimeError(
                "ULID dependency is missing. Install 'ulid-py' or 'ulid'."
            ) from exc
        return str(_ULID())

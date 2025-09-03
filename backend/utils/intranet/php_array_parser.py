import re
from html import unescape
from typing import List, Dict, Any

__all__ = ["php_array_to_list"]

def _coerce_value(raw: str) -> Any:
    s = (raw or "").strip()
    # Unwrap single/double quotes
    if len(s) >= 2 and ((s[0] == '"' and s[-1] == '"') or (s[0] == "'" and s[-1] == "'")):
        s = s[1:-1]
    # HTML entities
    s = unescape(s)
    # Coerce null/boolean
    low = s.lower()
    if low in {"null", "none", "nil"}:
        return None
    if low in {"true", "t", "yes"}:
        return True
    if low in {"false", "f", "no"}:
        return False
    # Int or float
    if re.fullmatch(r"-?\d+", s):
        try:
            return int(s)
        except Exception:
            pass
    if re.fullmatch(r"-?\d+\.\d+", s):
        try:
            return float(s)
        except Exception:
            pass
    return s


def php_array_to_list(text: str) -> List[Dict[str, Any]]:
    """
    Parse a PHP-style Array dump like:
      Array ( [0] => Array ( [id] => 1 [name] => "Foo" ) [1] => Array ( ... ) )
    into a Python list of dicts.

    Returns [] if it cannot parse anything meaningful.
    """
    if not isinstance(text, str) or not text.strip():
        return []
    # Normalize whitespace to simplify regex
    s = " ".join(line.strip() for line in text.strip().splitlines())
    s = re.sub(r"\s+", " ", s)

    # Find entries: [index] => Array ( ... )
    entries = re.findall(r"\[(\d+)\]\s*=>\s*Array\s*\((.*?)\)\s*(?=\[\d+\]|\)\s*$)", s)
    result: List[Dict[str, Any]] = []
    for _, body in entries:
        item: Dict[str, Any] = {}
        # Inside body: [key] => value   ... until next [key] => or end )
        for k, v in re.findall(r"\[(.*?)\]\s*=>\s*(.*?)(?=\s*\[.*?\]\s*=>|\)\s*$)", body):
            key = str(k).strip()
            val = _coerce_value(v)
            item[key] = val
        if item:
            result.append(item)
    return result if result else []

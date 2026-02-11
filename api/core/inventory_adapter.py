from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from .canonicalizer import parse_ingredients


@dataclass
class InventoryItem:
    name: str
    canonical_name: str
    canonical_tokens: List[str] = None  # All canonical tokens (for matching)
    category: Optional[str] = None
    purchase_date: Optional[str] = None
    expiration_date: Optional[str] = None
    quantity: Optional[float] = None
    expires_in_days: Optional[int] = None
    is_expiring_soon: bool = False

    def __post_init__(self):
        if self.canonical_tokens is None:
            self.canonical_tokens = [self.canonical_name]


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    # Support multiple date formats from the frontend
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    # Last resort: try to extract just the date portion
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except (ValueError, IndexError):
        return None


def adapt_inventory(
    inventory: List[Dict[str, Any]],
    expiring_soon_days: int = 3,
    today: Optional[date] = None,
) -> List[InventoryItem]:
    """
    Convert raw inventory items into canonicalized inventory items.
    - canonical_name uses the same phrase-aware canonicalizer as recipes.
    - expiration fields are optional; degrade gracefully.
    """
    if today is None:
        today = date.today()

    out: List[InventoryItem] = []

    for item in inventory:
        name = (item.get("name") or "").strip()
        if not name:
            continue

        # parse_ingredients returns a list of canonical tokens.
        # For brand-name products (e.g. "Sargento Shredded Mozzarella"),
        # we keep ALL tokens so the actual ingredient ("mozzarella") is matched.
        tokens = parse_ingredients(name)
        canonical = tokens[0] if tokens else name.lower()
        all_tokens = tokens if tokens else [name.lower()]

        exp_date = _parse_date(item.get("expiration_date"))
        expires_in = (exp_date - today).days if exp_date else None
        is_soon = expires_in is not None and expires_in <= expiring_soon_days

        out.append(
            InventoryItem(
                name=name,
                canonical_name=canonical,
                canonical_tokens=all_tokens,
                category=item.get("category"),
                purchase_date=item.get("purchase_date"),
                expiration_date=item.get("expiration_date"),
                quantity=item.get("quantity"),
                expires_in_days=expires_in,
                is_expiring_soon=is_soon,
            )
        )

    return out
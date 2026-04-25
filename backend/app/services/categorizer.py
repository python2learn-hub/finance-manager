import re
from typing import Optional

RULES = [
    (r"uber|ola|cab", "Transport"),
    (r"zomato|swiggy", "Food"),
    (r"amazon|flipkart", "Shopping"),
    (r"electric|bescom|bills?", "Utilities"),
]

def categorize(narration: str, merchant: Optional[str] = None) -> Optional[str]:
    text = f"{merchant or ''} {narration or ''}".lower()
    for pattern, label in RULES:
        if re.search(pattern, text):
            return label
    return None

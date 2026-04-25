import re
from typing import Optional

RULES = [
    (r"uber|ola|cab", "Transport"),
    (r"metro|irctc|fuel|petrol|diesel|parking|toll", "Transport"),
    (r"zomato|swiggy|restaurant|cafe|coffee|food|dining", "Food"),
    (r"amazon|flipkart|myntra|ajio|shopping|store", "Shopping"),
    (r"electric|bescom|water|gas|bills?|utility|broadband|wifi|airtel|jio", "Utilities"),
    (r"netflix|prime|spotify|hotstar|bookmyshow|movie", "Entertainment"),
    (r"pharmacy|hospital|clinic|doctor|medical|health", "Healthcare"),
    (r"rent|maintenance|society", "Housing"),
    (r"salary|payroll|interest|dividend", "Income"),
    (r"upi|atm|cash withdrawal|transfer", "Transfers"),
]

def categorize(narration: str, merchant: Optional[str] = None) -> Optional[str]:
    text = f"{merchant or ''} {narration or ''}".lower()
    for pattern, label in RULES:
        if re.search(pattern, text):
            return label
    return None

import re
from typing import Optional

RULES = [
    (r"salary|payroll|dividend|interest|refund|cashback|ach c|neft cr", "Income", {"credit", None}),
    (r"indian clearing corp|iccl|zerodha|groww|upstox|mutual fund|stocks?|sip|broker", "Investments", {"debit", None}),
    (r"cred club|dreamplug|credit card|card payment", "Credit Card Payments", {"debit", None}),
    (r"policybazaar|insurance|premium", "Insurance", {"debit", None}),
    (r"metro|irctc|uber|ola|cab|makemytrip|travel|fuel|petrol|diesel|parking|toll|driving class", "Transport & Travel", {"debit", None}),
    (r"zepto|blinkit|bbnow|bigbasket|country delight|grocery|marketplace pr", "Groceries", {"debit", None}),
    (r"zomato|swiggy|domino|pizza|restaurant|cafe|coffee|dining|dhaba|haldiram|bikaner|burger|grill|sweet corner|compass india food|food", "Food & Dining", {"debit", None}),
    (r"jio|airtel|vi postpaid|prepaid recharge|postpaid|utility|electric|water|gas|broadband|wifi|google india digital", "Utilities", {"debit", None}),
    (r"rent|maintenance|society|furlenco|room rent", "Housing", {"debit", None}),
    (r"1mg|chemist|pharmacy|hospital|clinic|doctor|medical|healthcare|health", "Healthcare", {"debit", None}),
    (r"zudio|uniqlo|red tape|hennes|mauritz|apparel|clothes|fashion|shopping|amazon|flipkart|myntra|ajio|store", "Shopping", {"debit", None}),
    (r"netflix|prime|spotify|hotstar|bookmyshow|movie|googleplay|casino|game", "Entertainment", {"debit", None}),
    (r"school|college|ggsipu|education|course|tuition|stationary|prints", "Education", {"debit", None}),
    (r"atm|cash withdrawal|self - chq paid|chq paid", "Cash & ATM", {"debit", None}),
    (r"x{4,}|transfer|neft|imps|rtgs|sent using paytm|dcb bank|niyosa", "Transfers", {"debit", None}),
    (r"\bupi[-\s]", "Unclassified UPI", {"debit", None}),
]

def categorize(narration: str, merchant: Optional[str] = None, direction: Optional[str] = None) -> Optional[str]:
    text = f"{merchant or ''} {narration or ''}".lower()
    normalized_direction = direction.lower() if direction else None
    for pattern, label, directions in RULES:
        if normalized_direction not in directions:
            continue
        if re.search(pattern, text):
            return label
    if normalized_direction == "credit":
        return "Income"
    if normalized_direction == "debit":
        return "Miscellaneous"
    return None

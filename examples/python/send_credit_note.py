"""Send a credit note via the getpeppr API.

A credit note corrects or cancels a previous invoice.
It MUST reference the original invoice number.
Uses POST /v1/invoices/send with isCreditNote: true.
"""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

response = requests.post(
    f"{BASE_URL}/v1/invoices/send",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "isCreditNote": True,
        "number": "CN-2026-001",
        "invoiceReference": "INV-2026-042",
        "to": {
            "name": "Wayne Enterprises NV",
            "peppolId": "0208:BE0123456789",
            "street": "Avenue Louise 54",
            "city": "Brussels",
            "postalCode": "1050",
            "country": "BE",
        },
        "lines": [
            {
                "description": "Arc Reactor Maintenance Q1 — cancelled",
                "quantity": 1,
                "unitPrice": 50000,
                "vatRate": 21,
            },
        ],
        "paymentTerms": "Refund within 14 days",
        "paymentIban": "BE68539007547034",
    },
    timeout=30,
)

response.raise_for_status()
result = response.json()
print(f"Credit note sent: {result['id']}")

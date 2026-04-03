"""Send an invoice with document-level and line-level allowances/charges."""

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
        "number": "INV-2026-099",
        "to": {
            "name": "Wayne Enterprises NV",
            "peppolId": "0208:BE0123456789",
            "street": "Avenue Louise 54",
            "city": "Brussels",
            "postalCode": "1050",
            "country": "BE",
        },
        "buyerReference": "PO-2026-099",
        "lines": [
            {
                "description": "Arc Reactor Maintenance Q1",
                "quantity": 1,
                "unitPrice": 50000,
                "vatRate": 21,
                # Line-level discount
                "allowances": [{"reason": "Loyalty discount", "amount": 5000}],
            },
            {
                "description": "Vibranium Shield Polish",
                "quantity": 10,
                "unitPrice": 250,
                "vatRate": 21,
                # Line-level surcharge
                "charges": [{"reason": "Rush delivery fee", "amount": 100}],
            },
        ],
        # Document-level discount
        "allowances": [
            {
                "reason": "Volume discount (annual contract)",
                "amount": 1000,
                "vatRate": 21,
            }
        ],
        # Document-level surcharge
        "charges": [
            {
                "reason": "Hazardous materials handling",
                "amount": 500,
                "vatRate": 21,
            }
        ],
        "paymentTerms": "Net 30 days",
        "paymentIban": "BE68539007547034",
    },
    timeout=30,
)

response.raise_for_status()
result = response.json()
print(f"Sent! ID: {result['id']}, Status: {result['status']}")

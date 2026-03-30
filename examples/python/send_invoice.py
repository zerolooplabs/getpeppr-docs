"""Send a Peppol invoice via the getpeppr API."""

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
        "number": "INV-2026-042",
        "from": {
            "name": "Stark Industries BVBA",
            "peppolId": "0208:BE0476748862",
            "vatNumber": "BE0476748862",
            "address": {
                "street": "Rue de la Loi 1",
                "city": "Brussels",
                "postalCode": "1000",
                "country": "BE",
            },
        },
        "to": {
            "name": "Wayne Enterprises NV",
            "peppolId": "0208:BE0123456789",
            "street": "Avenue Louise 54",
            "city": "Brussels",
            "postalCode": "1050",
            "country": "BE",
        },
        "buyerReference": "PO-2026-007",
        "lines": [
            {
                "description": "Arc Reactor Maintenance Q1",
                "quantity": 1,
                "unitPrice": 50000,
                "vatRate": 21,
            },
            {
                "description": "Vibranium Shield Polish",
                "quantity": 3,
                "unitPrice": 250,
                "vatRate": 21,
            },
        ],
        "paymentTerms": "Net 30 days",
        "paymentIban": "BE68539007547034",
        "issueDate": "2026-03-01",
        "dueDate": "2026-03-31",
    },
    timeout=30,
)

response.raise_for_status()
result = response.json()
print(f"Sent! ID: {result['id']}, Status: {result['status']}")

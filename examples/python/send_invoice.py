"""Send a Peppol invoice via the getpeppr API."""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_live_xyz789..."

# Production example (live key, 21 % Belgian VAT): replace the buyer with your
# own customer before running it. The sandbox delivers only to the test
# receiver 9925:BE0314595348 — invoice_workflow.py is the version that runs there.

response = requests.post(
    f"{BASE_URL}/v1/invoices",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "number": "INV-2026-042",
        "to": {
            "name": "ACMEDIA",
            "peppolId": "0208:0685660237",
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
        "date": "2026-03-01",
        "dueDate": "2026-03-31",
    },
    timeout=30,
)

response.raise_for_status()
result = response.json()
print(f"Sent! ID: {result['id']}, Status: {result['status']}")

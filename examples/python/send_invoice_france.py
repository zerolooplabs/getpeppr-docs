"""Send a Peppol invoice to a French buyer via the getpeppr API.

Full France guide: https://getpeppr.dev/docs/france/
Route with the scheme the buyer actually registered:
  0009 = SIRET (14 digits)   0002 = SIREN (9 digits)   0225 = FR:CTC
French VAT rates: standard 20%, reduced 10% / 5.5% / 2.1%.
"""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

response = requests.post(
    f"{BASE_URL}/v1/invoices",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "number": "INV-2026-042",
        "to": {
            "name": "Stark Industries France SARL",
            "peppolId": "0009:90200000900008",  # SIRET routing
            "companyId": "902000009",  # SIREN (9 digits) or SIRET (14 digits)
            "vatNumber": "FR60902000009",  # FR + 2-char key + 9-digit SIREN
            "street": "10 Rue de la Paix",
            "city": "Paris",
            "postalCode": "75002",
            "country": "FR",
        },
        "buyerReference": "PO-2026-007",
        "lines": [
            {
                "description": "Arc Reactor Maintenance Q1",
                "quantity": 1,
                "unitPrice": 50000,
                "vatRate": 20,
            },
            {
                "description": "Technical Documentation",
                "quantity": 1,
                "unitPrice": 1200,
                "vatRate": 5.5,
            },
        ],
        "paymentTerms": "Net 30 days",
        "paymentIban": "FR1420041010050500013M02606",
        "date": "2026-03-01",
        "dueDate": "2026-03-31",
    },
    timeout=30,
)

response.raise_for_status()
result = response.json()
print(f"Sent! ID: {result['id']}, Status: {result['status']}")

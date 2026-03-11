"""Validate an invoice via the getpeppr API before sending."""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

response = requests.post(
    f"{BASE_URL}/v1/validate",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "number": "INV-2026-042",
        "from": {
            "name": "Acme BVBA",
            "peppolId": "0208:BE0456789012",
            "country": "BE",
        },
        "to": {
            "name": "Globex NV",
            "peppolId": "0208:BE0987654321",
            "country": "BE",
        },
        "lines": [
            {
                "description": "Consulting Q1",
                "quantity": 40,
                "unitPrice": 125,
                "vatRate": 21,
            },
        ],
    },
    timeout=30,
)

response.raise_for_status()
result = response.json()

if not result.get("valid"):
    for error in result.get("errors", []):
        print(f"[{error['field']}] {error['message']}")
        if error.get("suggestion"):
            print(f"  Tip: {error['suggestion']}")

for warning in result.get("warnings", []):
    print(f"Warning: [{warning['field']}] {warning['message']}")

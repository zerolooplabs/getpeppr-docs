"""Invoice lifecycle via the getpeppr API — draft, send, track, export."""

import time
import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


# -- Step 1: Create a draft invoice -------------------------------------------

response = requests.post(
    f"{BASE_URL}/v1/invoices",
    headers=HEADERS,
    json={
        "number": "INV-2026-100",
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
        "date": "2026-03-01",
        "dueDate": "2026-03-31",
    },
    timeout=30,
)
response.raise_for_status()
draft = response.json()
invoice_id = draft["id"]
print(f"Draft created: {invoice_id} (status: {draft['status']})")


# -- Step 2: Update the draft -------------------------------------------------

response = requests.put(
    f"{BASE_URL}/v1/invoices/{invoice_id}",
    headers=HEADERS,
    json={
        "note": "Thank you for your continued partnership!",
        "dueDate": "2026-04-15",
    },
    timeout=30,
)
response.raise_for_status()
updated = response.json()
print(f"Updated: due date is now {updated.get('dueDate')}")


# -- Step 3: Send the draft ----------------------------------------------------

response = requests.post(
    f"{BASE_URL}/v1/invoices/send/{invoice_id}",
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30,
)
response.raise_for_status()
print("Invoice sent!")


# -- Step 4: Poll for delivery status ------------------------------------------

for _ in range(20):  # poll up to 20 times (60 seconds)
    time.sleep(3)
    response = requests.get(
        f"{BASE_URL}/v1/invoices/{invoice_id}",
        headers={"Authorization": f"Bearer {API_KEY}"},
        timeout=30,
    )
    response.raise_for_status()
    status = response.json()
    print(f"Status: {status['status']}")

    if status["status"] in ("accepted", "rejected", "failed"):
        break


# -- Step 5: Export as PDF -----------------------------------------------------

response = requests.get(
    f"{BASE_URL}/v1/invoices/{invoice_id}/as/pdf",
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30,
)
response.raise_for_status()

with open("INV-2026-100.pdf", "wb") as f:
    f.write(response.content)
print(f"PDF saved ({len(response.content)} bytes)")


# -- Step 6: Mark as paid (optional) -------------------------------------------

response = requests.post(
    f"{BASE_URL}/v1/invoices/{invoice_id}/mark-as",
    headers=HEADERS,
    json={"state": "paid"},
    timeout=30,
)
response.raise_for_status()
result = response.json()
print(f"Marked as: {result['status']}")

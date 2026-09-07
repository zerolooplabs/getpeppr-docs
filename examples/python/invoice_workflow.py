"""Invoice workflow via the getpeppr API — send, track, export.

There are no drafts — invoices are submitted immediately to the Peppol network.
To correct an invoice, send a credit note instead.
"""

import time
import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


# -- Step 1: Send an invoice -----------------------------------------------------

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
result = response.json()
invoice_id = result["id"]
print(f"Invoice sent: {invoice_id} (status: {result['status']})")


# -- Step 2: Poll for delivery status --------------------------------------------

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

    if status["status"] in ("delivered", "accepted", "rejected", "failed", "no_action"):
        break


# -- Step 3: Export as PDF -------------------------------------------------------
# A PDF exists only when the access point rendered one for this document, and
# the sandbox rarely does. When there is none the endpoint answers 404 with the
# result code `invoices.export_format_unavailable` — it never substitutes the
# XML for the PDF you asked for. So ask for the UBL in a SECOND, explicit
# request, and give that file its own .xml name.

response = requests.get(
    f"{BASE_URL}/v1/invoices/{invoice_id}/as/pdf",
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30,
)

if response.status_code == 200:
    with open("INV-2026-100.pdf", "wb") as f:
        f.write(response.content)
    print(f"PDF saved ({len(response.content)} bytes)")
elif response.headers.get("Getpeppr-Result-Code") == "invoices.export_format_unavailable":
    fallback = requests.get(
        f"{BASE_URL}/v1/invoices/{invoice_id}/as/original",
        headers={"Authorization": f"Bearer {API_KEY}"},
        timeout=30,
    )
    fallback.raise_for_status()
    with open("INV-2026-100-original.xml", "wb") as f:
        f.write(fallback.content)
    print("No PDF for this document — saved the UBL XML as INV-2026-100-original.xml")
else:
    # Fail rather than guess. A 404 for an invoice that does not exist carries
    # `invoices.not_found`, and asking for its XML would only earn a second 404.
    # A missing PDF can also land here — a proxy that strips unknown headers
    # takes the result code away — and that is the trade: raising on a response
    # we cannot classify is safe, saving a file we cannot name is not.
    response.raise_for_status()

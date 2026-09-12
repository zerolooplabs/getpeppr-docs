"""Peppol directory lookup — check if a business is on the Peppol network."""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

HEADERS = {"Authorization": f"Bearer {API_KEY}"}


# -- Lookup by Peppol ID (scheme 0208 = Belgian KBO/BCE) ---------------------

response = requests.get(
    f"{BASE_URL}/v1/directory/0208/BE0123456789",
    headers=HEADERS,
    timeout=30,
)

if response.status_code == 200:
    participant = response.json()
    print(f"Found: {participant['name']}")
    print(f"Country: {participant['country']}")
    print(f"Capabilities: {', '.join(participant['capabilities'])}")
    # Enriched fields (optional — available when the directory provides them)
    if participant.get("registrationDate"):
        print(f"Registered: {participant['registrationDate']}")
    if participant.get("vatNumber"):
        print(f"VAT: {participant['vatNumber']}")
    if participant.get("website"):
        print(f"Website: {participant['website']}")
    if participant.get("contactInfo"):
        print(f"Contact: {participant['contactInfo']}")
    if participant.get("additionalIds"):
        print(f"Additional IDs: {participant['additionalIds']}")
elif response.status_code == 404:
    print("Participant not found on Peppol network")
else:
    response.raise_for_status()


# -- Verify before sending ---------------------------------------------------

buyer_peppol_id = "0208:BE0987654321"
scheme, identifier = buyer_peppol_id.split(":")

response = requests.get(
    f"{BASE_URL}/v1/directory/{scheme}/{identifier}",
    headers=HEADERS,
    timeout=30,
)

if response.status_code == 200:
    buyer = response.json()
    print(f"Recipient found: {buyer['name']}; invoice validation still applies")
elif response.status_code == 404:
    print(f"Recipient {buyer_peppol_id} is not reachable on Peppol")
else:
    response.raise_for_status()


# -- Search the Peppol Directory -----------------------------------------------

# Search by name and country
response = requests.get(
    f"{BASE_URL}/v1/directory/search",
    params={"name": "Acme", "country": "BE", "limit": 10},
    headers=HEADERS,
    timeout=30,
)
response.raise_for_status()
data = response.json()
print(f"Found {data['meta']['total_count']} participants")
for entry in data["data"]:
    print(f"  {entry['name']} ({entry['peppolId']}) — {entry['country']}")
    print(f"  Capabilities: {', '.join(entry['capabilities'])}")
    if entry.get("registrationDate"):
        print(f"  Registered: {entry['registrationDate']}")

# Search by VAT number (country prefix stripped server-side)
response = requests.get(
    f"{BASE_URL}/v1/directory/search",
    params={"vatNumber": "BE0685660237"},
    headers=HEADERS,
    timeout=30,
)
response.raise_for_status()
vat_data = response.json()
print(f"VAT search found {vat_data['meta']['total_count']} results")


# -- Pre-send recipient validation ---------------------------------------------

# This sends an invoice when all checks pass. Replace the example recipient and
# invoice details with your own; use an approved test recipient in sandbox.
# Strict mode rejects a recipient absent from the Peppol Directory.
invoice_data = {
    "number": "INV-2026-001",
    "buyerReference": "PO-2026-001",
    "to": {
        "name": "Globex NV",
        "peppolId": buyer_peppol_id,
        "street": "Rue de la Loi 200",
        "city": "Brussels",
        "postalCode": "1000",
        "country": "BE",
    },
    "lines": [{"description": "Consulting", "quantity": 1, "unitPrice": 1000, "vatRate": 21}],
}
response = requests.post(
    f"{BASE_URL}/v1/invoices",
    json=invoice_data,
    headers={**HEADERS, "x-validate-recipient": "strict"},
    timeout=30,
)
if (
    response.status_code == 422
    and response.headers.get("Getpeppr-Result-Code") == "invoices.recipient_not_in_directory"
):
    print("Recipient not found in Peppol Directory")
else:
    # Other validation failures, rate limits and authentication errors are not
    # evidence that a recipient is missing. Preserve those errors for the caller.
    response.raise_for_status()
    print(f"Invoice submitted: {response.json()['id']}")

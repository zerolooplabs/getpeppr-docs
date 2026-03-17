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
    print(f"Recipient verified: {buyer['name']} — safe to send")
else:
    print(f"Recipient {buyer_peppol_id} is not reachable on Peppol")


# -- Search the Peppol Directory -----------------------------------------------

# Search by name and country
response = requests.get(
    f"{BASE_URL}/v1/directory/search",
    params={"name": "Acme", "country": "BE", "limit": 10},
    headers=HEADERS,
    timeout=30,
)
data = response.json()
print(f"Found {data['meta']['totalCount']} participants")
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
vat_data = response.json()
print(f"VAT search found {vat_data['meta']['totalCount']} results")


# -- Pre-send recipient validation ---------------------------------------------

# Strict mode — fails if recipient not on Peppol network
invoice_data = {"number": "INV-2026-001"}  # ... full invoice payload
response = requests.post(
    f"{BASE_URL}/v1/invoices",
    json=invoice_data,
    headers={**HEADERS, "x-validate-recipient": "strict"},
    timeout=30,
)
if response.status_code == 422:
    print("Recipient not found in Peppol Directory")

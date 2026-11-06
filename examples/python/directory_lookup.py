"""Peppol directory lookup — find the businesses listed in the Peppol Directory.

The Directory is a public LISTING refreshed on its own schedule: it can lag the
network by a day, and these calls read the PRODUCTION Directory whatever your
key's environment. To check that a send can be routed, send with the
x-validate-recipient header (last section), which asks the SML.

GET /v1/directory/{scheme}/{id} answers {"participant": {...}} — the participant
is nested, not the top-level object. The TypeScript example reads the participant
directly because the SDK unwraps it; raw HTTP, as used here, does not.
"""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

HEADERS = {"Authorization": f"Bearer {API_KEY}"}


# -- Lookup by Peppol ID (scheme 9925 = Belgian VAT) ---------------------

response = requests.get(
    f"{BASE_URL}/v1/directory/9925/BE0314595348",
    headers=HEADERS,
    timeout=30,
)

if response.status_code == 200:
    participant = response.json()["participant"]
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
    print("Participant not listed in the Peppol Directory")
else:
    response.raise_for_status()


# -- Look up the recipient before sending ------------------------------------
# Use the listing to fill in what you show, never as the go/no-go: a recipient
# registered since yesterday may not be listed yet, and a sandbox legal entity
# never is. The send below decides with x-validate-recipient, which asks the SML.

buyer_peppol_id = "9925:BE0314595348"
scheme, identifier = buyer_peppol_id.split(":")

response = requests.get(
    f"{BASE_URL}/v1/directory/{scheme}/{identifier}",
    headers=HEADERS,
    timeout=30,
)

if response.status_code == 200:
    buyer = response.json()["participant"]
    print(f"Listed in the Peppol Directory: {buyer['name']}")
elif response.status_code == 404:
    print(f"{buyer_peppol_id} is not listed in the Peppol Directory; it may still be on the network")
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
# x-validate-recipient asks the SML (the registry every access point routes by)
# of your key's network, not the Peppol Directory searched above, which can lag
# the network by a day. Strict mode sends nothing when the SML has no record; the
# result code keeps its historical name.
invoice_data = {
    "number": "INV-2026-001",
    "buyerReference": "PO-2026-001",
    "to": {
        "name": "SPF Economie (test receiver)",
        "peppolId": buyer_peppol_id,
        "street": "Rue du Progrès 50",
        "city": "Brussels",
        "postalCode": "1210",
        "country": "BE",
    },
    "lines": [{"description": "Consulting", "quantity": 1, "unitPrice": 1000, "vatRate": 0, "vatCategory": "O"}],
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
    print("Recipient not found on the Peppol network (no SML record)")
else:
    # Other validation failures, rate limits and authentication errors are not
    # evidence that a recipient is missing. Preserve those errors for the caller.
    response.raise_for_status()
    print(f"Invoice submitted: {response.json()['id']}")

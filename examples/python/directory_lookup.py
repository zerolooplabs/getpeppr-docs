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

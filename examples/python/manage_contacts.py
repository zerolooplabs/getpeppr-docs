"""Contact management via the getpeppr API — full CRUD example."""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


# -- Create a contact --------------------------------------------------------

response = requests.post(
    f"{BASE_URL}/v1/contacts",
    headers=HEADERS,
    json={
        "name": "Wayne Enterprises NV",
        "peppolId": "0208:BE0123456789",
        "vatNumber": "BE0123456789",
        "country": "BE",
        "city": "Gotham",
        "postalCode": "1000",
        "street": "Wayne Tower, 1 Park Row",
        "email": "accounts@wayne-enterprises.be",
        "isClient": True,
    },
    timeout=30,
)
response.raise_for_status()
contact = response.json()
contact_id = contact["id"]
print(f"Created contact: {contact_id} — {contact['name']}")


# -- List contacts ------------------------------------------------------------

response = requests.get(
    f"{BASE_URL}/v1/contacts",
    headers={"Authorization": f"Bearer {API_KEY}"},
    params={"limit": 20, "offset": 0},
    timeout=30,
)
response.raise_for_status()
result = response.json()

print(f"Found {result['meta']['total']} contacts")
for c in result["data"]:
    print(f"  {c['id']}: {c['name']} ({c.get('peppolId', 'N/A')})")


# -- Get a single contact -----------------------------------------------------

response = requests.get(
    f"{BASE_URL}/v1/contacts/{contact_id}",
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30,
)
response.raise_for_status()
fetched = response.json()
print(f"Fetched: {fetched['name']}, email: {fetched.get('email')}")


# -- Update a contact ---------------------------------------------------------

response = requests.put(
    f"{BASE_URL}/v1/contacts/{contact_id}",
    headers=HEADERS,
    json={
        "email": "invoicing@wayne-enterprises.be",
        "street": "Wayne Tower, 2 Park Row",
    },
    timeout=30,
)
response.raise_for_status()
updated = response.json()
print(f"Updated email: {updated['email']}")


# -- Delete a contact ---------------------------------------------------------

response = requests.delete(
    f"{BASE_URL}/v1/contacts/{contact_id}",
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30,
)
response.raise_for_status()
print(f"Contact {contact_id} deleted")

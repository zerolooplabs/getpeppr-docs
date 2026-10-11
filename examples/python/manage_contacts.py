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
        "name": "SPF Economie (test receiver)",
        "peppolId": "9925:BE0314595348",
        "vatNumber": "BE0314595348",
        "country": "BE",
        "city": "Brussels",
        "postalCode": "1210",
        "street": "Rue du Progrès 50",
        "email": "billing@example.com",
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

print(f"Found {result['meta']['total_count']} contacts")
for c in result["contacts"]:
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
        "email": "invoicing@example.com",
        "street": "Rue du Progrès 50, Floor 2",
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

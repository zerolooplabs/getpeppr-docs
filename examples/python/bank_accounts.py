"""Bank account management via the getpeppr API — full CRUD example."""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


# -- Create a bank account ---------------------------------------------------

response = requests.post(
    f"{BASE_URL}/v1/bank-accounts",
    headers=HEADERS,
    json={
        "name": "Stark Industries EUR",
        "iban": "BE68539007547034",
        "bic": "BPOTBEB1",
        "country": "BE",
    },
    timeout=30,
)
response.raise_for_status()
account = response.json()
account_id = account["id"]
print(f"Created: {account_id} — {account['name']}")


# -- List bank accounts ------------------------------------------------------

response = requests.get(
    f"{BASE_URL}/v1/bank-accounts",
    headers={"Authorization": f"Bearer {API_KEY}"},
    params={"limit": 20, "offset": 0},
    timeout=30,
)
response.raise_for_status()
result = response.json()

print(f"Found {result['meta']['total']} bank accounts")
for ba in result["data"]:
    print(f"  {ba['id']}: {ba['name']} ({ba.get('iban', ba.get('number', 'N/A'))})")


# -- Get a single bank account -----------------------------------------------

response = requests.get(
    f"{BASE_URL}/v1/bank-accounts/{account_id}",
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30,
)
response.raise_for_status()
fetched = response.json()
print(f"Fetched: {fetched['name']}, IBAN: {fetched.get('iban')}")


# -- Update a bank account ---------------------------------------------------

response = requests.put(
    f"{BASE_URL}/v1/bank-accounts/{account_id}",
    headers=HEADERS,
    json={"name": "Stark Industries — Primary EUR"},
    timeout=30,
)
response.raise_for_status()
updated = response.json()
print(f"Updated name: {updated['name']}")


# -- Delete a bank account ---------------------------------------------------

response = requests.delete(
    f"{BASE_URL}/v1/bank-accounts/{account_id}",
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30,
)
response.raise_for_status()
print(f"Bank account {account_id} deleted")

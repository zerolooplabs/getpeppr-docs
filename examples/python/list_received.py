"""List your invoices via the getpeppr API."""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

response = requests.get(
    f"{BASE_URL}/v1/invoices",
    headers={"Authorization": f"Bearer {API_KEY}"},
    params={"limit": 10, "offset": 0},
    timeout=30,
)

response.raise_for_status()
result = response.json()

print(f"Total invoices: {result['meta']['total']} (showing {len(result['data'])})")

for invoice in result["data"]:
    print(f"  {invoice['id']}: {invoice['number']} — {invoice['status']}")

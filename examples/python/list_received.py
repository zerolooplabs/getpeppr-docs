"""List received invoices from your Peppol inbox."""

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
invoices = response.json()

for doc in invoices:
    print(f"From:     {doc['invoice']['from']['name']}")
    print(f"Invoice:  {doc['invoice']['number']}")
    print(f"Received: {doc['receivedAt']}")
    print(f"Lines:    {len(doc['invoice']['lines'])}")
    print("---")

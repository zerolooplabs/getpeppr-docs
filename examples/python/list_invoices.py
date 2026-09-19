"""List your sent invoices via the getpeppr API.

Note: GET /v1/invoices returns outbound submissions only (invoices you sent).

The response shape is {"invoices": [...], "meta": {...}}. Items carry
"invoiceNumber" (not "number"); "meta" uses snake_case ("total_count").
The TypeScript example reads page.data / invoice.number because the SDK maps
those names — raw HTTP, as used here, does not.
"""

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

print(f"Total invoices: {result['meta']['total_count']} (showing {len(result['invoices'])})")

for invoice in result["invoices"]:
    print(f"  {invoice['id']}: {invoice['invoiceNumber']} — {invoice['status']}")

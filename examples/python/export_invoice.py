"""Export a sent invoice as PDF, UBL XML, or JSON."""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

HEADERS = {"Authorization": f"Bearer {API_KEY}"}

invoice_id = "inv_abc123"


# -- Export as PDF ------------------------------------------------------------

response = requests.get(
    f"{BASE_URL}/v1/invoices/{invoice_id}/as/pdf",
    headers=HEADERS,
    timeout=30,
)
response.raise_for_status()

with open("invoice.pdf", "wb") as f:
    f.write(response.content)
print("Saved invoice.pdf")


# -- Export as UBL XML (BIS 3.0) ---------------------------------------------

response = requests.get(
    f"{BASE_URL}/v1/invoices/{invoice_id}/as/xml.ubl.invoice.bis3",
    headers=HEADERS,
    timeout=30,
)
response.raise_for_status()

with open("invoice.xml", "w") as f:
    f.write(response.text)
print("Saved invoice.xml")


# -- Export as JSON -----------------------------------------------------------

response = requests.get(
    f"{BASE_URL}/v1/invoices/{invoice_id}/as/original",
    headers=HEADERS,
    timeout=30,
)
response.raise_for_status()

with open("invoice.json", "w") as f:
    f.write(response.text)
print("Saved invoice.json")

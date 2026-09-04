"""Export a sent invoice as PDF or UBL XML."""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

HEADERS = {"Authorization": f"Bearer {API_KEY}"}

invoice_id = "inv_abc123"


# -- Export as PDF ------------------------------------------------------------
# /as/pdf returns the PDF only when the provider produced one. Otherwise it
# responds 200 with the original UBL XML — check the Content-Type before
# naming the file, or you will save XML with a .pdf extension.

response = requests.get(
    f"{BASE_URL}/v1/invoices/{invoice_id}/as/pdf",
    headers=HEADERS,
    timeout=30,
)
response.raise_for_status()

if response.headers.get("Content-Type", "").startswith("application/pdf"):
    with open("invoice.pdf", "wb") as f:
        f.write(response.content)
    print("Saved invoice.pdf")
else:
    with open("invoice-original.xml", "w") as f:
        f.write(response.text)
    print("No PDF yet — saved the UBL XML as invoice-original.xml instead")


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


# -- Export the document as transmitted (UBL XML, SBDH envelope included) ------
# There is no JSON export: what left for the network is XML. The REST API also
# serves /as/payload — the same document without the SBDH envelope.

response = requests.get(
    f"{BASE_URL}/v1/invoices/{invoice_id}/as/original",
    headers=HEADERS,
    timeout=30,
)
response.raise_for_status()

with open("invoice-transmitted.xml", "w") as f:
    f.write(response.text)
print("Saved invoice-transmitted.xml")

"""Export a sent invoice as PDF or UBL XML."""

import requests

BASE_URL = "https://api.getpeppr.dev"
API_KEY = "sk_sandbox_abc123..."

HEADERS = {"Authorization": f"Bearer {API_KEY}"}

invoice_id = "inv_abc123"


# -- Export as PDF ------------------------------------------------------------
# A PDF exists only when the access point rendered one for this document, and
# the sandbox rarely does. When there is none the endpoint answers 404 with the
# result code `invoices.export_format_unavailable` — it never substitutes the
# XML for the PDF you asked for. So ask for the UBL in a SECOND, explicit
# request, and give that file its own .xml name.

response = requests.get(
    f"{BASE_URL}/v1/invoices/{invoice_id}/as/pdf",
    headers=HEADERS,
    timeout=30,
)

if response.status_code == 200:
    with open("invoice.pdf", "wb") as f:
        f.write(response.content)
    print("Saved invoice.pdf")
elif response.headers.get("Getpeppr-Result-Code") == "invoices.export_format_unavailable":
    fallback = requests.get(
        f"{BASE_URL}/v1/invoices/{invoice_id}/as/original",
        headers=HEADERS,
        timeout=30,
    )
    fallback.raise_for_status()
    with open("invoice-original.xml", "wb") as f:
        f.write(fallback.content)
    print("No PDF for this document — saved the UBL XML as invoice-original.xml")
else:
    # Anything else is not a missing PDF. A 404 for an invoice that does not
    # exist carries `invoices.not_found`, and asking for its XML would only earn
    # a second 404.
    response.raise_for_status()


# -- Export as UBL XML (BIS 3.0) ---------------------------------------------

response = requests.get(
    f"{BASE_URL}/v1/invoices/{invoice_id}/as/xml.ubl.invoice.bis3",
    headers=HEADERS,
    timeout=30,
)
response.raise_for_status()

with open("invoice.xml", "wb") as f:
    f.write(response.content)
print("Saved invoice.xml")


# -- Export the document as transmitted (UBL XML, SBDH envelope included) ------
# There is no JSON export: what left for the network is XML. `/as/payload`
# returns the same document with the SBDH envelope stripped.

response = requests.get(
    f"{BASE_URL}/v1/invoices/{invoice_id}/as/original",
    headers=HEADERS,
    timeout=30,
)
response.raise_for_status()

with open("invoice-transmitted.xml", "wb") as f:
    f.write(response.content)
print("Saved invoice-transmitted.xml")

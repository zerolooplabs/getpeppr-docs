/**
 * Invoice Export Example
 *
 * Export a sent invoice as PDF or UBL XML.
 */

import { Peppol, PeppolApiError } from "@getpeppr/sdk";
import { writeFile } from "node:fs/promises";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

const invoiceId = "inv_abc123";

// ── Export as PDF ─────────────────────────────────────────
// A PDF exists only when the access point rendered one for this document, and
// the sandbox rarely does. When there is none the endpoint answers 404 with the
// result code `invoices.export_format_unavailable` — it never substitutes the
// XML for the PDF you asked for. So there is nothing to sniff: ask for the UBL
// in a SECOND, explicit request, and give that file its own .xml name.

try {
  const pdf = await peppol.invoices.getAs(invoiceId, "pdf");
  await writeFile("invoice.pdf", Buffer.from(pdf));
  console.log("Saved invoice.pdf");
} catch (err) {
  // Re-throw anything else. A 404 for an invoice that does not exist carries
  // `invoices.not_found`, not this code — asking for its XML would only earn a
  // second 404, and swallowing the difference would hide a wrong id.
  if (!(err instanceof PeppolApiError) || err.resultCode !== "invoices.export_format_unavailable") {
    throw err;
  }

  const xml = await peppol.invoices.getAs(invoiceId, "original");
  await writeFile("invoice-original.xml", Buffer.from(xml));
  console.log("No PDF for this document — saved the UBL XML as invoice-original.xml");
}

// ── Export as UBL XML (BIS 3.0) ───────────────────────────

const xml = await peppol.invoices.getAs(invoiceId, "xml.ubl.invoice.bis3");
await writeFile("invoice.xml", Buffer.from(xml));
console.log("Saved invoice.xml");

// ── Export the document as transmitted (UBL XML, SBDH envelope included) ──
// There is no JSON export: what left for the network is XML. `payload` returns
// the same document with the SBDH envelope stripped.

const original = await peppol.invoices.getAs(invoiceId, "original");
await writeFile("invoice-transmitted.xml", Buffer.from(original));
console.log("Saved invoice-transmitted.xml");

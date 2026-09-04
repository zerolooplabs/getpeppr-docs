/**
 * Invoice Export Example
 *
 * Export a sent invoice as PDF or UBL XML.
 */

import { Peppol } from "@getpeppr/sdk";
import { writeFile } from "node:fs/promises";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

const invoiceId = "inv_abc123";

// ── Export as PDF ─────────────────────────────────────────
// /as/pdf returns the PDF only when the provider produced one — otherwise the
// original UBL XML comes back instead. The REST contract says to check the
// Content-Type, but getAs() hands you raw bytes without the header: look at
// the leading marker instead — a PDF starts with "%PDF-".

const pdf = await peppol.invoices.getAs(invoiceId, "pdf");
const pdfBytes = Buffer.from(pdf); // getAs() returns an ArrayBuffer
if (pdfBytes.subarray(0, 5).toString("latin1") === "%PDF-") {
  await writeFile("invoice.pdf", pdfBytes);
  console.log("Saved invoice.pdf");
} else {
  await writeFile("invoice-original.xml", pdfBytes);
  console.log("No PDF yet — saved the UBL XML as invoice-original.xml instead");
}

// ── Export as UBL XML (BIS 3.0) ───────────────────────────

const xml = await peppol.invoices.getAs(invoiceId, "xml.ubl.invoice.bis3");
await writeFile("invoice.xml", Buffer.from(xml));
console.log("Saved invoice.xml");

// ── Export the document as transmitted (UBL XML, SBDH envelope included) ──
// There is no JSON export: what left for the network is XML. The REST API also
// serves /as/payload — the same document without the SBDH envelope — which the
// SDK's DocumentFormat type does not yet list.

const original = await peppol.invoices.getAs(invoiceId, "original");
await writeFile("invoice-transmitted.xml", Buffer.from(original));
console.log("Saved invoice-transmitted.xml");

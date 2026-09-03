/**
 * Invoice Export Example
 *
 * Export a sent invoice as PDF, UBL XML, or JSON.
 */

import { Peppol } from "@getpeppr/sdk";
import { writeFile } from "node:fs/promises";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

const invoiceId = "inv_abc123";

// ── Export as PDF ─────────────────────────────────────────

const pdf = await peppol.invoices.getAs(invoiceId, "pdf");
await writeFile("invoice.pdf", Buffer.from(pdf)); // getAs() returns an ArrayBuffer
console.log("Saved invoice.pdf");

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

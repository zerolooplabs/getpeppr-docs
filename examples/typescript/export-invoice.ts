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
await writeFile("invoice.pdf", pdf);
console.log("Saved invoice.pdf");

// ── Export as UBL XML (BIS 3.0) ───────────────────────────

const xml = await peppol.invoices.getAs(invoiceId, "xml.ubl.invoice.bis3");
await writeFile("invoice.xml", xml);
console.log("Saved invoice.xml");

// ── Export as JSON ─────────────────────────────────────────

const json = await peppol.invoices.getAs(invoiceId, "original");
await writeFile("invoice.json", json);
console.log("Saved invoice.json");

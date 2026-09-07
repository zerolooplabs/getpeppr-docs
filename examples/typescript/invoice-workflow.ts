/**
 * Invoice Workflow Example
 *
 * Demonstrates the real invoice workflow:
 *   send → track status → export PDF
 *
 * There are no drafts — invoices are submitted immediately to the Peppol network.
 * To correct an invoice, send a credit note instead.
 */

import { Peppol, PeppolApiError } from "@getpeppr/sdk";
import { writeFileSync } from "fs";

const peppol = new Peppol({ apiKey: "sk_sandbox_abc123..." });

// -- Step 1: Send an invoice ----------------------------------------------------

const result = await peppol.invoices.send({
  number: "INV-2026-100",

  to: {
    name: "Wayne Enterprises NV",
    peppolId: "0208:BE0123456789",
    street: "Avenue Louise 54",
    city: "Brussels",
    postalCode: "1050",
    country: "BE",
  },
  buyerReference: "PO-2026-007",

  lines: [
    { description: "Arc Reactor Maintenance Q1", quantity: 1, unitPrice: 50_000, vatRate: 21 },
    { description: "Vibranium Shield Polish", quantity: 3, unitPrice: 250, vatRate: 21 },
  ],

  paymentTerms: "Net 30 days",
  paymentIban: "BE68539007547034",
  date: "2026-03-01",
  dueDate: "2026-03-31",
});

console.log(`Invoice sent: ${result.id} (status: ${result.status})`);

// -- Step 2: Track delivery status ----------------------------------------------

// Option A: Poll manually
const status = await peppol.invoices.getStatus(result.id);
console.log(`Current status: ${status.status}`);

// Option B: Wait until delivered (with timeout)
const final = await peppol.invoices.waitFor(result.id, "delivered", {
  interval: 3000,   // poll every 3 seconds
  timeout: 120_000, // give up after 2 minutes
});
console.log(`Final status: ${final.status}`);

// -- Step 3: Export as PDF ------------------------------------------------------
// A PDF exists only when the access point rendered one for this document, and
// the sandbox rarely does. When there is none the endpoint answers 404 with the
// result code `invoices.export_format_unavailable` — it never substitutes the
// XML for the PDF you asked for. So ask for the UBL in a SECOND, explicit
// request, and give that file its own .xml name.

try {
  const pdfBytes = Buffer.from(await peppol.invoices.getAs(result.id, "pdf"));
  writeFileSync("INV-2026-100.pdf", pdfBytes);
  console.log(`PDF saved (${pdfBytes.byteLength} bytes)`);
} catch (err) {
  // Re-throw anything else. A 404 for an invoice that does not exist carries
  // `invoices.not_found`, not this code.
  if (!(err instanceof PeppolApiError) || err.resultCode !== "invoices.export_format_unavailable") {
    throw err;
  }

  const xmlBytes = Buffer.from(await peppol.invoices.getAs(result.id, "original"));
  writeFileSync("INV-2026-100-original.xml", xmlBytes);
  console.log("No PDF for this document — saved the UBL XML as INV-2026-100-original.xml");
}

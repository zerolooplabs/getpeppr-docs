/**
 * Invoice Lifecycle Example
 *
 * Demonstrates the full invoice lifecycle:
 *   create draft → review → update → send → track status → export PDF
 */

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_abc123..." });

// ── Step 1: Create a draft invoice ──────────────────────────

const draft = await peppol.invoices.create({
  number: "INV-2026-100",

  from: {
    name: "Stark Industries BVBA",
    peppolId: "0208:BE0476748862",
    vatNumber: "BE0476748862",
    address: { street: "Rue de la Loi 1", city: "Brussels", postalCode: "1000", country: "BE" },
  },
  to: {
    name: "Wayne Enterprises NV",
    peppolId: "0208:BE0123456789",
    country: "BE",
    buyerReference: "PO-2026-007",
  },

  lines: [
    { description: "Arc Reactor Maintenance Q1", quantity: 1, unitPrice: 50_000, vatRate: 21 },
    { description: "Vibranium Shield Polish", quantity: 3, unitPrice: 250, vatRate: 21 },
  ],

  paymentTerms: "Net 30 days",
  paymentIban: "BE68539007547034",
  issueDate: "2026-03-01",
  dueDate: "2026-03-31",
});

console.log(`Draft created: ${draft.id} (status: ${draft.status})`);
// → "created"

// ── Step 2: Update the draft (e.g., add a note) ────────────

const updated = await peppol.invoices.update(draft.id, {
  note: "Thank you for your continued partnership!",
  dueDate: "2026-04-15",
});

console.log(`Updated: due date is now ${updated.dueDate}`);

// ── Step 3: Send the draft ──────────────────────────────────

await peppol.invoices.sendById(draft.id);
console.log("Invoice sent!");

// ── Step 4: Track delivery status ───────────────────────────

// Option A: Poll manually
const status = await peppol.invoices.getStatus(draft.id);
console.log(`Current status: ${status.status}`);

// Option B: Wait until accepted (with timeout)
const final = await peppol.invoices.waitFor(draft.id, "accepted", {
  interval: 3000,   // poll every 3 seconds
  timeout: 120_000, // give up after 2 minutes
});
console.log(`Final status: ${final.status}`);

// ── Step 5: Export as PDF ───────────────────────────────────

const pdfBuffer = await peppol.invoices.getAs(draft.id, "pdf");
console.log(`PDF size: ${pdfBuffer.byteLength} bytes`);

// Save to file (Node.js)
import { writeFileSync } from "fs";
writeFileSync(`INV-2026-100.pdf`, Buffer.from(pdfBuffer));
console.log("PDF saved to INV-2026-100.pdf");

// ── Step 6: Mark as paid (optional) ─────────────────────────

const paid = await peppol.invoices.markAs(draft.id, "paid");
console.log(`Marked as: ${paid.status}`);

/**
 * Send Credit Note Example
 *
 * A credit note corrects or cancels a previous invoice.
 * It MUST reference the original invoice number.
 *
 * Credit notes use invoices.send() with isCreditNote: true.
 */

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_live_..." });

// Production example (live key, 21 % Belgian VAT): replace the buyer with your
// own customer before running it. The sandbox delivers only to the test
// receiver 9925:BE0314595348 — invoice-workflow.ts is the version that runs there.

const creditNote = await peppol.invoices.send({
  isCreditNote: true,
  number: "CN-2026-001",
  invoiceReference: "INV-2026-042",  // required — the invoice being corrected

  to: { name: "ACMEDIA", peppolId: "0208:0685660237", street: "Avenue Louise 54", city: "Brussels", postalCode: "1050", country: "BE" },

  lines: [
    { description: "Arc Reactor Maintenance Q1 — cancelled", quantity: 1, unitPrice: 50_000, vatRate: 21 },
  ],

  paymentTerms: "Refund within 14 days",
  paymentIban: "BE68539007547034",
});

console.log(`Credit note sent: ${creditNote.id}`);

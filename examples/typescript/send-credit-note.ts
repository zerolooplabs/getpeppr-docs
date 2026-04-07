/**
 * Send Credit Note Example
 *
 * A credit note corrects or cancels a previous invoice.
 * It MUST reference the original invoice number.
 *
 * Credit notes use invoices.send() with isCreditNote: true.
 */

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

const creditNote = await peppol.invoices.send({
  isCreditNote: true,
  number: "CN-2026-001",
  invoiceReference: "INV-2026-042",  // required — the invoice being corrected

  to: { name: "Wayne Enterprises NV", peppolId: "0208:BE0123456789", street: "Avenue Louise 54", city: "Brussels", postalCode: "1050", country: "BE" },

  lines: [
    { description: "Arc Reactor Maintenance Q1 — cancelled", quantity: 1, unitPrice: 50_000, vatRate: 21 },
  ],

  paymentTerms: "Refund within 14 days",
  paymentIban: "BE68539007547034",
});

console.log(`Credit note sent: ${creditNote.id}`);

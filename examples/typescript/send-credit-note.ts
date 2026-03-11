import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "pk_live_..." });

// A credit note MUST reference the original invoice
const creditNote = await peppol.creditNotes.send({
  number: "CN-2026-001",
  invoiceReference: "INV-2026-042",  // required

  from: { name: "Stark Industries BVBA", peppolId: "0208:BE0476748862", country: "BE" },
  to:   { name: "Wayne Enterprises NV",  peppolId: "0208:BE0123456789", country: "BE" },

  lines: [
    { description: "Arc Reactor Maintenance Q1 — cancelled", quantity: 1, unitPrice: 50_000, vatRate: 21 },
  ],

  paymentTerms: "Refund within 14 days",
  paymentIban: "BE68539007547034",
});

console.log(`Credit note sent: ${creditNote.id}`);

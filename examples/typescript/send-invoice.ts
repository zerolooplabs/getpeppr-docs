import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_live_..." });

// Production example (live key, 21 % Belgian VAT): replace the buyer with your
// own customer before running it. The sandbox delivers only to the test
// receiver 9925:BE0314595348 — invoice-workflow.ts is the version that runs there.

const result = await peppol.invoices.send({
  number: "INV-2026-042",

  // Buyer (street, city, postalCode required by Peppol BIS 3.0)
  to: {
    name: "ACMEDIA",
    peppolId: "0208:0685660237",
    street: "Avenue Louise 54",
    city: "Brussels",
    postalCode: "1050",
    country: "BE",
  },
  buyerReference: "PO-2026-007",

  // Line items
  lines: [
    { description: "Arc Reactor Maintenance Q1", quantity: 1, unitPrice: 50_000, vatRate: 21 },
    { description: "Vibranium Shield Polish",    quantity: 3, unitPrice: 250,    vatRate: 21 },
  ],

  // Payment
  paymentTerms: "Net 30 days",
  paymentIban: "BE68539007547034",

  // Optional
  date: "2026-03-01",
  dueDate: "2026-03-31",
  note: "Thank you for your business!",
});

console.log(`Sent! ID: ${result.id}, Status: ${result.status}`);

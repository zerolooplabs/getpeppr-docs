import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

const result = await peppol.invoices.send({
  number: "INV-2026-042",

  // Seller (you)
  from: {
    name: "Stark Industries BVBA",
    peppolId: "0208:BE0476748862",
    vatNumber: "BE0476748862",
    address: { street: "Rue de la Loi 1", city: "Brussels", postalCode: "1000", country: "BE" },
  },

  // Buyer
  to: {
    name: "Wayne Enterprises NV",
    peppolId: "0208:BE0123456789",
    country: "BE",
    buyerReference: "PO-2026-007",
  },

  // Line items
  lines: [
    { description: "Arc Reactor Maintenance Q1", quantity: 1, unitPrice: 50_000, vatRate: 21 },
    { description: "Vibranium Shield Polish",    quantity: 3, unitPrice: 250,    vatRate: 21 },
  ],

  // Payment
  paymentTerms: "Net 30 days",
  paymentIban: "BE68539007547034",

  // Optional
  issueDate: "2026-03-01",
  dueDate: "2026-03-31",
  note: "Thank you for your business!",
});

console.log(`Sent! ID: ${result.id}, Status: ${result.status}`);

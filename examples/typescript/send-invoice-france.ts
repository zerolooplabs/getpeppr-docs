import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// Sending to a French buyer — see https://getpeppr.dev/docs/france/ for the
// full guide (identifiers, directory registration, French statuses).
//
// Route with the scheme the buyer actually registered:
//   0009 = SIRET (14 digits)   0002 = SIREN (9 digits)   0225 = FR:CTC
// French VAT rates: standard 20%, reduced 10% / 5.5% / 2.1%.
const result = await peppol.invoices.send({
  number: "INV-2026-042",

  to: {
    name: "Stark Industries France SARL",
    peppolId: "0009:90200000900008", // SIRET routing
    companyId: "902000009",          // SIREN (9 digits) or SIRET (14 digits)
    vatNumber: "FR60902000009",      // FR + 2-char key + 9-digit SIREN
    street: "10 Rue de la Paix",
    city: "Paris",
    postalCode: "75002",
    country: "FR",
  },
  buyerReference: "PO-2026-007",

  lines: [
    { description: "Arc Reactor Maintenance Q1", quantity: 1, unitPrice: 50_000, vatRate: 20 },
    { description: "Technical Documentation",    quantity: 1, unitPrice: 1_200,  vatRate: 5.5 },
  ],

  paymentTerms: "Net 30 days",
  paymentIban: "FR1420041010050500013M02606",

  date: "2026-03-01",
  dueDate: "2026-03-31",
});

console.log(`Sent! ID: ${result.id}, Status: ${result.status}`);

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// Send an invoice
const result = await peppol.invoices.send({
  number: "INV-2026-050",
  from: { name: "Acme BVBA", peppolId: "0208:BE0456789012", country: "BE" },
  to:   { name: "Globex NV", peppolId: "0208:BE0987654321", street: "Rue de la Loi 200", city: "Brussels", postalCode: "1000", country: "BE" },
  lines: [{ description: "Consulting", quantity: 1, unitPrice: 1000, vatRate: 21 }],
});
console.log(result.status); // "queued"

// Check status later
const status = await peppol.invoices.getStatus(result.id);
console.log(status.status);

// Status flow:
//   "created" → "queued" → "sent" → "delivered" → "accepted"
//                                                → "rejected"
//                                  → "failed"

// Access Peppol message ID once sent
if (status.peppolMessageId) {
  console.log(`Peppol AS4 ID: ${status.peppolMessageId}`);
}

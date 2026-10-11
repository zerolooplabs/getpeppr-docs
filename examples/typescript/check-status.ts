import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// Send an invoice
const result = await peppol.invoices.send({
  number: "INV-2026-050",
  to: { name: "SPF Economie (test receiver)", peppolId: "9925:BE0314595348", street: "Rue du Progrès 50", city: "Brussels", postalCode: "1210", country: "BE" },
  lines: [{ description: "Consulting", quantity: 1, unitPrice: 1000, vatRate: 0, vatCategory: "O" }],
});
console.log(result.status); // "submitted"

// Check status later — includeEvidence adds peppolMessageId once the network has it
const status = await peppol.invoices.getStatus(result.id, { includeEvidence: true });
console.log(status.status);

// Status flow:
//   "submitted" → "delivered" → "accepted" → "paid"
//                              → "rejected"
//               → "failed"

// Access Peppol message ID once sent
if (status.peppolMessageId) {
  console.log(`Peppol AS4 ID: ${status.peppolMessageId}`);
}

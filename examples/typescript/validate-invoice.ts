import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "pk_test_..." });

// Validate locally before sending — catches errors instantly
const result = peppol.validate({
  number: "INV-2026-042",
  from: { name: "Acme BVBA", peppolId: "0208:BE0456789012", country: "BE" },
  to:   { name: "Globex NV", peppolId: "0208:BE0987654321", country: "BE" },
  lines: [
    { description: "Consulting Q1", quantity: 40, unitPrice: 125, vatRate: 21 },
  ],
});

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`[${error.field}] ${error.message}`);
    // e.g. "[from.vatNumber] VAT number recommended for invoices > EUR 400"

    if (error.suggestion) {
      console.log(`  Tip: ${error.suggestion}`);
      // "Add vatNumber to the seller party"
    }
  }
}

// Also returns warnings for non-blocking suggestions
for (const warning of result.warnings) {
  console.warn(`[${warning.field}] ${warning.message}`);
}

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// Validate locally before sending — catches errors instantly, no API call needed
const result = peppol.validate({
  number: "INV-2026-042",
  to: {
    name: "Globex NV",
    peppolId: "0208:BE0987654321",
    street: "Rue de la Loi 200",
    city: "Brussels",
    postalCode: "1000",
    country: "BE",
  },
  lines: [
    { description: "Consulting Q1", quantity: 40, unitPrice: 125, vatRate: 21 },
  ],
});

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`[${error.field}] ${error.message}`);

    if (error.suggestion) {
      console.log(`  Tip: ${error.suggestion}`);
    }
  }
}

// Also returns warnings for non-blocking suggestions
for (const warning of result.warnings) {
  console.warn(`[${warning.field}] ${warning.message}`);
}

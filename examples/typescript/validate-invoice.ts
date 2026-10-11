import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// Validate locally before sending — catches errors instantly, no API call needed
const result = peppol.validate({
  number: "INV-2026-042",
  to: {
    name: "SPF Economie (test receiver)",
    peppolId: "9925:BE0314595348",
    street: "Rue du Progrès 50",
    city: "Brussels",
    postalCode: "1210",
    country: "BE",
  },
  lines: [
    { description: "Consulting Q1", quantity: 40, unitPrice: 125, vatRate: 0, vatCategory: "O" },
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

// Server-side validation runs through the gateway, checks UBL generation, and
// returns HTTP 200 with valid:false for validation findings.
const serverResult = await peppol.invoices.validateServer({
  number: "INV-2026-043",
  to: {
    name: "SPF Economie (test receiver)",
    peppolId: "9925:BE0314595348",
    street: "Rue du Progrès 50",
    city: "Brussels",
    postalCode: "1210",
    country: "BE",
  },
  lines: [
    { description: "Consulting Q2", quantity: 10, unitPrice: 125, vatRate: 0, vatCategory: "O" },
  ],
});

console.log("UBL generation:", serverResult.ubl.valid);
console.log("Schematron:", serverResult.schematron.valid);

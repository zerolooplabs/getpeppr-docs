/**
 * Peppol Directory Lookup Example
 *
 * Check if a business is registered on the Peppol network
 * before sending them an invoice.
 */

import { Peppol, PeppolApiError } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// ── Lookup by Peppol ID ───────────────────────────────────
// scheme 0208 = Belgian KBO/BCE number

const participant = await peppol.directory.lookup("0208:BE0123456789");

if (participant) {
  console.log(`Found: ${participant.name}`);
  console.log(`Country: ${participant.country}`);
  console.log(`Capabilities: ${participant.capabilities.join(", ")}`);
  // Enriched fields (optional — available when the directory provides them)
  if (participant.registrationDate) console.log(`Registered: ${participant.registrationDate}`);
  if (participant.vatNumber) console.log(`VAT: ${participant.vatNumber}`);
  if (participant.website) console.log(`Website: ${participant.website}`);
  if (participant.contactInfo) console.log(`Contact: ${JSON.stringify(participant.contactInfo)}`);
  if (participant.additionalIds) console.log(`Additional IDs: ${JSON.stringify(participant.additionalIds)}`);
} else {
  console.log("Participant not found on Peppol network");
}

// ── Verify before sending ─────────────────────────────────
// Common pattern: check the recipient exists before creating an invoice

const buyerPeppolId = "0208:BE0987654321";

const buyer = await peppol.directory.lookup(buyerPeppolId);

if (!buyer) {
  throw new Error(`Recipient ${buyerPeppolId} is not reachable on Peppol`);
}

console.log(`Recipient verified: ${buyer.name} — safe to send`);

// ─── Search the Peppol Directory ─────────────────────────────

// Search by name
const searchResults = await peppol.directory.search({
  name: "Acme",
  country: "BE",
  limit: 10,
});

console.log(`Found ${searchResults.meta.totalCount} participants`);
for (const entry of searchResults.data) {
  console.log(`  ${entry.name} (${entry.peppolId}) — ${entry.country}`);
  console.log(`  Capabilities: ${entry.capabilities.join(", ")}`);
  if (entry.registrationDate) console.log(`  Registered: ${entry.registrationDate}`);
  if (entry.vatNumber) console.log(`  VAT: ${entry.vatNumber}`);
  if (entry.website) console.log(`  Website: ${entry.website}`);
}

// Search by VAT number (country prefix stripped server-side)
const vatResults = await peppol.directory.searchByVat("BE0685660237");
console.log(`VAT search found ${vatResults.meta.totalCount} results`);

// ─── Pre-send recipient validation ──────────────────────────

const invoice = {
  number: "INV-2026-001",
  to: {
    name: buyer.name,
    peppolId: buyer.peppolId,
    street: "Rue de la Loi 200",
    city: "Brussels",
    postalCode: "1000",
    country: "BE" as const,
  },
  lines: [{ description: "Consulting", quantity: 1, unitPrice: 1000, vatRate: 21 }],
};

// Non-blocking mode — sends even if recipient not found (no validation by default)
const result = await peppol.invoices.send(invoice, {
  validateRecipient: "warn",
});

// Strict mode — rejects with error if recipient not found
try {
  const strictResult = await peppol.invoices.send(invoice, {
    validateRecipient: "strict",
  });
} catch (err) {
  if (err instanceof PeppolApiError && err.statusCode === 422) {
    console.error("Recipient not registered on Peppol network");
  }
}

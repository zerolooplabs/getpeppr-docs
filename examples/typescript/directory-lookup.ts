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

// lookup() THROWS a PeppolApiError with statusCode 404 when the participant is
// not on the network — it never resolves to null.
let participant;
try {
  participant = await peppol.directory.lookup("0208:BE0123456789");
} catch (err) {
  if (!(err instanceof PeppolApiError && err.statusCode === 404)) throw err;
}

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

let buyer;
try {
  buyer = await peppol.directory.lookup(buyerPeppolId);
} catch (err) {
  if (err instanceof PeppolApiError && err.statusCode === 404) {
    throw new Error(`Recipient ${buyerPeppolId} is not reachable on Peppol`);
  }
  throw err;
}

console.log(`Recipient found: ${buyer.name}; invoice validation still applies`);

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
  buyerReference: "PO-2026-001",
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

// This sends one invoice when all checks pass. Replace the example recipient
// and invoice details; use an approved test recipient in sandbox.
// Use validateRecipient: "warn" instead for a non-blocking Directory check,
// or omit it for no Directory check. Choose one mode per invoice.
// Strict mode rejects a recipient absent from the Peppol Directory.
try {
  const strictResult = await peppol.invoices.send(invoice, {
    validateRecipient: "strict",
  });
} catch (err) {
  if (err instanceof PeppolApiError && err.statusCode === 422 &&
      err.resultCode === "invoices.recipient_not_in_directory") {
    console.error("Recipient not found in Peppol Directory");
  } else {
    throw err;
  }
}

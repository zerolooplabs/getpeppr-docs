/**
 * Peppol Directory Lookup Example
 *
 * Look up and search the businesses listed in the Peppol Directory. The
 * Directory is a public LISTING refreshed on its own schedule: it can lag the
 * network by a day, and these calls read the PRODUCTION Directory whatever your
 * key's environment. To check that a send can be routed, use validateRecipient
 * on the send itself (last section), which asks the SML.
 */

import { Peppol, PeppolApiError } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// ── Lookup by Peppol ID ───────────────────────────────────
// scheme 9925 = Belgian VAT number

// lookup() THROWS a PeppolApiError with statusCode 404 when the participant is
// not listed in the Directory — it never resolves to null.
let participant;
try {
  participant = await peppol.directory.lookup("9925:BE0314595348");
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
  console.log("Participant not listed in the Peppol Directory");
}

// ── Look up the recipient before sending ──────────────────
// Use the listing to fill in what you show, never as the go/no-go: a recipient
// registered since yesterday may not be listed yet, and a sandbox legal entity
// never is. The send below decides with validateRecipient, which asks the SML.

const buyerPeppolId = "9925:BE0314595348" as const;

let buyerName = "SPF Economie (test receiver)"; // your own record of the customer
try {
  const listed = await peppol.directory.lookup(buyerPeppolId);
  buyerName = listed.name;
  console.log(`Listed in the Peppol Directory: ${listed.name}`);
} catch (err) {
  if (!(err instanceof PeppolApiError && err.statusCode === 404)) throw err;
  console.log(`${buyerPeppolId} is not listed in the Peppol Directory; it may still be on the network`);
}

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
    name: buyerName,
    peppolId: buyerPeppolId,
    street: "Rue du Progrès 50",
    city: "Brussels",
    postalCode: "1210",
    country: "BE" as const,
  },
  lines: [{ description: "Consulting", quantity: 1, unitPrice: 1000, vatRate: 0, vatCategory: "O" as const }],
};

// This sends one invoice when all checks pass. Replace the example recipient
// and invoice details; use an approved test recipient in sandbox.
// validateRecipient asks the SML (the registry every access point routes by) of
// your key's network — not the Peppol Directory searched above, which can lag
// the network by a day. Strict mode sends nothing when the SML has no record.
// Use validateRecipient: "warn" instead to submit anyway: result.warnings then
// carries ruleId "recipient_not_on_network" (SDK 6.5.0 or later; earlier
// versions could drop it), and the provider may still refuse an unroutable
// recipient (422 provider.rejected). Omit it for no check. Choose one mode per
// invoice.
try {
  const strictResult = await peppol.invoices.send(invoice, {
    validateRecipient: "strict",
  });
} catch (err) {
  // The result code keeps its historical name; the check reads the SML.
  if (err instanceof PeppolApiError && err.statusCode === 422 &&
      err.resultCode === "invoices.recipient_not_in_directory") {
    console.error("Recipient not found on the Peppol network (no SML record)");
  } else {
    throw err;
  }
}

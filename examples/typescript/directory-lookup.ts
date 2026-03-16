/**
 * Peppol Directory Lookup Example
 *
 * Check if a business is registered on the Peppol network
 * before sending them an invoice.
 */

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// ── Lookup by Peppol ID ───────────────────────────────────
// scheme 0208 = Belgian KBO/BCE number

const participant = await peppol.directory.lookup("0208", "BE0123456789");

if (participant) {
  console.log(`Found: ${participant.name}`);
  console.log(`Country: ${participant.country}`);
  console.log(`Capabilities: ${participant.capabilities.join(", ")}`);
} else {
  console.log("Participant not found on Peppol network");
}

// ── Verify before sending ─────────────────────────────────
// Common pattern: check the recipient exists before creating an invoice

const buyerPeppolId = "0208:BE0987654321";
const [scheme, id] = buyerPeppolId.split(":");

const buyer = await peppol.directory.lookup(scheme, id);

if (!buyer) {
  throw new Error(`Recipient ${buyerPeppolId} is not reachable on Peppol`);
}

console.log(`Recipient verified: ${buyer.name} — safe to send`);

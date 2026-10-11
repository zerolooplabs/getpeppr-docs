/**
 * Contact Management Example
 *
 * Full CRUD operations on contacts: create, list, get, update, delete.
 */

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_abc123..." });

// ── Create a contact ────────────────────────────────────────

const contact = await peppol.contacts.create({
  name: "SPF Economie (test receiver)",
  peppolId: "9925:BE0314595348",
  vatNumber: "BE0314595348",
  country: "BE",
  city: "Brussels",
  postalCode: "1210",
  street: "Rue du Progrès 50",
  email: "billing@example.com",
  isClient: true,
  isProvider: false,
});

console.log(`Created contact: ${contact.id} — ${contact.name}`);

// ── List all contacts ───────────────────────────────────────

const page = await peppol.contacts.list({ limit: 20 });
console.log(`Found ${page.meta.totalCount} contacts (showing ${page.data.length})`);

for (const c of page.data) {
  console.log(`  ${c.id}: ${c.name} (${c.peppolId})`);
}

// ── Paginate through all contacts ───────────────────────────

for await (const c of peppol.contacts.listAll()) {
  console.log(`  ${c.name}`);
}

// ── Get a single contact ────────────────────────────────────

const fetched = await peppol.contacts.get(contact.id);
console.log(`Fetched: ${fetched.name}, email: ${fetched.email}`);

// ── Update a contact ────────────────────────────────────────

const updated = await peppol.contacts.update(contact.id, {
  email: "invoicing@example.com",
  street: "Rue du Progrès 50, Floor 2",
});

console.log(`Updated email: ${updated.email}`);

// ── Delete a contact ────────────────────────────────────────

await peppol.contacts.delete(contact.id);
console.log(`Contact ${contact.id} deleted`);

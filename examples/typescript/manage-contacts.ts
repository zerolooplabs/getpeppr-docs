/**
 * Contact Management Example
 *
 * Full CRUD operations on contacts: create, list, get, update, delete.
 */

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_abc123..." });

// ── Create a contact ────────────────────────────────────────

const contact = await peppol.contacts.create({
  name: "Wayne Enterprises NV",
  peppolId: "0208:BE0123456789",
  vatNumber: "BE0123456789",
  country: "BE",
  city: "Gotham",
  postalCode: "1000",
  street: "Wayne Tower, 1 Park Row",
  email: "accounts@wayne-enterprises.be",
  isClient: true,
  isProvider: false,
});

console.log(`Created contact: ${contact.id} — ${contact.name}`);

// ── List all contacts ───────────────────────────────────────

const page = await peppol.contacts.list({ limit: 20 });
console.log(`Found ${page.meta.total} contacts (showing ${page.data.length})`);

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
  email: "invoicing@wayne-enterprises.be",
  street: "Wayne Tower, 2 Park Row",
});

console.log(`Updated email: ${updated.email}`);

// ── Delete a contact ────────────────────────────────────────

await peppol.contacts.delete(contact.id);
console.log(`Contact ${contact.id} deleted`);

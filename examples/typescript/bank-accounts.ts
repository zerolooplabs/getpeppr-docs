/**
 * Bank Account Management Example
 *
 * Full CRUD operations on bank accounts: create, list, get, update, delete.
 */

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// ── Create a bank account ─────────────────────────────────

const account = await peppol.bankAccounts.create({
  name: "Stark Industries EUR",
  iban: "BE68539007547034",
  bic: "BPOTBEB1",
  country: "BE",
});

console.log(`Created: ${account.id} — ${account.name}`);

// ── List bank accounts ────────────────────────────────────

const page = await peppol.bankAccounts.list({ limit: 20 });
console.log(`Found ${page.meta.totalCount} bank accounts`);

for (const ba of page.data) {
  console.log(`  ${ba.id}: ${ba.name} (${ba.iban ?? ba.number})`);
}

// ── Paginate through all bank accounts ────────────────────

for await (const ba of peppol.bankAccounts.listAll()) {
  console.log(`  ${ba.name}`);
}

// ── Get a single bank account ─────────────────────────────

const fetched = await peppol.bankAccounts.get(account.id);
console.log(`Fetched: ${fetched.name}, IBAN: ${fetched.iban}`);

// ── Update a bank account ─────────────────────────────────

const updated = await peppol.bankAccounts.update(account.id, {
  name: "Stark Industries — Primary EUR",
});

console.log(`Updated name: ${updated.name}`);

// ── Delete a bank account ─────────────────────────────────

await peppol.bankAccounts.delete(account.id);
console.log(`Bank account ${account.id} deleted`);

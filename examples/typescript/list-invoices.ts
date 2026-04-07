/**
 * List Invoices Example
 *
 * List your sent invoices with pagination, or iterate through all of them.
 * Note: invoices.list() returns outbound submissions only (invoices you sent).
 */

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// List your invoices (paginated)
const page = await peppol.invoices.list({ limit: 10, offset: 0 });

console.log(`Total invoices: ${page.meta.totalCount} (showing ${page.data.length})`);

for (const invoice of page.data) {
  console.log(`  ${invoice.id}: ${invoice.number} — ${invoice.status}`);
}

// Paginate through all invoices
for await (const invoice of peppol.invoices.listAll()) {
  console.log(`${invoice.number}: ${invoice.status}`);
}

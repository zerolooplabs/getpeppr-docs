# getpeppr

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Peppol e-invoicing for developers.** Send compliant invoices with one API call.

getpeppr is a developer-first API gateway for the [Peppol](https://peppol.org/) e-invoicing network. You send JSON — we handle UBL XML, BIS 3.0 validation, and network delivery.

---

## Quick Start

### 1. Install the SDK

```bash
npm install @getpeppr/sdk
```

### 2. Send an invoice (TypeScript)

```typescript
import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

const invoice = await peppol.invoices.send({
  number: "INV-2026-001",
  to: { name: "Globex NV", peppolId: "0208:BE0987654321", street: "Rue de la Loi 200", city: "Brussels", postalCode: "1000", country: "BE" },
  lines: [{ description: "Consulting", quantity: 1, unitPrice: 1000, vatRate: 21 }],
});

console.log(invoice.status); // "submitted"
```

### 3. Send an invoice (cURL)

```bash
curl -X POST https://api.getpeppr.dev/v1/invoices/send \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "number": "INV-2026-001",
    "to": {
      "name": "Globex NV",
      "peppolId": "0208:BE0987654321",
      "street": "Rue de la Loi 200",
      "city": "Brussels",
      "postalCode": "1000",
      "country": "BE"
    },
    "lines": [{
      "description": "Consulting",
      "quantity": 1,
      "unitPrice": 1000,
      "vatRate": 21
    }]
  }'
```

---

## Documentation

Full documentation is available at **[getpeppr.dev/docs](https://getpeppr.dev/docs/)**.

| Guide | Description |
|-------|-------------|
| [Quick Start](https://getpeppr.dev/docs/) | Installation, first invoice, configuration |
| [Onboarding Setup](https://getpeppr.dev/docs/onboarding/) | Legal entity and Peppol identity setup |
| [Authentication](https://getpeppr.dev/docs/authentication/) | API keys, environments, rate limits |
| [Sandbox](https://getpeppr.dev/docs/sandbox/) | Sandbox limitations, quotas, and going to production |
| [Send an Invoice](https://getpeppr.dev/docs/send-invoice/) | Sending, attachments, allowances, delivery |
| [Credit Notes](https://getpeppr.dev/docs/credit-notes/) | Correcting and cancelling invoices |
| [Listing Invoices](https://getpeppr.dev/docs/receiving/) | Browsing your sent invoices |
| [Validation](https://getpeppr.dev/docs/validation/) | Client-side validation before sending |
| [Contacts & Directory](https://getpeppr.dev/docs/contacts/) | Contact management and Peppol Directory lookup |
| [Document Status](https://getpeppr.dev/docs/document-status/) | Tracking delivery lifecycle |
| [Webhooks](https://getpeppr.dev/docs/webhooks/) | Real-time event notifications |
| [Error Handling](https://getpeppr.dev/docs/error-handling/) | Error types, status codes, retries |
| [CLI](https://getpeppr.dev/docs/cli/) | Command-line validation tool |
| [Type Definitions](https://getpeppr.dev/docs/types/) | TypeScript interface reference |

---

## Postman Collection

Import the collection into Postman for interactive API exploration.

1. Open Postman → **Import** → select `postman/getpeppr.postman_collection.json`
2. Set collection variables:
   - `base_url` → `https://api.getpeppr.dev`
   - `api_key` → your API key (e.g. `sk_sandbox_abc123...`)

---

## Code Examples

| Language | Directory | Description |
|----------|-----------|-------------|
| TypeScript | [`examples/typescript/`](examples/typescript/) | Full SDK examples |
| Python | [`examples/python/`](examples/python/) | HTTP examples with `requests` |
| cURL | [`examples/curl/`](examples/curl/) | Command-line examples |

---

## API Overview

### Invoice Lifecycle

Send an invoice, track its delivery, and export it:

```
send → track status → export (PDF, XML, JSON)
```

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `POST` | `/v1/invoices/send` | `invoices.send()` | Validate, create, and send in one step |
| `GET` | `/v1/invoices` | `invoices.list()` | List invoices (paginated) |
| `GET` | `/v1/invoices/:id` | `invoices.getStatus()` | Get invoice details and delivery status |
| `GET` | `/v1/invoices/:id/as/:format` | `invoices.getAs()` | Export as PDF, XML, or JSON |

Status flow:

```
"submitted" → "delivered" → "accepted" → "paid"
                           → "rejected"
            → "failed"
```

> **Note:** Invoices are immutable after submission. There are no drafts, updates, or deletes. To correct an invoice, send a credit note.

### Credit Notes

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `POST` | `/v1/invoices/send` | `invoices.send()` | Send a credit note (`isCreditNote: true`, must include `invoiceReference`) |

### Contacts

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `GET` | `/v1/contacts` | `contacts.list()` | List contacts (paginated) |
| `GET` | `/v1/contacts/:id` | `contacts.get()` | Get contact details |
| `POST` | `/v1/contacts` | `contacts.create()` | Create a contact |
| `PUT` | `/v1/contacts/:id` | `contacts.update()` | Update a contact |
| `DELETE` | `/v1/contacts/:id` | `contacts.delete()` | Delete a contact |

### Bank Accounts

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `GET` | `/v1/bank-accounts` | `bankAccounts.list()` | List bank accounts (paginated) |
| `GET` | `/v1/bank-accounts/:id` | `bankAccounts.get()` | Get bank account details |
| `POST` | `/v1/bank-accounts` | `bankAccounts.create()` | Create a bank account |
| `PUT` | `/v1/bank-accounts/:id` | `bankAccounts.update()` | Update a bank account |
| `DELETE` | `/v1/bank-accounts/:id` | `bankAccounts.delete()` | Delete a bank account |

### Transports

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `GET` | `/v1/transports/types` | `transports.listTypes()` | List available transport types |
| `GET` | `/v1/transports` | `transports.list()` | List configured transports |
| `GET` | `/v1/transports/:code` | `transports.get()` | Get transport details |
| `POST` | `/v1/transports` | `transports.create()` | Create a transport |
| `PATCH` | `/v1/transports/:code` | `transports.update()` | Update a transport |
| `DELETE` | `/v1/transports/:code` | `transports.delete()` | Delete a transport |

> **Note:** Transports are managed automatically by the Peppol network. These endpoints return static transport configurations — creating, updating, or deleting transports has no effect on invoice delivery routing.

### Directory

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `GET` | `/v1/directory/:scheme/:id` | `directory.lookup()` | Lookup Peppol participant (enriched: name, country, capabilities, VAT, contacts, website) |
| `GET` | `/v1/directory/search` | `directory.search()` | Search Peppol Directory by name, country, or VAT |

Convenience method: `directory.searchByVat(vatNumber)` — searches by VAT number (country prefix stripped server-side).

### Validation

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `POST` | `/v1/validate` | `peppol.validate()` | Validate invoice (client-side rules, BIS 3.0 + country-specific) |

### Events

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `GET` | `/v1/events` | `events.list()` | List usage events (paginated) |

### Webhooks

Verify incoming webhook signatures using HMAC-SHA256:

```typescript
import { webhooks } from "@getpeppr/sdk";

const event = await webhooks.constructEvent(
  rawBody,                    // raw request body string
  req.headers["getpeppr-signature"],
  process.env.WEBHOOK_SECRET
);

console.log(event.type); // e.g. "invoice.delivered"
```

---

## Advanced Features

### Pre-send Recipient Validation

Verify that a recipient is registered on the Peppol network before sending:

```typescript
// Non-blocking mode — sends even if recipient not found (omit for no validation)
const invoice = await peppol.invoices.send(data, { validateRecipient: "warn" });

// Strict mode — rejects with 422 if recipient not found
const invoice = await peppol.invoices.send(data, { validateRecipient: "strict" });
```

Also available via the `x-validate-recipient` header in REST calls.

### Pagination Iterator

Automatically paginate through all results:

```typescript
for await (const invoice of peppol.invoices.listAll()) {
  console.log(invoice.number);
}
```

Also available on `contacts.listAll()`, `bankAccounts.listAll()`, and `events.listAll()`.

> **Note:** `invoices.list()` returns outbound invoice submissions (invoices you sent). There is currently no endpoint for received invoices.

### Batch Send

Send multiple invoices concurrently:

```typescript
const result = await peppol.invoices.sendBatch(invoices, {
  concurrency: 5,
  stopOnError: false,
});

console.log(`${result.succeeded.length} sent, ${result.failed.length} failed`);
```

### Status Polling

Wait for an invoice to reach a target status:

```typescript
const final = await peppol.invoices.waitFor(invoice.id, "accepted", {
  interval: 2000,   // poll every 2s
  timeout: 60_000,  // give up after 60s
});
```

---

## License

MIT — see [LICENSE](LICENSE).

Built by [Zero Loop Labs](https://zerolooplabs.com).

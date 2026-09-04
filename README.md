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
curl -X POST https://api.getpeppr.dev/v1/invoices \
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

### 4. Send an invoice (CLI)

```bash
# Install once
npm install -g @getpeppr/cli

# Authenticate (sandbox by default)
getpeppr login --key sk_sandbox_abc123... --sandbox

# Send a JSON file and watch delivery status
getpeppr send invoice.json --watch

# Or synthesize a quick test invoice from flags
getpeppr send --to 0208:BE0987654321 --amount 1000 --desc "Consulting"
```

The CLI also handles offline validation (`getpeppr validate`), scaffolding (`getpeppr init`), UBL conversion (`getpeppr convert`), and Peppol Directory lookups (`getpeppr lookup`).

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
| [Validation](https://getpeppr.dev/docs/validation/) | Client-side and server-side validation before sending |
| [Contacts & Directory](https://getpeppr.dev/docs/contacts/) | Contact management and Peppol Directory lookup |
| [France](https://getpeppr.dev/docs/france/) | Domestic French B2B under the 2026 reform — SIREN/SIRET, directory registration, French statuses, payment reporting |
| [Document Status](https://getpeppr.dev/docs/document-status/) | Tracking delivery lifecycle |
| [Webhooks](https://getpeppr.dev/docs/webhooks/) | Real-time event notifications |
| [Platform & Multi-Tenant](https://getpeppr.dev/docs/platform/) | Sending on behalf of sub-tenants, legal entity lifecycle, and platform webhooks |
| [Error Handling](https://getpeppr.dev/docs/error-handling/) | Error types, status codes, retries |
| [CLI](https://getpeppr.dev/docs/cli/) | Send invoices, manage credentials, validate, scaffold, convert, and lookup — all from the terminal |
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
send → track status → export (PDF, XML)
```

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `POST` | `/v1/invoices` | `invoices.send()` | Validate, create, and send in one step |
| `GET` | `/v1/invoices` | `invoices.list()` | List invoices (paginated) |
| `GET` | `/v1/invoices/:id` | `invoices.getStatus()` | Get invoice details and delivery status |
| `GET` | `/v1/invoices/:id/as/:format` | `invoices.getAs()` | Download the transmitted document — UBL XML (`original`, `payload`, `xml.ubl.invoice.bis3`); `pdf` only when the provider produced one, otherwise the XML comes back (check `Content-Type`) |

Invoices are immutable after submission — there are no drafts, updates, or deletes. To correct an invoice, send a credit note.

```
"submitted" → "delivered" → "accepted" → "paid"
                           → "rejected"
            → "failed"
```

### Credit Notes

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `POST` | `/v1/invoices` | `invoices.send()` | Send a credit note (`isCreditNote: true`, must include `invoiceReference`) |

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
| `POST` | `/v1/transports` | `transports.create()` | Always `405 Method Not Allowed` — transports are read-only |
| `PUT` | `/v1/transports/:code` | `transports.update()` | Always `405 Method Not Allowed` |
| `DELETE` | `/v1/transports/:code` | `transports.delete()` | Always `405 Method Not Allowed` |

> **Note:** Transports are managed by the Peppol access point. The read endpoints return the single configured transport (`id: "peppol"`, which is also the path segment); POST, PUT and DELETE answer `405` with the result code `transports.managed_by_provider`, and the SDK methods above surface that as a `PeppolApiError`.

### Directory

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `GET` | `/v1/directory/:scheme/:id` | `directory.lookup()` | Lookup Peppol participant (enriched: name, country, capabilities, VAT, contacts, website) |
| `GET` | `/v1/directory/search` | `directory.search()` | Search Peppol Directory by name, country, or VAT |

Convenience method: `directory.searchByVat(vatNumber)` — searches by VAT number (country prefix stripped server-side).

### Validation

| Method | Endpoint | SDK Method | Description |
|--------|----------|------------|-------------|
| `POST` | `/v1/validate` | — (`peppol.validate()` runs locally, without a network call) | Presence check of the required fields; no SDK wrapper |
| `POST` | `/v1/validate/server` | `invoices.validateServer()` | Gateway-side validation with SDK checks, UBL generation status, and offline Peppol business rules |

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
  String(req.headers["getpeppr-signature"] ?? ""),
  process.env.WEBHOOK_SECRET!, // set in your environment
);

console.log(event.type); // e.g. "invoice.sent"
```

| Event | Description |
|-------|-------------|
| `invoice.sent` | Invoice successfully delivered to recipient's access point |
| `invoice.accepted` | Recipient accepted the invoice |
| `invoice.refused` | Recipient rejected the invoice |
| `invoice.error` | Delivery failed (final state) |
| `invoice.registered` | Cleared by tax authority (e.g., KSA, PT) |
| `invoice.received` | Receipt acknowledged by recipient |
| `invoice.paid` | Payment confirmed by recipient |
| `invoice.undeliverable` | Not deliverable — no receiving capability found for the recipient on the Peppol network (final state for the send; payload carries `status: "no_action"`). Also sent when no delivery evidence has appeared after 7 days |
| `invoice.delivery_unconfirmed` | No delivery evidence yet — not a failure; `invoice.sent` follows and supersedes it if delivery is confirmed later |
| `invoice.partially_paid` | Recipient confirmed a partial payment |
| `invoice.under_query` | Recipient raised a question about the invoice |
| `invoice.conditionally_accepted` | Recipient accepted the invoice subject to conditions |
| `invoice.status_changed` | Generic status notification with the full per-axis state — opt-in, never matched by `*` |
| `legal_entity.registered` | Platform sub-tenant reached a verified or active state |
| `legal_entity.verification_failed` | Platform sub-tenant registry verification failed |
| `legal_entity.unsupported_scheme` | Platform sub-tenant identifier uses a scheme with no automatic validator |
| `legal_entity.awaiting_authz` | Platform sub-tenant authorisation email is awaiting customer action |
| `legal_entity.registration_failed` | Platform sub-tenant identity verified but network (SMP) registration failed |
| `peppol_identifier.verified` | A Peppol identifier completed registry verification |
| `peppol_identifier.verification_failed` | A Peppol identifier failed registry verification |
| `inbound.invoice.received` | An invoice addressed to your Legal Entity was received from the Peppol network |
| `inbound.creditnote.received` | A credit note addressed to your Legal Entity was received from the Peppol network |
| `test.ping` | Test event sent during endpoint setup |
| `*` | Wildcard — subscribes to every event type except `invoice.status_changed`, which is opt-in |

See the full [Webhooks guide](https://getpeppr.dev/docs/webhooks/) for payload shapes, the `Getpeppr-Signature` format, and retry behaviour.

#### Inbound Reception

When a supplier on the Peppol network sends an invoice or credit note **to** one of your Legal Entities, getpeppr stores the document and dispatches an `inbound.invoice.received` or `inbound.creditnote.received` event. Every Legal Entity receives from the day it is registered, in sandbox and in production, with nothing to enable.

> **Not to be confused with `invoice.received`** — that outbound event means a document _you sent_ was acknowledged by the recipient's access point. The `inbound.*` events mean a document was sent _to you_ by a third party.

Delivery is at-least-once: **deduplicate on `data.receivedDocumentId`**, the stable idempotency key for inbound events (one received document, one id, however many deliveries). The UBL XML is embedded in the payload as base64 (`data.document.content`) for documents up to 512 KB; larger documents set `content` to `null` with `contentOmittedReason: "size"`. Fetch those — and any document you did not persist — from the retrieval API:

```
GET /v1/received-documents                 # paginated list, newest first
GET /v1/received-documents/{id}            # one document
GET /v1/received-documents/{id}/as/xml     # the original UBL, byte for byte
```

Use `data.receivedDocumentId` as `{id}`. The list accepts `limit`, `offset`, and `legalEntityId` to filter by receiving Legal Entity. Results are scoped to your account **and to the environment of your API key** — a sandbox key never returns production documents.

---

## Advanced Features

### Pre-send Recipient Validation

Verify that a recipient is registered on the Peppol network before sending:

```typescript
// Non-blocking mode — sends even if recipient not found (omit for no validation)
const warned = await peppol.invoices.send(data, { validateRecipient: "warn" });

// Strict mode — rejects with 422 if recipient not found
const strict = await peppol.invoices.send(data, { validateRecipient: "strict" });
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

> **Note:** `invoices.list()` returns outbound invoice submissions (invoices you sent). Inbound documents (invoices and credit notes sent _to_ you) are delivered through the `inbound.*` webhook events and can be read back from `GET /v1/received-documents` (see [Inbound Reception](#inbound-reception)). **The SDK does not wrap those endpoints yet** — call them over HTTP with your API key in the meantime.

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

## Verifying these examples

Every example in this repository is compiled or parsed on every pull request and
on every push to `main` ([CI](.github/workflows/ci.yml)).

Every `/v1/…` path mentioned in the published content — the endpoint tables
above, the prose, the Python and TypeScript examples, the curl blocks and the
Postman collection — is checked against the
[OpenAPI spec](https://getpeppr.dev/openapi.yaml) getpeppr publishes. Where a mention also states its HTTP method — a table row, a
`curl -X`, a Postman request — the method is checked against the spec too; a bare
path is checked for existence only.

To run the same checks locally:

```bash
npm ci
npm run check
```

| Command | What it proves |
| --- | --- |
| `npm run check:examples` | `examples/typescript/` compiles with `strict` against `@getpeppr/sdk` |
| `npm run check:snippets` | the TypeScript fragments in this README compile too |
| `npm run check:python` | `examples/python/` is syntactically valid (`py_compile`) |
| `npm run check:shell` | every `bash` block in the Markdown files parses (`bash -n`) |
| `npm run check:postman` | the Postman collection parses, declares the Collection v2.1 schema, every request has a method and a URL, and nothing in it carries a script |
| `npm run check:routes` | every mentioned `/v1/…` path exists in the published OpenAPI spec, and its method too wherever the mention states one |

Each sweep also asserts a minimum count, so a check that finds nothing left to
check fails rather than passing green.

### What these checks do not prove

They parse and type-check; they never execute. So a syntactically valid example
that is wrong at runtime still passes: a misspelled response field, a value
written to a file with the wrong extension, a request body that is not valid
JSON, a `curl` flag that does not exist. `check:routes` covers the URLs and their
methods; the field-level half is uncovered, and finding it still takes a human
reading the examples against the API.

No check calls the getpeppr API, and none needs a key. Between them the checks
make one network request, an anonymous `GET` of the public OpenAPI spec —
`check:routes` fails if that URL answers `4xx`, because then the spec is not
where we say it is, and skips with a warning on a timeout or a `5xx`, which is
the upstream's problem and has its own monitor. (Installing the toolchain, of
course, reaches npm.)

## License

MIT — see [LICENSE](LICENSE).

Built by Zero Loop Labs Ltd — [getpeppr.dev](https://getpeppr.dev).

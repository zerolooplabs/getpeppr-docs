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

const peppol = new Peppol({ apiKey: "pk_test_..." });

const invoice = await peppol.invoices.send({
  number: "INV-2026-001",
  from: { name: "Acme BVBA", peppolId: "0208:BE0456789012", country: "BE" },
  to:   { name: "Globex NV", peppolId: "0208:BE0987654321", country: "BE" },
  lines: [{ description: "Consulting", quantity: 1, unitPrice: 1000, vatRate: 21 }],
});

console.log(invoice.status); // "sent"
```

### 3. Send an invoice (cURL)

```bash
curl -X POST https://api.getpeppr.dev/v1/invoices/send \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "number": "INV-2026-001",
    "from": {
      "name": "Acme BVBA",
      "peppolId": "0208:BE0456789012",
      "country": "BE"
    },
    "to": {
      "name": "Globex NV",
      "peppolId": "0208:BE0987654321",
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
| [Getting Started](https://getpeppr.dev/docs/) | Installation, first invoice, configuration |
| [Authentication](https://getpeppr.dev/docs/authentication/) | API keys, environments, security |
| [Invoices](https://getpeppr.dev/docs/invoices/) | Send, receive, credit notes, attachments |
| [Error Handling](https://getpeppr.dev/docs/error-handling/) | Validation errors, API errors, retries |

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

### Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/invoices/send` | Send an invoice |
| `POST` | `/v1/invoices/import` | Import an existing invoice |
| `GET` | `/v1/invoices` | List invoices |
| `GET` | `/v1/invoices/:id` | Get invoice details |
| `GET` | `/v1/invoices/:id/status` | Check delivery status |

### Credit Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/invoices/send` | Send a credit note (type: `creditNote`) |

### Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/contacts` | List contacts |
| `GET` | `/v1/contacts/:id` | Get contact details |
| `POST` | `/v1/contacts` | Create a contact |

### Bank Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/bank-accounts` | List bank accounts |
| `GET` | `/v1/bank-accounts/:id` | Get bank account details |
| `POST` | `/v1/bank-accounts` | Create a bank account |

### Directory

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/directory/:scheme/:id` | Lookup Peppol participant |

### Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/validate` | Validate invoice (client-side rules) |
| `POST` | `/v1/validate/server` | Validate invoice (server-side, full) |

---

## License

MIT — see [LICENSE](LICENSE).

Built by [Zero Loop Labs](https://zerolooplabs.com).

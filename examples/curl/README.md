# cURL Examples

Replace `sk_sandbox_abc123...` with your actual API key.

## Invoices

### Send an invoice

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

### List invoices

```bash
curl "https://api.getpeppr.dev/v1/invoices?limit=10&offset=0" \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Get invoice details

```bash
curl https://api.getpeppr.dev/v1/invoices/inv_abc123 \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Export invoice as PDF (when the access point rendered one)

```bash
curl --fail https://api.getpeppr.dev/v1/invoices/inv_abc123/as/pdf \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -o invoice.pdf
```

> A PDF only exists when the access point rendered one for this document, and the
> sandbox rarely does. When there is none, the endpoint answers `404` with result code
> `invoices.export_format_unavailable` and a JSON body listing the `availableMimeTypes`.
> It never substitutes the UBL XML for the PDF you asked for.
>
> **`--fail` is not optional here.** Without it curl treats the error body as content
> and writes that JSON into `invoice.pdf` — a file with a `.pdf` name that no reader
> can open. With it, curl exits non-zero and writes no file.
>
> To get the UBL instead, make a second, explicit request — see **Export invoice as
> XML** below. It is never a fallback the PDF call performs for you.

### Send a credit note

```bash
curl -X POST https://api.getpeppr.dev/v1/invoices \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "number": "CN-2026-001",
    "isCreditNote": true,
    "invoiceReference": "INV-2026-001",
    "to": {
      "name": "Globex NV",
      "peppolId": "0208:BE0987654321",
      "street": "Rue de la Loi 200",
      "city": "Brussels",
      "postalCode": "1000",
      "country": "BE"
    },
    "lines": [{
      "description": "Consulting — refund",
      "quantity": 1,
      "unitPrice": 1000,
      "vatRate": 21
    }]
  }'
```

### Send with allowances and charges

```bash
curl -X POST https://api.getpeppr.dev/v1/invoices \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "number": "INV-2026-050",
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
      "quantity": 10,
      "unitPrice": 500,
      "vatRate": 21,
      "allowances": [{ "reason": "Volume discount", "amount": 200 }]
    }],
    "allowances": [{ "reason": "Annual contract discount", "amount": 100, "vatRate": 21 }],
    "charges": [{ "reason": "Handling fee", "amount": 50, "vatRate": 21 }]
  }'
```

### Export invoice as XML

```bash
curl --fail https://api.getpeppr.dev/v1/invoices/inv_abc123/as/xml.ubl.invoice.bis3 \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -o invoice.xml
```

### Export the document as transmitted (UBL XML, SBDH envelope included)

```bash
curl --fail https://api.getpeppr.dev/v1/invoices/inv_abc123/as/original \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -o invoice-transmitted.xml
```

Use `/as/payload` for the same document without the SBDH envelope. There is no JSON export: what left for the network is XML.

`--fail` is on every one of these for the same reason it is on the PDF call: without
it, curl writes the JSON error body into the file you named, and you end up holding
an `.xml` that is not XML.

It covers HTTP errors, and only those. A transfer that dies *after* the first bytes
arrive still leaves a truncated file behind — on curl 7.83 and later, add
`--remove-on-error` to have curl delete it. It is left out of the commands above on
purpose: older curl builds reject the flag outright, which would break the copy for
the very reader it is meant to protect.

## Validation

### Validate an invoice

```bash
curl -X POST https://api.getpeppr.dev/v1/validate \
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

### Validate an invoice server-side

The gateway runs the same SDK validation stack, verifies UBL XML generation under
`ubl`, and returns validation findings as HTTP `200` with `valid: false`.
The `xsd` field is deprecated compatibility metadata and mirrors `ubl.valid`.

```bash
curl -X POST https://api.getpeppr.dev/v1/validate/server \
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

## Contacts

### List contacts

```bash
curl https://api.getpeppr.dev/v1/contacts \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Create a contact

```bash
curl -X POST https://api.getpeppr.dev/v1/contacts \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Globex NV",
    "peppolId": "0208:BE0987654321",
    "country": "BE",
    "email": "billing@globex.be"
  }'
```

### Update a contact

```bash
curl -X PUT https://api.getpeppr.dev/v1/contacts/ct_abc123 \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invoicing@globex.be",
    "street": "Rue du Commerce 42"
  }'
```

### Delete a contact

```bash
curl -X DELETE https://api.getpeppr.dev/v1/contacts/ct_abc123 \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

## Bank Accounts

### List bank accounts

```bash
curl https://api.getpeppr.dev/v1/bank-accounts \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Create a bank account

```bash
curl -X POST https://api.getpeppr.dev/v1/bank-accounts \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "iban": "BE68539007547034",
    "bic": "BPOTBEB1",
    "name": "Main Business Account"
  }'
```

### Update a bank account

```bash
curl -X PUT https://api.getpeppr.dev/v1/bank-accounts/ba_abc123 \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Primary EUR Account"
  }'
```

### Delete a bank account

```bash
curl -X DELETE https://api.getpeppr.dev/v1/bank-accounts/ba_abc123 \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

## Transports

### List transport types

```bash
curl https://api.getpeppr.dev/v1/transports/types \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### List configured transports

```bash
curl https://api.getpeppr.dev/v1/transports \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Get a transport

```bash
curl https://api.getpeppr.dev/v1/transports/peppol \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Transports are read-only

`POST /v1/transports`, `PUT /v1/transports/:code` and `DELETE /v1/transports/:code` always answer
`405 Method Not Allowed` (result code `transports.managed_by_provider`): the transport is managed by
the Peppol access point, and the only configured one is `peppol`.

## Directory

### Lookup a Peppol participant

```bash
curl https://api.getpeppr.dev/v1/directory/0208/BE0456789012 \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Lookup with colon format

```bash
curl https://api.getpeppr.dev/v1/directory/0208:BE0456789012 \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Search the Peppol Directory

Search by name:

```bash
curl -X GET "https://api.getpeppr.dev/v1/directory/search?name=Acme&country=BE&limit=10" \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

Search by VAT number:

```bash
curl -X GET "https://api.getpeppr.dev/v1/directory/search?vatNumber=BE0685660237" \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Pre-send recipient validation

Choose one mode per invoice; both commands send when their checks pass.
These options check the Peppol Directory, not public network receive readiness.

Warn mode (non-blocking):

```bash
curl -X POST https://api.getpeppr.dev/v1/invoices \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -H "x-validate-recipient: warn" \
  -d @invoice.json
```

Strict mode rejects a recipient absent from the Directory with HTTP 422 and
`Getpeppr-Result-Code: invoices.recipient_not_in_directory`. Other 422 responses
are different validation failures:

```bash
curl -X POST https://api.getpeppr.dev/v1/invoices \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -H "x-validate-recipient: strict" \
  -d @invoice.json
```

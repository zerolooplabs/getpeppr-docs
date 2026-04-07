# cURL Examples

Replace `sk_sandbox_abc123...` with your actual API key.

## Invoices

### Send an invoice

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

### List invoices

```bash
curl https://api.getpeppr.dev/v1/invoices?limit=10&offset=0 \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Get invoice details

```bash
curl https://api.getpeppr.dev/v1/invoices/inv_abc123 \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Export invoice as PDF

```bash
curl https://api.getpeppr.dev/v1/invoices/inv_abc123/as/pdf \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -o invoice.pdf
```

### Send a credit note

```bash
curl -X POST https://api.getpeppr.dev/v1/invoices/send \
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
curl -X POST https://api.getpeppr.dev/v1/invoices/send \
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
curl https://api.getpeppr.dev/v1/invoices/inv_abc123/as/xml.ubl.invoice.bis3 \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -o invoice.xml
```

### Export invoice as JSON

```bash
curl https://api.getpeppr.dev/v1/invoices/inv_abc123/as/original \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -o invoice.json
```

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
curl https://api.getpeppr.dev/v1/transports/peppol_as4 \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

### Create a transport

```bash
curl -X POST https://api.getpeppr.dev/v1/transports \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "code": "email",
    "name": "Email Transport",
    "config": {
      "to": "invoices@example.com"
    }
  }'
```

### Update a transport

```bash
curl -X PATCH https://api.getpeppr.dev/v1/transports/email \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Email Transport",
    "config": {
      "to": "billing@example.com"
    }
  }'
```

### Delete a transport

```bash
curl -X DELETE https://api.getpeppr.dev/v1/transports/email \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

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

Warn mode (non-blocking):

```bash
curl -X POST https://api.getpeppr.dev/v1/invoices/send \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -H "x-validate-recipient: warn" \
  -d @invoice.json
```

Strict mode (rejects if recipient not found):

```bash
curl -X POST https://api.getpeppr.dev/v1/invoices/send \
  -H "Authorization: Bearer sk_sandbox_abc123..." \
  -H "Content-Type: application/json" \
  -H "x-validate-recipient: strict" \
  -d @invoice.json
```

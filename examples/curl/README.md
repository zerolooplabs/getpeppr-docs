# cURL Examples

Replace `sk_sandbox_abc123...` with your actual API key.

## Send an invoice

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

## Validate an invoice

```bash
curl -X POST https://api.getpeppr.dev/v1/validate \
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

## List invoices

```bash
curl https://api.getpeppr.dev/v1/invoices?limit=10&offset=0 \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

## Check invoice status

```bash
curl https://api.getpeppr.dev/v1/invoices/inv_abc123/status \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

## Lookup a Peppol participant

```bash
curl https://api.getpeppr.dev/v1/directory/0208/BE0456789012 \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

## List contacts

```bash
curl https://api.getpeppr.dev/v1/contacts \
  -H "Authorization: Bearer sk_sandbox_abc123..."
```

## Create a contact

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

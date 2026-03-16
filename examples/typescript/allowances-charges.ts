/**
 * Allowances & Charges Example
 *
 * Send an invoice with document-level and line-level discounts/surcharges.
 * - Document-level: applies to the entire invoice total
 * - Line-level: adjusts individual line subtotals before VAT
 */

import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

const result = await peppol.invoices.send({
  number: "INV-2026-099",

  from: {
    name: "Stark Industries BVBA",
    peppolId: "0208:BE0476748862",
    vatNumber: "BE0476748862",
    country: "BE",
  },

  to: {
    name: "Wayne Enterprises NV",
    peppolId: "0208:BE0123456789",
    country: "BE",
    buyerReference: "PO-2026-099",
  },

  lines: [
    {
      description: "Arc Reactor Maintenance Q1",
      quantity: 1,
      unitPrice: 50_000,
      vatRate: 21,
      // Line-level discount: €5,000 off this line
      allowances: [{ reason: "Loyalty discount", amount: 5_000 }],
    },
    {
      description: "Vibranium Shield Polish",
      quantity: 10,
      unitPrice: 250,
      vatRate: 21,
      // Line-level surcharge: €100 rush fee
      charges: [{ reason: "Rush delivery fee", amount: 100 }],
    },
  ],

  // Document-level discount: €1,000 off the total
  allowances: [
    {
      reason: "Volume discount (annual contract)",
      amount: 1_000,
      vatRate: 21,
    },
  ],

  // Document-level surcharge: €500 handling fee
  charges: [
    {
      reason: "Hazardous materials handling",
      amount: 500,
      vatRate: 21,
    },
  ],

  paymentTerms: "Net 30 days",
  paymentIban: "BE68539007547034",
});

console.log(`Sent! ID: ${result.id}, Status: ${result.status}`);

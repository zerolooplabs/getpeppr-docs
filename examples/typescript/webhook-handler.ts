/**
 * Webhook Handler Example
 *
 * Verify and process incoming webhook events from getpeppr.
 * Works with Express, Next.js, or any framework that provides the raw request body.
 */

import { webhooks, type WebhookEvent } from "@getpeppr/sdk";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

// ── Express.js example ──────────────────────────────────────

// Important: use express.raw() to get the raw body for signature verification.
// Do NOT use express.json() on the webhook route.

import express from "express";

const app = express();

app.post(
  "/webhooks/getpeppr",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["getpeppr-signature"] as string;
    const rawBody = req.body.toString("utf-8");

    let event: WebhookEvent;

    try {
      event = await webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook verification failed:", err);
      return res.status(400).send("Invalid signature");
    }

    // Process the event
    switch (event.type) {
      case "invoice.sent":
        console.log(`Invoice ${event.data.invoiceId} was delivered to the recipient's access point`);
        break;

      case "invoice.accepted":
        console.log(`Invoice ${event.data.invoiceId} was accepted by the recipient`);
        break;

      case "invoice.refused":
        console.error(`Invoice ${event.data.invoiceId} was refused by the recipient`);
        break;

      case "invoice.error":
        console.error(`Invoice ${event.data.invoiceId} delivery failed`);
        break;

      case "invoice.paid":
        console.log(`Invoice ${event.data.invoiceId} was paid`);
        break;

      // Inbound reception (pilot — contact support to enable): a supplier sent
      // a document TO one of your Legal Entities. Delivery is at-least-once —
      // deduplicate on data.receivedDocumentId, the stable idempotency key.
      case "inbound.invoice.received":
        console.log(`Received an invoice (${event.data.receivedDocumentId}) from the Peppol network`);
        break;

      case "inbound.creditnote.received":
        console.log(`Received a credit note (${event.data.receivedDocumentId}) from the Peppol network`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  }
);

app.listen(3000, () => console.log("Webhook server running on port 3000"));

// ── Next.js App Router example ──────────────────────────────
//
// // app/api/webhooks/getpeppr/route.ts
//
// import { webhooks } from "@getpeppr/sdk";
// import { NextRequest, NextResponse } from "next/server";
//
// export async function POST(req: NextRequest) {
//   const rawBody = await req.text();
//   const signature = req.headers.get("getpeppr-signature") ?? "";
//
//   try {
//     const event = await webhooks.constructEvent(
//       rawBody,
//       signature,
//       process.env.WEBHOOK_SECRET!
//     );
//
//     console.log(`Received webhook: ${event.type}`, event.data);
//
//     return NextResponse.json({ received: true });
//   } catch (err) {
//     console.error("Webhook verification failed:", err);
//     return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
//   }
// }

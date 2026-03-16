import { Peppol } from "@getpeppr/sdk";

const peppol = new Peppol({ apiKey: "sk_sandbox_..." });

// List received invoices from your Peppol inbox
const received = await peppol.invoices.listReceived({
  limit: 10,
  offset: 0,
});

for (const doc of received) {
  console.log(`From:     ${doc.invoice.from.name}`);
  console.log(`Invoice:  ${doc.invoice.number}`);
  console.log(`Received: ${doc.receivedAt}`);
  console.log(`Lines:    ${doc.invoice.lines.length}`);
  console.log("---");
}

// Access the raw UBL XML if needed
const first = received[0];
if (first) {
  console.log(first.rawXml); // Full UBL 2.1 XML
}

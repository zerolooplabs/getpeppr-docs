"""Webhook Handler Example (Flask)

Verify and process incoming webhook events from getpeppr.
Uses HMAC-SHA256 signature verification.
"""

import hashlib
import hmac
import json
import os
import time

from flask import Flask, Response, request

app = Flask(__name__)

WEBHOOK_SECRET = os.environ["WEBHOOK_SECRET"]


def verify_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    """Verify the Getpeppr-Signature header using HMAC-SHA256."""
    if not signature_header:
        return False

    parts = dict(pair.split("=", 1) for pair in signature_header.split(","))
    timestamp = parts.get("t", "")
    received_sig = parts.get("s", "")

    # Reject signatures older than 5 minutes
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False
    except ValueError:
        return False

    payload = f"{timestamp}.{raw_body.decode('utf-8')}"
    expected_sig = hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_sig, received_sig)


@app.route("/webhooks/getpeppr", methods=["POST"])
def handle_webhook() -> Response:
    raw_body = request.get_data()
    signature = request.headers.get("Getpeppr-Signature", "")

    if not verify_signature(raw_body, signature, WEBHOOK_SECRET):
        return Response("Invalid signature", status=400)

    event = json.loads(raw_body)

    match event["type"]:
        case "invoice.delivered":
            print(f"Invoice {event['data']['id']} was delivered via Peppol")
        case "invoice.accepted":
            print(f"Invoice {event['data']['id']} was accepted by the recipient")
        case "invoice.rejected":
            print(f"Invoice {event['data']['id']} was rejected: {event['data'].get('reason')}")
        case "invoice.failed":
            print(f"Invoice {event['data']['id']} delivery failed")
        case _:
            print(f"Unhandled event type: {event['type']}")

    return Response(json.dumps({"received": True}), status=200, content_type="application/json")


if __name__ == "__main__":
    app.run(port=3000)

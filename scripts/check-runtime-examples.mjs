/**
 * Execute published webhook, Python and TypeScript directory examples, including
 * the README pre-send snippet, against local fixtures.
 * Fixtures follow the API contract inspected on 2026-09-12: validation errors
 * are strings; strict recipient rejection has a specific result-code header;
 * inbound XML may contain 512 KiB before base64 encoding. This catches example
 * regressions, not deployment drift. No credentials or external calls are used.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { fencedBlocks } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(root, ".tmp-runtime-"));
let failed = 0;
let passed = 0;
async function check(label, run) {
  try {
    await run();
    passed++;
    console.log(`  ok   ${label}`);
  } catch (error) {
    failed++;
    console.error(`  FAIL ${label}: ${error.message}`);
  }
}

// Replace only the fixed-port startup, retaining the actual route, parser and
// SDK verification. The temporary module resolves the same installed packages.
async function checkWebhook() {
  const source = readFileSync(join(root, "examples/typescript/webhook-handler.ts"), "utf8");
  const startup = /^app\.listen\(3000,.*\);$/m;
  assert.match(source, startup, "cannot isolate the published webhook startup");
  const compiled = ts.transpileModule(source.replace(startup, "export default app;"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const entry = join(work, "webhook.mjs");
  writeFileSync(entry, compiled);
  const previousSecret = process.env.WEBHOOK_SECRET;
  process.env.WEBHOOK_SECRET = "whsec_local_runtime_fixture";
  const { default: app } = await import(pathToFileURL(entry).href);
  app.set("env", "test"); // Suppress Express's expected parser-error stack traces.
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const endpoint = `http://127.0.0.1:${server.address().port}/webhooks/getpeppr`;
  const xml = `<Invoice>${"x".repeat(512 * 1024 - 19)}</Invoice>`;
  assert.equal(Buffer.byteLength(xml), 512 * 1024);
  const event = {
    id: "evt_runtime_fixture", type: "inbound.invoice.received",
    createdAt: new Date().toISOString(),
    data: {
      receivedDocumentId: "doc_runtime_fixture", legalEntityId: "le_runtime_fixture",
      externalSubTenantId: null, documentType: "invoice", invoiceNumber: "INV-FIXTURE-001",
      sender: { peppolId: "0208:BE0123456789", name: "Fixture NV" },
      receivedAt: new Date().toISOString(), providerDocumentId: "provider_runtime_fixture",
      document: {
        format: "ubl", encoding: "base64", content: Buffer.from(xml).toString("base64"),
        sizeBytes: Buffer.byteLength(xml), contentOmittedReason: null,
      },
    },
  };
  async function deliver(body, secret = process.env.WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000)) {
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const previousError = console.error;
    console.error = () => {}; // Signature failures are expected and asserted below.
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: {
          "Content-Type": "application/json", "Getpeppr-Signature": `t=${timestamp},s=${signature}`,
        }, body, signal: AbortSignal.timeout(5000),
      });
      return { status: response.status, body: await response.text() };
    } finally { console.error = previousError; }
  }
  try {
    await check("webhook accepts signed inbound XML at 512 KiB", async () => {
      const result = await deliver(JSON.stringify(event));
      assert.equal(result.status, 200);
      assert.deepEqual(JSON.parse(result.body), { received: true });
    });
    await check("webhook rejects an invalid signature", async () => {
      assert.equal((await deliver(JSON.stringify({ ...event, data: {} }), "wrong-secret")).status, 400);
    });
    await check("webhook rejects an expired signature", async () => {
      assert.equal((await deliver(JSON.stringify({ ...event, data: {} }), undefined, 1)).status, 400);
    });
    await check("webhook rejects a signed body above 1 MiB", async () => {
      assert.equal((await deliver(JSON.stringify({ ...event, padding: "x".repeat(1024 * 1024) }))).status, 413);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousSecret === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = previousSecret;
  }
}

// runpy executes the source unchanged. A replacement requests module records
// every call; sockets are disabled as a second guard against any real send.
const pythonHarness = String.raw`
import contextlib, io, json, runpy, socket, sys, types
path, scenario = sys.argv[1:]
def deny(*args, **kwargs):
    raise AssertionError("Network access is forbidden in the example check")
socket.socket.connect = deny
socket.create_connection = deny
calls = []
class HTTPError(Exception):
    pass
class Response:
    def __init__(self, status, data, code=""):
        self.status_code, self.data = status, data
        self.headers = {"Getpeppr-Result-Code": code}
    def json(self):
        return self.data
    def raise_for_status(self):
        if self.status_code >= 400:
            raise HTTPError(str(self.status_code))
def get(url, **kwargs):
    calls.append({"method": "GET", "url": url})
    assert url.startswith("https://api.getpeppr.dev/v1/directory/")
    if url.endswith("/search"):
        return Response(200, {"meta": {"total_count": 0}, "data": []})
    return Response(200, {"name": "Fixture NV", "country": "BE", "capabilities": ["invoice"]})
def post(url, **kwargs):
    calls.append({"method": "POST", "url": url, **kwargs})
    if url.endswith("/validate"):
        assert scenario in ("invalid", "valid")
        return Response(200, {"valid": scenario == "valid",
            "errors": ["Customer country (to.country) is required", "Line 1: unitPrice is required"] if scenario == "invalid" else []})
    assert url == "https://api.getpeppr.dev/v1/invoices"
    status, code = {
        "recipient_missing": (422, "invoices.recipient_not_in_directory"),
        "bad_payload": (400, "invoices.required_fields_missing"),
        "other_422": (422, "invoices.validation_failed"),
        "missing_code": (422, ""),
        "success": (201, "invoices.submitted"),
    }[scenario]
    return Response(status, {"id": "fixture_invoice", "status": "submitted"}, code)
requests = types.ModuleType("requests")
requests.get, requests.post, requests.HTTPError = get, post, HTTPError
sys.modules["requests"] = requests
output = io.StringIO()
error = None
try:
    with contextlib.redirect_stdout(output):
        runpy.run_path(path, run_name="__main__")
except HTTPError as exc:
    error = str(exc)
print(json.dumps({"output": output.getvalue(), "httpError": error, "calls": calls}))
`;
function runPython(file, scenario) {
  try {
    return JSON.parse(execFileSync(process.env.PYTHON ?? "python3", [
      "-c", pythonHarness, join(root, "examples/python", file), scenario,
    ], { encoding: "utf8", timeout: 10000, stdio: "pipe" }));
  } catch (error) {
    throw new Error(String(error.stderr || error.message).trim().split("\n").slice(-3).join(" | "));
  }
}
function assertCompleteInvoice(call) {
  assert.equal(call.headers["x-validate-recipient"], "strict");
  const invoice = call.json;
  assert.ok(invoice.number);
  for (const field of ["name", "peppolId", "street", "city", "postalCode", "country"]) {
    assert.ok(invoice.to?.[field], `strict invoice requires to.${field}`);
  }
  assert.ok(invoice.buyerReference || invoice.orderReference, "invoice requires buyer/order reference");
  assert.ok(invoice.lines?.length > 0, "strict invoice requires line items");
  for (const line of invoice.lines) {
    assert.ok(line.description);
    for (const field of ["quantity", "unitPrice", "vatRate"]) assert.equal(typeof line[field], "number");
  }
}

const strictScenarios = {
  recipient_missing: [422, "invoices.recipient_not_in_directory"],
  bad_payload: [400, "invoices.required_fields_missing"],
  other_422: [422, "invoices.validation_failed"],
  missing_code: [422, ""],
  success: [201, "invoices.submitted"],
};
async function checkTypeScriptDirectory(scenario, sourceKind = "example") {
  let source;
  if (sourceKind === "readme") {
    const blocks = fencedBlocks(join(root, "README.md"), "typescript")
      .filter(({ code }) => code.includes("validateRecipient"));
    assert.equal(blocks.length, 1, "exactly one README pre-send snippet must execute");
    source = `import { Peppol } from "@getpeppr/sdk";
      const peppol = new Peppol({ apiKey: "sk_sandbox_runtime_fixture" });
      const data = {
        number: "INV-FIXTURE-001", buyerReference: "PO-FIXTURE-001",
        to: { name: "Fixture NV", peppolId: "0208:BE0987654321",
          street: "Rue de la Loi 200", city: "Brussels", postalCode: "1000", country: "BE" },
        lines: [{ description: "Consulting", quantity: 1, unitPrice: 1000, vatRate: 21 }],
      };\n${blocks[0].code}`;
  } else source = readFileSync(join(root, "examples/typescript/directory-lookup.ts"), "utf8");
  const entry = join(work, `directory-${sourceKind}-${scenario}.mjs`);
  writeFileSync(entry, ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const saved = { fetch: globalThis.fetch, log: console.log, error: console.error };
  const output = [];
  const posts = [];
  let caught;
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).startsWith("https://api.getpeppr.dev/v1/"));
    const path = new URL(url).pathname;
    if (options.method === "GET" && path.startsWith("/v1/directory/")) {
      return Response.json(path.endsWith("/search") ? { data: [], meta: { total_count: 0 } } : {
        name: "Fixture NV", peppolId: "0208:BE0987654321", country: "BE", capabilities: ["invoice"],
      });
    }
    assert.equal(options.method, "POST");
    assert.equal(path, "/v1/invoices");
    const mode = new Headers(options.headers).get("X-Validate-Recipient");
    assert.equal(mode, "strict", "the example must validate before its only send");
    posts.push({ headers: { "x-validate-recipient": mode }, json: JSON.parse(options.body) });
    const [status, code] = strictScenarios[scenario];
    return Response.json({ id: "fixture_invoice", status: "submitted", rawStatus: "submitted" }, {
      status, headers: { "Getpeppr-Result-Code": code },
    });
  };
  console.log = console.error = (...args) => output.push(args.join(" "));
  try { await import(pathToFileURL(entry).href); }
  catch (error) { caught = error; }
  finally { globalThis.fetch = saved.fetch; console.log = saved.log; console.error = saved.error; }
  assert.equal(posts.length, 1, `must execute exactly one strict request; error: ${caught?.message ?? "none"}`);
  assertCompleteInvoice(posts[0]);
  if (["recipient_missing", "success"].includes(scenario)) assert.equal(caught, undefined);
  else assert.equal(caught?.statusCode, strictScenarios[scenario][0], "other failures must propagate");
  if (scenario === "recipient_missing") assert.match(output.join("\n"), /Recipient not (?:registered|found)/);
  else assert.doesNotMatch(output.join("\n"), /Recipient not (?:registered|found)/);
}

try {
  try { await checkWebhook(); }
  catch (error) { await check("webhook runtime setup", () => { throw error; }); }
  for (const scenario of ["invalid", "valid"]) {
    await check(`Python validation: ${scenario}`, () => {
      const result = runPython("validate_invoice.py", scenario);
      assert.equal(result.httpError, null);
      assert.equal(result.calls.length, 1);
      if (scenario === "invalid") {
        assert.match(result.output, /Customer country \(to.country\) is required/);
        assert.match(result.output, /Line 1: unitPrice is required/);
      } else assert.doesNotMatch(result.output, /Customer country|Line 1: unitPrice/);
    });
  }
  for (const scenario of Object.keys(strictScenarios)) {
    await check(`Python strict recipient: ${scenario}`, () => {
      const result = runPython("directory_lookup.py", scenario);
      const posts = result.calls.filter((call) => call.method === "POST");
      assert.equal(posts.length, 1, "strict example must attempt exactly one invoice request");
      assertCompleteInvoice(posts[0]);
      if (scenario === "recipient_missing") {
        assert.equal(result.httpError, null);
        assert.match(result.output, /Recipient not found/);
      } else if (scenario === "success") {
        assert.equal(result.httpError, null);
        assert.doesNotMatch(result.output, /Recipient not found/);
      } else {
        assert.equal(result.httpError, scenario === "bad_payload" ? "400" : "422");
        assert.doesNotMatch(result.output, /Recipient not found/);
      }
    });
    await check(`TypeScript strict recipient: ${scenario}`, () => checkTypeScriptDirectory(scenario));
    await check(`README strict recipient: ${scenario}`, () => checkTypeScriptDirectory(scenario, "readme"));
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`\nRuntime examples: ${passed} passed, ${failed} failed.`);
process.exitCode = failed ? 1 : 0;

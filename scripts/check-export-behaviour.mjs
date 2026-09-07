/**
 * RUNS the published export examples against a local server that replays the
 * gateway's real answers, and refuses the one outcome that hurts: a file named
 * `.pdf` that is not a PDF.
 *
 * ## Why this check exists
 *
 * Every other check in this repository PARSES. `check:examples` type-checks,
 * `check:python` byte-compiles, `check:shell` runs `bash -n`. Each of them says
 * so in its own header, and `check-python.mjs` names this exact gap in its list
 * of what it cannot see: "a value written to a file with the wrong extension".
 *
 * That gap shipped. Until GPR-1265 the gateway answered `GET /invoices/{id}/as/pdf`
 * with `200` and the UBL XML when no PDF existed; the examples were written for
 * that, and told the reader to sniff `Content-Type` or the `%PDF-` marker. The
 * gateway now answers `404 application/json`, so the published branch that was
 * supposed to save XML never runs — and the cURL example, which had no `--fail`,
 * wrote the JSON error body into `invoice.pdf`. Six surfaces promised a fallback
 * the API had stopped performing, and a green CI said nothing, because none of
 * these files had ever been EXECUTED.
 *
 * ## What the server replays
 *
 * The statuses, headers and bodies below are TRANSCRIBED from a real sandbox
 * probe run on 2026-09-07 against `api.getpeppr.dev` serving commit a64645c,
 * on an invoice that already existed (no document was sent):
 *
 *   GET /v1/invoices/{guid}/as/pdf       -> 404 application/json
 *                                           Getpeppr-Result-Code: invoices.export_format_unavailable
 *                                           {"error":"Format \"pdf\" is not available for this invoice",
 *                                            "availableMimeTypes":["application/xml"]}
 *   GET /v1/invoices/{guid}/as/original  -> 200 application/xml, 5888 bytes
 *
 * They are copied rather than invented on purpose: a fixture that a human made
 * up tests the fixture. When the gateway changes these, this file is wrong and
 * must be re-measured — that is the trade this check accepts in exchange for
 * making no network request of its own.
 *
 * ## What it does NOT prove
 *
 * That the gateway still answers this way. Nothing here talks to getpeppr; the
 * examples are pointed at 127.0.0.1 and the run ABORTS before executing anything
 * if a rewritten source still mentions `api.getpeppr.dev`, so a failed rewrite
 * can never silently reach the real API. Contract drift on the other side is
 * caught by re-probing, not by this file.
 */
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { fencedBlocks, assertFound, safe } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORK = join(root, ".tmp-export-behaviour");

// ─── The replayed gateway ──────────────────────────────────────────────────

const XML_BODY =
  '<?xml version="1.0" encoding="UTF-8"?><sh:StandardBusinessDocument' +
  ' xmlns:sh="http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader">' +
  "<sh:StandardBusinessDocumentHeader/></sh:StandardBusinessDocument>";

// A minimal but genuine PDF: the byte marker the old examples sniffed for is
// the first thing an assertion below reads back, so it has to be real.
const PDF_BODY = Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "latin1");

const UNAVAILABLE = {
  status: 404,
  headers: {
    "Content-Type": "application/json",
    "Getpeppr-Result-Code": "invoices.export_format_unavailable",
    "Getpeppr-Result-Message":
      "The invoice exists, but its sending evidence does not contain the requested export format. The response body lists the available MIME types.",
    "Getpeppr-Remediation": "fix_request",
    "Getpeppr-Retryable": "false",
    "Getpeppr-Result-Docs": "https://getpeppr.dev/docs/send-invoice/",
  },
  body: JSON.stringify({
    error: 'Format "pdf" is not available for this invoice',
    availableMimeTypes: ["application/xml"],
  }),
};

const NOT_FOUND = {
  status: 404,
  headers: {
    "Content-Type": "application/json",
    "Getpeppr-Result-Code": "invoices.not_found",
    "Getpeppr-Result-Message": "No invoice is visible under this id for this account and environment.",
    "Getpeppr-Remediation": "fix_request",
    "Getpeppr-Retryable": "false",
    "Getpeppr-Result-Docs": "https://getpeppr.dev/docs/document-status/",
  },
  body: JSON.stringify({ error: "Invoice not found" }),
};

const GUID = "b37ad511-95c4-42a1-a93a-3b347361e0ea";

/**
 * @param {"pdf_available"|"pdf_unavailable"|"invoice_not_found"} scenario
 */
function startGateway(scenario) {
  // Every path the replay does not recognise is recorded and handed back to the
  // caller. Without this a mismatch is not an error but a SILENCE: the SDK's
  // waitFor polled an unmatched 404 for its whole timeout and the run simply
  // hung, which reads as a slow check rather than a broken one.
  const unexpected = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const send = (status, headers, body) => {
      res.writeHead(status, headers);
      res.end(body);
    };
    const json = (status, obj) => send(status, { "Content-Type": "application/json" }, JSON.stringify(obj));

    // The document lifecycle the workflow examples walk through before they
    // ever reach an export. `rawStatus` is required by the SDK since 4.0.0.
    if (req.method === "POST" && path === "/v1/invoices") {
      req.resume();
      req.on("end", () =>
        json(201, { id: GUID, status: "submitted", rawStatus: "submitted", providerDocumentId: GUID }),
      );
      return;
    }
    if (req.method === "GET" && /^\/v1\/invoices\/[^/]+$/.test(path)) {
      return json(200, { id: GUID, status: "delivered", rawStatus: "delivered", providerDocumentId: GUID });
    }

    const asMatch = /^\/v1\/invoices\/[^/]+\/as\/(.+)$/.exec(path);
    if (req.method === "GET" && asMatch) {
      const format = decodeURIComponent(asMatch[1]);
      if (scenario === "invoice_not_found") {
        // The whole document is unknown — every format answers the same way.
        // An example that treats this as "no PDF, take the XML" would loop
        // straight into a second 404, so this scenario exists to catch a
        // fallback keyed on the STATUS instead of on the result code.
        return send(NOT_FOUND.status, NOT_FOUND.headers, NOT_FOUND.body);
      }
      if (format === "pdf") {
        return scenario === "pdf_available"
          ? send(200, { "Content-Type": "application/pdf" }, PDF_BODY)
          : send(UNAVAILABLE.status, UNAVAILABLE.headers, UNAVAILABLE.body);
      }
      return send(200, { "Content-Type": "application/xml" }, XML_BODY);
    }

    unexpected.push(`${req.method} ${path}`);
    return json(404, { error: "unexpected path in the export-behaviour replay: " + safe(path) });
  });
  server.unref();
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, unexpected }));
  });
}

// ─── Pointing an example at it ─────────────────────────────────────────────

/**
 * Rewrites one published source so it talks to the replay instead of the API.
 *
 * Returns the rewritten text, and THROWS when a rewrite it expected did not
 * happen. Both halves matter: a rewrite that silently matched nothing would
 * leave the example aimed at the production API — a check that reaches the
 * network is a different check from the one this file claims to be.
 */
function pointAtReplay(source, kind, port) {
  const origin = `http://127.0.0.1:${port}`;
  // The SDK's DEFAULT_BASE_URL is "https://api.getpeppr.dev/v1": the version
  // segment lives in the BASE, not in the paths appended to it. Handing it an
  // origin alone aims every SDK call at /invoices while Python and cURL ask for
  // /v1/invoices — the replay would then answer the two languages differently,
  // which is the one thing a shared fixture must never do.
  const base = kind === "ts" ? `${origin}/v1` : origin;
  let out = source;
  let rewrites = 0;

  if (kind === "ts") {
    // The SDK's own documented hook: "Use `baseUrl` to point to a custom
    // instance or localhost."
    out = out.replace(/new Peppol\(\{/g, () => {
      rewrites++;
      return `new Peppol({ baseUrl: ${JSON.stringify(base)},`;
    });
  } else {
    out = out.replace(/https:\/\/api\.getpeppr\.dev/g, () => {
      rewrites++;
      return base;
    });
  }

  if (rewrites === 0) {
    throw new Error("no rewrite matched — this example no longer has the shape this check knows how to redirect");
  }
  if (out.includes("api.getpeppr.dev")) {
    throw new Error("a mention of api.getpeppr.dev survived the rewrite — refusing to execute");
  }
  return out;
}

// ─── What each example is allowed to leave behind ──────────────────────────

/**
 * `exit`      — 0 means the example must succeed; "nonzero" means it must fail.
 * `xml`       — true when a non-empty .xml file is required (the explicit
 *               second request), false when NO .xml may be produced.
 * `pdf`       — true when a real PDF must be on disk.
 *
 * Every scenario also carries one assertion no case can opt out of: no file
 * with a .pdf name may exist unless it starts with %PDF-. That is the defect
 * this check was written for, and it is asserted on the CAUSE (a mislabelled
 * file) rather than on any particular file name.
 */
const CASES = [
  {
    id: "typescript/export-invoice.ts",
    kind: "ts",
    file: "examples/typescript/export-invoice.ts",
    expect: {
      pdf_available: { exit: 0, pdf: true },
      pdf_unavailable: { exit: 0, pdf: false, xml: true },
      invoice_not_found: { exit: "nonzero", pdf: false },
    },
  },
  {
    id: "typescript/invoice-workflow.ts",
    kind: "ts",
    file: "examples/typescript/invoice-workflow.ts",
    expect: {
      pdf_available: { exit: 0, pdf: true },
      pdf_unavailable: { exit: 0, pdf: false, xml: true },
      invoice_not_found: { exit: "nonzero", pdf: false },
    },
  },
  {
    id: "python/export_invoice.py",
    kind: "py",
    file: "examples/python/export_invoice.py",
    expect: {
      pdf_available: { exit: 0, pdf: true },
      pdf_unavailable: { exit: 0, pdf: false, xml: true },
      invoice_not_found: { exit: "nonzero", pdf: false },
    },
  },
  {
    id: "python/invoice_workflow.py",
    kind: "py",
    file: "examples/python/invoice_workflow.py",
    expect: {
      pdf_available: { exit: 0, pdf: true },
      pdf_unavailable: { exit: 0, pdf: false, xml: true },
      invoice_not_found: { exit: "nonzero", pdf: false },
    },
  },
];

// The cURL export block is discovered, not transcribed: a copy here would be
// the thing under test and the test at once, and would drift the day someone
// edits the README.
const CURL_FILE = join(root, "examples/curl/README.md");
const bashBlocks = fencedBlocks(CURL_FILE, "bash");

const curlPdfBlocks = bashBlocks.filter((b) => /\/as\/pdf/.test(b.code));
assertFound(curlPdfBlocks.length, 1, "cURL blocks exporting /as/pdf");
for (const block of curlPdfBlocks) {
  CASES.push({
    id: `curl/README.md:${block.line} (pdf)`,
    kind: "bash",
    inline: block.code,
    expect: {
      // A shell block cannot branch on a result code without becoming a program
      // nobody would paste. What is asked of it is narrower and is the half that
      // matters: fail loudly, and leave no file behind.
      pdf_available: { exit: 0, pdf: true },
      pdf_unavailable: { exit: "nonzero", pdf: false, xml: false },
      invoice_not_found: { exit: "nonzero", pdf: false, xml: false },
    },
  });
}

// The XML blocks are the fallback the prose now tells the reader to make for
// himself. Documenting a second request without executing it would leave exactly
// the kind of unverified instruction this check exists to retire.
//
// Every XML format is matched, not just the one the PDF note points at: this
// filter is what found the defect the ticket had not listed. Two long-standing
// blocks wrote `-o invoice.xml` with no `--fail`, so a 404 landed in a file
// named `.xml` — the same harm as the PDF case, on a surface nobody had looked
// at because it never mentions a PDF.
const curlXmlBlocks = bashBlocks.filter((b) => /\/as\/(original|payload|xml\.)/.test(b.code));
assertFound(curlXmlBlocks.length, 2, "cURL blocks exporting an XML format");
for (const block of curlXmlBlocks) {
  CASES.push({
    id: `curl/README.md:${block.line} (xml)`,
    kind: "bash",
    inline: block.code,
    expect: {
      pdf_available: { exit: 0, pdf: false, xml: true },
      pdf_unavailable: { exit: 0, pdf: false, xml: true },
      invoice_not_found: { exit: "nonzero", pdf: false, xml: false },
    },
  });
}

assertFound(CASES.length, 7, "export cases (four code examples plus three cURL blocks)");

/**
 * Signatures of an example that never ran, as opposed to one that ran and
 * behaved.
 *
 * This exists because the first run of this check reported four Python cases as
 * `ok`: `import requests` raised, the script wrote no file, and "wrote no file"
 * is exactly what two of the three scenarios require. A missing interpreter
 * dependency was therefore INDISTINGUISHABLE from a correct refusal to write —
 * a check whose two possible answers produce the same output measures nothing.
 */
const NEVER_RAN = /ModuleNotFoundError|No module named|Cannot find package|Cannot find module|ERR_MODULE_NOT_FOUND|command not found/;

// ─── Run ───────────────────────────────────────────────────────────────────

const SCENARIOS = ["pdf_available", "pdf_unavailable", "invoice_not_found"];
const failures = [];

// ⛔ ASYNCHRONOUS, and it has to be. The replay server lives in THIS process, so
// a synchronous `execFileSync` would block the event loop for as long as the
// example runs — the requests queue in the TCP backlog and are never answered.
// The failure does not look like a deadlock: the example simply times out or
// gets no response, and every assertion below then reports a defect of the
// EXAMPLE for something the harness did to it.
const run = promisify(execFile);

async function runCase(testCase, scenario, port) {
  const dir = join(WORK, `${scenario}__${testCase.id.replace(/[^a-z0-9]+/gi, "-")}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const source = testCase.inline ?? readFileSync(join(root, testCase.file), "utf8");
  const rewritten = pointAtReplay(source, testCase.kind, port);

  const ext = { ts: ".ts", py: ".py", bash: ".sh" }[testCase.kind];
  const script = join(dir, `example${ext}`);
  writeFileSync(script, rewritten);

  const argv = {
    // --experimental-strip-types runs the .ts file as published, with no build
    // step and no transform of our own inserted between the reader's copy and
    // what executes here.
    ts: [process.execPath, ["--experimental-strip-types", script]],
    py: [process.env.PYTHON ?? "python3", [script]],
    bash: ["bash", [script]],
  }[testCase.kind];

  let exit = 0;
  let output = "";
  try {
    const { stdout, stderr } = await run(argv[0], argv[1], { cwd: dir, timeout: 60_000 });
    output = String(stdout ?? "") + String(stderr ?? "");
  } catch (err) {
    // `execFile` reports the exit status on `code`, unlike the sync variant's
    // `status`. A timeout kills the child and leaves `code` null, so the `?? 1`
    // is what keeps a hung example from being scored as a clean exit 0.
    exit = typeof err.code === "number" ? err.code : 1;
    output = String(err.stdout ?? "") + String(err.stderr ?? "");
  }
  return { dir, exit, output };
}

/** Every file the example left in its working directory, with its first bytes. */
function producedFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name !== "example.ts" && name !== "example.py" && name !== "example.sh")
    .map((name) => {
      const buf = readFileSync(join(dir, name));
      return { name, ext: extname(name).toLowerCase(), size: buf.length, head: buf.subarray(0, 5).toString("latin1") };
    });
}

for (const scenario of SCENARIOS) {
  const { server, port, unexpected } = await startGateway(scenario);
  try {
    for (const testCase of CASES) {
      const label = `${scenario}  ${testCase.id}`;
      let result;
      try {
        result = await runCase(testCase, scenario, port);
      } catch (err) {
        failures.push(`${label}: ${safe(err.message)}`);
        console.error(`  FAIL ${label}`);
        console.error(`  - ${safe(err.message)}`);
        continue;
      }

      const unseen = unexpected.splice(0);
      const want = testCase.expect[scenario];
      const files = producedFiles(result.dir);
      const problems = [];

      // Asserted before anything else, and asserted for EVERY scenario: an
      // example that died before its first request tells us nothing about the
      // behaviour under test, and silently satisfies any expectation phrased as
      // "wrote no file".
      if (NEVER_RAN.test(result.output)) {
        problems.push(
          "the example never ran — a dependency is missing from this environment " +
            "(Python examples need `pip install -r examples/python/requirements.txt`)",
        );
      }

      // A path the replay could not answer means this check no longer models
      // the API the example calls. Reported as a defect of the CHECK, and
      // reported FIRST: every assertion below is about an example that ran
      // against the gateway this file claims to replay.
      if (unseen.length > 0) {
        problems.push(
          `the replay did not recognise ${unseen.length} request(s): ${unseen.slice(0, 3).map(safe).join(", ")}`,
        );
      }

      // The invariant, asserted for every case in every scenario.
      for (const f of files) {
        if (f.ext === ".pdf" && f.head !== "%PDF-") {
          problems.push(`wrote ${safe(f.name)} (${f.size} bytes) but it does not start with %PDF-`);
        }
      }

      const exitOk = want.exit === "nonzero" ? result.exit !== 0 : result.exit === 0;
      if (!exitOk) problems.push(`expected exit ${want.exit}, got ${result.exit}`);

      const realPdfs = files.filter((f) => f.ext === ".pdf" && f.head === "%PDF-");
      if (want.pdf === true && realPdfs.length === 0) problems.push("expected a PDF on disk, found none");
      if (want.pdf === false && files.some((f) => f.ext === ".pdf")) {
        problems.push(`expected no .pdf file, found ${files.filter((f) => f.ext === ".pdf").map((f) => safe(f.name)).join(", ")}`);
      }

      const xmls = files.filter((f) => f.ext === ".xml" && f.size > 0);
      if (want.xml === true && xmls.length === 0) {
        problems.push("expected the explicit XML request to leave a non-empty .xml file, found none");
      }
      if (want.xml === false && xmls.length > 0) {
        problems.push(`expected no .xml file, found ${xmls.map((f) => safe(f.name)).join(", ")}`);
      }

      if (problems.length === 0) {
        console.log(`  ok   ${label}`);
      } else {
        failures.push(`${label}: ${problems.join("; ")}`);
        console.error(`  FAIL ${label}`);
        for (const p of problems) console.error(`  - ${safe(p)}`);
        const tail = result.output.trim().split("\n").slice(-4).join(" | ");
        if (tail) console.error(`  - output: ${safe(tail)}`);
      }
    }
  } finally {
    server.close();
  }
}

rmSync(WORK, { recursive: true, force: true });

// Outside the loop: `process.exit` does not unwind, so exiting inside it would
// leave the replay servers and the working directory behind.
if (failures.length > 0) {
  console.error(`\n${failures.length} export behaviours are wrong across ${CASES.length} examples and ${SCENARIOS.length} scenarios.`);
  process.exit(1);
}
console.log(`\n${CASES.length} examples behave correctly in all ${SCENARIOS.length} export scenarios.`);

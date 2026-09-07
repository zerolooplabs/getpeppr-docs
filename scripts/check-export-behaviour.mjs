/**
 * RUNS the published export examples against a local server that replays the
 * gateway's real answers, and refuses the outcome that hurts: a file whose first
 * bytes contradict the name it was given — a `.pdf` that is not a PDF, a `.xml`
 * that is not XML.
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
 * ## What the server replays, and where each part comes from
 *
 * Not all of it carries the same weight, so the provenance is stated per part
 * rather than claimed wholesale — a fixture a human made up tests the fixture.
 *
 * MEASURED, from a sandbox probe run on 2026-09-07 against `api.getpeppr.dev`
 * serving commit a64645c, on an invoice that already existed (nothing was sent):
 *
 *   GET /v1/invoices/{guid}/as/pdf       -> 404 application/json
 *                                           Getpeppr-Result-Code: invoices.export_format_unavailable
 *                                           {"error":"Format \"pdf\" is not available for this invoice",
 *                                            "availableMimeTypes":["application/xml"]}
 *   GET /v1/invoices/{guid}/as/original  -> 200 application/xml, 5888 bytes
 *
 * COPIED from the gateway's own source, not from the wire: `NOT_FOUND` and
 * `FORMAT_INVALID` (their codes, statuses and catalogue sentences), and
 * `VALID_FORMATS`.
 *
 * INVENTED, because only their shape matters: the XML body, the PDF bytes (a
 * real `%PDF-` header, since an assertion reads it back), the document ids, and
 * the send/status responses the workflow examples walk through.
 *
 * ⚠️ The `pdf_available` branch is CONSTRUCTED, not measured. The probe above
 * answered 404 — the sandbox rarely renders a PDF, which is the whole reason
 * this ticket exists — so no real 200-with-a-PDF was ever captured. Its shape
 * follows the route's success path (`apiBinary("invoices.export_returned", …)`),
 * and re-measuring it needs an invoice that actually has a PDF rendering.
 *
 * When the gateway changes any of the measured or copied parts, this file is
 * wrong and must be re-measured — that is the trade this check accepts in
 * exchange for making no network request of its own.
 *
 * ## What it does NOT prove
 *
 * That the gateway still answers this way. Nothing here is meant to talk to
 * getpeppr: the examples are pointed at 127.0.0.1, and three guards compose to
 * keep it that way — the rewrite throws when it matches nothing, it throws when
 * a literal `api.getpeppr.dev` survives it, and every case must have reached the
 * replay at least once or it fails.
 *
 * ⚠️ The second guard is empty on the TypeScript path, and saying otherwise
 * would overstate it: the host name lives in the SDK's DEFAULT_BASE_URL, never
 * in the published source, so there is no literal there to catch. What covers
 * that path is the first guard, plus the request count — an example that
 * silently kept the SDK default reaches the network but leaves the replay with
 * nothing recorded, and is failed for it rather than scored on its files.
 *
 * Contract drift on the other side is caught by re-probing, not by this file.
 */
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { fencedBlocks, assertFound, findFiles, rel, safe } from "./lib/markdown.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORK = join(root, ".tmp-export-behaviour");

// ─── The replayed gateway ──────────────────────────────────────────────────

const XML_BODY =
  '<?xml version="1.0" encoding="UTF-8"?><sh:StandardBusinessDocument' +
  ' xmlns:sh="http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader">' +
  "<sh:StandardBusinessDocumentHeader/></sh:StandardBusinessDocument>";

// ⚠️ NOT a valid PDF, and it does not need to be — but the comment that used to
// call it "genuine" was wrong, and a false claim in a fixture is how the next
// reader ends up trusting it for something it cannot do. There is no xref table
// and no catalogue; `pdfinfo` refuses it. What matters here is only that it
// carries the `%PDF-` marker the assertions read back, and that its LENGTH is
// distinctive: an example that writes a hardcoded `%PDF-` instead of the bytes
// it received passes a marker check and fails a length check.
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

// Mirrors VALID_FORMATS in the gateway route. A replay that answers 200 to any
// string is not a replay of this API: it accepts format names the real one
// refuses, which is how a published typo stays invisible.
const VALID_FORMATS = new Set(["pdf", "xml.ubl.invoice.bis3", "xml.facturae.3.2", "original", "payload"]);

const FORMAT_INVALID = {
  status: 400,
  headers: {
    "Content-Type": "application/json",
    "Getpeppr-Result-Code": "invoices.export_format_invalid",
    "Getpeppr-Result-Message": "The requested export format is not one this endpoint produces.",
    "Getpeppr-Remediation": "fix_request",
    "Getpeppr-Retryable": "false",
  },
  body: JSON.stringify({
    error: 'Invalid format. Valid formats: pdf, xml.ubl.invoice.bis3, xml.facturae.3.2, original, payload',
  }),
};

const GUID = "b37ad511-95c4-42a1-a93a-3b347361e0ea";

/**
 * What the real route sends on a success, from `apiBinary("invoices.export_returned", …)`.
 *
 * None of the seven examples reads any of it — the SDK does not consult the
 * result rail on a 2xx, Python tests `status_code` first, and no cURL block uses
 * `-O`/`-J`. It is here because a replay that answers more thinly than the API
 * quietly stops being a replay: the first example to read a success header would
 * be tested against a response shape that never existed.
 */
function exportReturnedHeaders(contentType, extension) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `inline; filename="invoice-${GUID}.${extension}"`,
    "Getpeppr-Result-Code": "invoices.export_returned",
    "Getpeppr-Result-Message": "The invoice document was returned in the requested format.",
    "Getpeppr-Remediation": "none",
    "Getpeppr-Retryable": "false",
  };
}

/**
 * @param {"pdf_available"|"pdf_unavailable"|"invoice_not_found"} scenario
 */
function startGateway(scenario) {
  // Every path the replay does not recognise is recorded and handed back to the
  // caller, so a mismatch names itself instead of being inferred from whatever
  // the example did next.
  //
  // ⚠️ Measured, against the first draft of this comment: an unmatched path does
  // NOT hang the SDK — `waitFor` calls `getStatus`, which throws on the 404 in
  // milliseconds. What hangs is an unmatched path answered `200` with a
  // non-terminal status, where `waitFor` polls until `runCase`'s timeout kills
  // it. Both cases are diagnosed by this list; only the second is slow.
  const unexpected = [];
  // Which export formats were asked for, in order. Counting them is what
  // separates a fallback keyed on the RESULT CODE from one keyed on the bare
  // 404 status: on an unknown invoice both end with a non-zero exit and no
  // file, so the observable outcome is identical — only the number of requests
  // differs (one, versus a pointless second that earns its own 404).
  const asRequests = [];
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
      asRequests.push(format);
      if (scenario === "invoice_not_found") {
        // The whole document is unknown — every format answers the same way.
        // An example that reads this as "no PDF, take the XML" asks a second
        // time and earns a second 404; it is caught by the request COUNT, not
        // by the files it left, which are the same either way.
        return send(NOT_FOUND.status, NOT_FOUND.headers, NOT_FOUND.body);
      }
      if (!VALID_FORMATS.has(format)) {
        // The real route rejects an unknown format name before doing anything
        // else. Answering 200 to any non-pdf string made a typo in a published
        // format name — `xml.ubl.invoice.bis30` on three surfaces at once —
        // completely invisible: every example saved its file and passed.
        return send(FORMAT_INVALID.status, FORMAT_INVALID.headers, FORMAT_INVALID.body);
      }
      if (format === "pdf") {
        return scenario === "pdf_available"
          ? send(200, exportReturnedHeaders("application/pdf", "pdf"), PDF_BODY)
          : send(UNAVAILABLE.status, UNAVAILABLE.headers, UNAVAILABLE.body);
      }
      return send(200, exportReturnedHeaders("application/xml", "xml"), XML_BODY);
    }

    unexpected.push(`${req.method} ${path}`);
    return json(404, { error: "unexpected path in the export-behaviour replay: " + safe(path) });
  });
  server.unref();
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, unexpected, asRequests }));
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
    // ⛔ Refused rather than rewritten. The injection below puts `baseUrl` FIRST
    // in the object literal, so an example that already declares its own would
    // win as the later key — and would then run against the SDK's production
    // default with the host name appearing NOWHERE in the source for the guard
    // below to catch. No published example does this today; failing loudly is
    // what keeps that from becoming a silent outbound request the day one does.
    if (/\bbaseUrl\b/.test(out)) {
      throw new Error(
        "this example already sets baseUrl — the rewrite would be shadowed by it, so it is refused rather than executed",
      );
    }
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
 * `exit`       — 0 means the example must succeed; "nonzero" means it must fail.
 * `fallbackXml`— the EXACT file the explicit second request must leave behind,
 *                non-empty. Named, not counted: two of these examples also save
 *                XML further down in unconditional sections, and an assertion
 *                phrased as "some .xml exists" was satisfied by those. Deleting
 *                the fallback entirely — the very regression this repository
 *                exists to prevent — kept the check green until this field
 *                replaced it.
 * `xml`        — true when SOME non-empty .xml is required (used where the
 *                example writes exactly one), false when NO .xml may be produced.
 * `pdf`        — true when a file carrying the `%PDF-` marker, of exactly the
 *                length the replay sent, must be on disk. NOT "a real PDF": the
 *                fixture is not a valid document and this check never opens one.
 *                What it proves is that the bytes on disk are the bytes that
 *                came back — enough for the defect it exists for, and no more.
 * `asRequests` — exact number of /as/{format} requests the example may make.
 *                Set where the file evidence cannot discriminate on its own.
 *
 * Every scenario also carries two assertions no case can opt out of: no file
 * with a .pdf name may exist unless it starts with %PDF-, and the example must
 * have reached the replay at least once. The first is the defect this check was
 * written for, asserted on its CAUSE (a mislabelled file) rather than on any
 * particular name. The second is what stops an example that silently bypassed
 * the replay from being scored on the files it did not write.
 */
const CASES = [
  {
    id: "typescript/export-invoice.ts",
    kind: "ts",
    file: "examples/typescript/export-invoice.ts",
    expect: {
      pdf_available: { exit: 0, pdf: true },
      pdf_unavailable: { exit: 0, pdf: false, fallbackXml: "invoice-original.xml" },
      invoice_not_found: { exit: "nonzero", pdf: false, asRequests: 1 },
    },
  },
  {
    id: "typescript/invoice-workflow.ts",
    kind: "ts",
    file: "examples/typescript/invoice-workflow.ts",
    expect: {
      pdf_available: { exit: 0, pdf: true },
      pdf_unavailable: { exit: 0, pdf: false, fallbackXml: "INV-2026-100-original.xml" },
      invoice_not_found: { exit: "nonzero", pdf: false, asRequests: 1 },
    },
  },
  {
    id: "python/export_invoice.py",
    kind: "py",
    file: "examples/python/export_invoice.py",
    expect: {
      pdf_available: { exit: 0, pdf: true },
      pdf_unavailable: { exit: 0, pdf: false, fallbackXml: "invoice-original.xml" },
      invoice_not_found: { exit: "nonzero", pdf: false, asRequests: 1 },
    },
  },
  {
    id: "python/invoice_workflow.py",
    kind: "py",
    file: "examples/python/invoice_workflow.py",
    expect: {
      pdf_available: { exit: 0, pdf: true },
      pdf_unavailable: { exit: 0, pdf: false, fallbackXml: "INV-2026-100-original.xml" },
      invoice_not_found: { exit: "nonzero", pdf: false, asRequests: 1 },
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
      invoice_not_found: { exit: "nonzero", pdf: false, xml: false, asRequests: 1 },
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
      invoice_not_found: { exit: "nonzero", pdf: false, xml: false, asRequests: 1 },
    },
  });
}

assertFound(CASES.length, 7, "export cases (four code examples plus three cURL blocks)");

// The four code examples are listed by hand, because each carries expectations
// no walk could infer — which file its fallback must leave, how many requests it
// may make. But `lib/markdown.mjs` sets the opposite convention for this
// repository ("Discovery is by WALK, never by a hardcoded list"), and a hand
// list silently stops covering the example added next to it.
//
// So the list is hand-written and the COVERAGE is discovered: any example that
// exports a document must appear above, or this fails naming it. Three lines
// against the one failure mode a minimum count cannot see — growth, rather than
// collapse.
const exportingExamples = findFiles(join(root, "examples"), /\.(ts|py)$/).filter((file) =>
  /getAs\(|\/as\//.test(readFileSync(file, "utf8")),
);
const uncovered = exportingExamples.filter(
  (file) => !CASES.some((c) => c.file && join(root, c.file) === file),
);
if (uncovered.length > 0) {
  throw new Error(
    `these examples export a document but have no case here: ${uncovered.map((f) => safe(rel(root, f))).join(", ")}`,
  );
}

/**
 * Signatures of an example that never ran, as opposed to one that ran and
 * behaved.
 *
 * This exists because the first run of this check reported two Python cases as
 * `ok` for the wrong reason: `import requests` raised, the script wrote no file,
 * and "wrote no file" is exactly what the `invoice_not_found` scenario requires.
 * A missing interpreter dependency was therefore INDISTINGUISHABLE from a correct
 * refusal to write — a check whose two possible answers produce the same output
 * measures nothing.
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
  const { server, port, unexpected, asRequests } = await startGateway(scenario);
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
      const asked = asRequests.splice(0);
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

      // The invariant, asserted for every case in every scenario, on BOTH
      // extensions. A file is refused when its first bytes contradict the name
      // it was given — that is the defect this check exists for, and it does not
      // care which name was wrong.
      //
      // The .xml half is not symmetry for its own sake: writing `response` where
      // `fallback` was meant — a one-word slip, the kind review misses — puts the
      // 404's JSON body into a file called `invoice-original.xml`. Right name,
      // non-empty, wrong bytes.
      for (const f of files) {
        if (f.ext === ".pdf" && f.head !== "%PDF-") {
          problems.push(`wrote ${safe(f.name)} (${f.size} bytes) but it does not start with %PDF-`);
        }
        if (f.ext === ".xml" && !f.head.startsWith("<")) {
          problems.push(`wrote ${safe(f.name)} (${f.size} bytes) but it does not start with "<" — not XML`);
        }
      }

      const exitOk = want.exit === "nonzero" ? result.exit !== 0 : result.exit === 0;
      if (!exitOk) problems.push(`expected exit ${want.exit}, got ${result.exit}`);

      // The saved PDF must be the bytes the replay sent, byte-length included.
      // Asserted on the length because the marker alone accepts an example that
      // writes a constant `%PDF-` and never looks at the response at all.
      const realPdfs = files.filter((f) => f.ext === ".pdf" && f.head === "%PDF-");
      if (want.pdf === true && realPdfs.length === 0) problems.push("expected a PDF on disk, found none");
      if (want.pdf === true) {
        for (const f of realPdfs) {
          if (f.size !== PDF_BODY.length) {
            problems.push(
              `wrote ${safe(f.name)} with ${f.size} bytes, but the replay sent ${PDF_BODY.length} — ` +
                `the file is not what came back`,
            );
          }
        }
      }
      if (want.pdf === false && files.some((f) => f.ext === ".pdf")) {
        problems.push(`expected no .pdf file, found ${files.filter((f) => f.ext === ".pdf").map((f) => safe(f.name)).join(", ")}`);
      }

      // An unknown invoice must cost exactly one export request. Asserted on the
      // COUNT because the files and the exit status cannot tell the two apart:
      // a fallback keyed on the bare 404 asks again, is refused again, and ends
      // in the same place as the correct example. A mutant that made exactly
      // that substitution survived this check until the count was added.
      if (typeof want.asRequests === "number" && asked.length !== want.asRequests) {
        problems.push(
          `expected ${want.asRequests} export request(s), saw ${asked.length}: ${asked.map(safe).join(", ") || "none"}`,
        );
      }

      // Every example must have reached the replay. Without this, an example
      // that never talked to it at all — a rewrite that stopped matching, an
      // SDK that dropped the baseUrl option — is scored on the files it did not
      // write, and "wrote no .pdf" reads as a pass.
      if (asked.length === 0) {
        problems.push("the example made no /as/{format} request — it never reached the replay");
      }

      const xmls = files.filter((f) => f.ext === ".xml" && f.size > 0);

      // Named, not counted. `export-invoice.ts` and `export_invoice.py` also
      // save XML in unconditional sections further down, so "some .xml exists"
      // stayed true with the fallback DELETED OUTRIGHT — the exact regression
      // this repository exists to prevent, passing green on two of seven cases.
      if (typeof want.fallbackXml === "string" && !xmls.some((f) => f.name === want.fallbackXml)) {
        problems.push(
          `expected the explicit XML request to leave a non-empty ${safe(want.fallbackXml)}; produced ` +
            `${files.map((f) => safe(f.name)).join(", ") || "no files at all"}`,
        );
      }
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

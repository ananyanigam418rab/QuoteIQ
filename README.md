# QuoteIQ — RudCo RFQ Intelligence

**Link to App:** [https://p-138f41dfd63da9ac.preview.ninoo.app/](https://p-138f41dfd63da9ac.preview.ninoo.app/)

**Track 2: RFQ to Quote** · A procurement copilot that converts messy industrial requests into defensible, evidence-backed quote drafts and buyer clarifications.

## Import to Ninoo (judge demo — no keys needed)

1. Open **https://ninoo.ai/switch/** (official Ninoo ZIP importer), select **ZIP file**, upload the **`rudco-quoteiq.zip`** archive, then **Import**. Ninoo's docs say ZIP imports are supported, Vite/React is its recommended stack, and its importer runs the project preview. Sign in if prompted.
2. Let Ninoo install the npm dependencies. The Vite app starts with `npm run dev` on port 5173.
3. Click **Load demo RFQ** -> **Analyze RFQ**. Inspect line six: unspecified stainless grade and pipe schedule are not guessed, and a buyer email is offered. Review pricing and supplier evidence; approve items only after reviewing docs; download the draft PDF.
4. Import an actual catalog from **Supplier Catalog**. Supported CSV/XLSX headings are shown on the page.

**Important deployment distinction:** The ZIP makes the browser demo work out of the box. The *live* Nicrron model call and Block Convey PRISM trace require a securely hosted API with environment secrets; importing a Vite frontend does not automatically provision a server backend. This repository contains both a local Node server and a Cloudflare Worker for that. You must deploy one backend and configure secrets for those integrations to be operational in a published Ninoo site. Do not claim live tracing until the Trust & Audit page confirms a trace was ingested.

## Required feature matrix

| Requirement | Implementation |
|---|---|
| Messy email / PDF / spreadsheet upload | Browser PDF text extraction, XLSX, CSV, TXT, EML, paste, drag/drop |
| Standardized spec | Explicit parser for grade/material/form/gauge/inches/dimensions/qty/ASTM |
| Catalog matching | Exact grade/form/ASTM; tolerance-aware dimension validation and alternative sourcing suggestions |
| Competitive pricing | Catalog price × transparent volume adjustment, plus per-SKU benchmark comparison. Sample prices **illustrative, not live**. |
| Compliance | MTR, COO, US origin flags; no fake verification; human review gate |
| Uncertain lines | Required questions for missing grade, pipe schedule, dimensions, qty, mismatch, no SKU |
| Ready-to-send quote | Draft PDF of cleared lines only, CSV export, email clarification draft; final documents and live price require human confirmation |
| NicrronNinoo | Build/import using Ninoo; Nicrron API extraction via secure backend; fallback if unavailable |
| Block Convey | PRISM HTTP trace with session/agent identity via secure backend; UI shows whether actually delivered |
| Judges can inspect outputs | Per-item audit, price source, confidence, compliance, buyer question and downloadable JSON |

## Local run (fully offline, no credentials)

Node 20 or newer:

```bash
npm install
npm run dev
# visit http://localhost:5173
npm test
```

Sample data and catalog are included. Browser core is functional **without any AI key**.

## Local run with live Nicrron + PRISM

Create `.env` from `.env.example` **locally** and fill in credentials there; do not put keys into the frontend or GitHub:

```dotenv
NICRRON_API_KEY=<secure key>
PRISMTRACE_API_KEY=<secure key>
PRISMTRACE_PROJECT_ID=<project UUID>
ALLOWED_ORIGIN=http://localhost:5173
PORT=8787
```

```bash
npm run dev:full
```

This launches Vite (port 5173) and the server (port 8787). Frontend requests to `/api/*` are proxied through Vite. In the interface, check **Trust & Audit**: model `Nicrron-assisted + validation` means extracted AI lines passed conservative local checks; `Trace successfully ingested` means PRISM acknowledged ingestion. If the model is down, the app transparently uses the deterministic rules engine.

Verified public API contracts (not invented endpoints):
- **Nicrron** `POST https://api.nicrron.ai/v1/chat/completions`; `Authorization: Bearer ...`; `model: nicrron/auto`. https://nicrron.ai/docs/quickstart
- **Block Convey PRISM** `POST https://prism.blockconvey.com/api/traces`; `X-PRISMtrace-Key`; required `project_id`, `model`, `input_messages`, `output_message`, `latency_ms`. https://blockconvey.com/docs

## Public Ninoo deployment + live integrations

`worker/src/index.ts` contains a **Cloudflare Worker** that provides the same `/api/health` and `/api/analyze` endpoints and keeps the API keys off the public site. Requires a Cloudflare account and CLI:

```bash
npm install -g wrangler
cd worker
wrangler login
wrangler secret put NICRRON_API_KEY
wrangler secret put PRISMTRACE_API_KEY
wrangler secret put PRISMTRACE_PROJECT_ID
# Set ALLOWED_ORIGIN in worker/wrangler.toml to your published *.ninoo.app URL
wrangler deploy
```

The published Vite frontend must be rebuilt with `VITE_API_BASE_URL=https://YOUR-WORKER.workers.dev` (a public address only; **never** a secret). In Ninoo, configure this value in its build environment and republish. Alternatively have the Ninoo agent wire the Worker URL into `src/App.tsx`. The frontend's Trust & Audit page reports actual connection/trace status. Ninoo's own publishing support for secret-backed functions is not asserted here.

## Make your custom supplier catalog

Accepted columns:

```csv
sku,material,grade,form,thickness_in,width_in,length_in,diameter_in,schedule,astm,price,benchmark_min,benchmark_max,stock,origin,mtr,coo
SKU-001,Stainless Steel,304,Sheet,0.0625,48,96,,,ASTM A240,198,188,235,180,US,yes,yes
```

Only first worksheet is loaded. Dimensions are **inches**; price and benchmark fields are **USD per unit**. Blank standards or missing dimensions block exact matching. Standard, MTR, COO and origin still need physical supplier confirmation. Import replaces the demo catalog in this browser session.

## Quote policy / trust boundaries

- Each line passes through explicit validation, not straight from an LLM into a quote.
- **16ga stainless reference = 0.0625 in; 0.060 in is a different value.** They will not be silently substituted.
- Sample SKU prices and market benchmark ranges are **fictional illustrative seed data**, not live market quotes. No scraping or third-party price oracle is claimed.
- A benchmark below/within/above range is evidence from the **currently loaded** catalog, not proof of the best price in the market.
- Catalog MTR and COO flags mean *offered*, not that a certificate was reviewed; final documents and heat/lot must be checked.
- An uncertain or unmapped line is withheld from the PDF subtotal unless a person corrects it; review-only lines require human confirmation.
- The PDF is intentionally labeled **Draft quotation** until independently verified.
- No automatic supplier/buyer email is sent. The application safely opens a prepared email for the user to send.
- Uploaded files are processed in-browser. In live-AI mode, RFQ text is sent to the configured backend and model provider, and input/output traces to PRISM. Do not use confidential RFQs without authorization.

## Limitations

- Browser PDF extraction supports *text PDFs*, not image-only scanned PDFs/OCR.
- Multi-product items on a single prose paragraph may need manual line breaks.
- The parser handles common sheet/plate/pipe industrial specs; unusual units, alloys or encodings should result in review/clarifications.
- No external authenticated ERP or real-time market data feed is connected. Replace demo data with actual supplier price/stock/benchmark data for production.
- No persistent database or user authentication; this is a hackathon prototype.
- Use full integration tests with working credentials after deploying, especially before claiming operational PRISM.

## Security

**Never paste keys into `src/`, `index.html`, `vite.config.ts` or `VITE_*` variables.** Frontend variables are public. Secrets are read only by `server/index.mjs` or `worker/src/index.ts` from server/worker environment. `.env` is ignored by git. If credentials were pasted in a public chat, repository or screen recording, rotate them before publishing.

## Project tree

- `src/App.tsx` — complete interactive UI, human review and analytics
- `src/engine.ts` — deterministic parser, match/price engine, uncertainty + audit
- `src/files.ts` — RFQ and catalog uploads, text PDF extraction
- `src/exports.ts` — PDF/CSV/JSON/questions exports
- `src/catalog.ts` — transparent synthetic test supplier inventory
- `server/index.mjs` — optional secure Node backend with Nicrron and PRISM
- `worker/src/index.ts` — optional Cloudflare Worker endpoint
- `tests/engine.test.mjs` — regression checks
- `DEVPOST.md` — project submission copy and demo script

# Devpost — QuoteIQ: From RFQ Chaos to Confident Quotes

**Track:** Track 2 | RudCo | RFQ to Quote

**One-liner:** A safety-first industrial procurement copilot that normalizes messy RFQs, matches supplier SKUs, explains prices and automatically escalates uncertain details instead of inventing them.

**What we built:** QuoteIQ transforms buyer emails, PDFs, CSV and XLSX files into a live dashboard of normalized industrial line items with grade, gauge, dimensions, ASTM standards and quantity. It matches physical catalog inventory, produces inspectable unit and extended price calculations versus catalog benchmark bands, and flags MTR, COO, and domestic-origin requirements. Items without safe matches are held with specific buyer questions. Users can manually correct an item, approve review items, export a draft quote PDF and generate a buyer clarification email.

**Why:** Industrial RFQs vary wildly in spelling, gauge/dimensions and missing paperwork. Quoting the wrong grade or wall thickness can be more damaging than not quoting immediately. QuoteIQ treats uncertainty as a first-class workflow.

**Accuracy and uncertainty:** A deterministic validator sits after Nicrron AI extraction (when enabled). The LLM is not trusted to invent technical values; grade, quantity, shape, sizes and ASTM are verified against the source and the actual catalog. A missing pipe schedule / grade creates an actionable question. Near-equivalent gauges are not silently substituted. PRISM tracks actual agent exchanges when the secure backend is configured. The interface never equates an unavailable trace with a successful connection.

**Tools:** Ninoo Builder (imported React/Vite application); Nicrron Gateway (`nicrron/auto`, optional live line extraction through server-side API); Block Convey PRISM (real trace ingestion via server-side `/api/traces`, when configured); React, TypeScript, Vite, PDF.js, SheetJS, jsPDF, Node.js, Cloudflare Worker option.

**Source code:** [ADD YOUR PUBLIC GITHUB LINK]

**Demo video:** [ADD YOUR VIDEO LINK]

**Team:** [TEAM MEMBER NAMES AND ROLES]

## 90-second video walk-through

**0:00–0:10** — "Industrial buyers describe the same metal item five different ways. Wrong matches mean costly quotes. QuoteIQ makes every decision inspectable."

**0:10–0:25** — Click **Load demo RFQ**. Show 6 messy items, click **Analyze RFQ**.

**0:25–0:45** — Expand line one: raw text becomes grade 304, 16 gauge converted to 0.0625in, 4x8ft to 48x96in, ASTM A240. Show exact catalog SKU, transparent quantity pricing, illustrative benchmark band and MTR/COO document review flag.

**0:45–1:00** — Expand line six ("SS pipe 3 inch x 20ft"). QuoteIQ refuses to guess grade or schedule and generates buyer questions. Open **Correct & reprocess**; insert `304 SS pipe 3\" sch 40 x 20ft qty 10 ASTM A312` and show a match (domestic origin still needs review if specified).

**1:00–1:15** — Go to **Supplier Catalog**, show source transparency and upload option. Return, approve a review line after demonstrating certification warning. Download the draft PDF — unclear lines are excluded.

**1:15–1:30** — Open **Trust & Audit**. Show the explainability ledger and JSON. If the live backend is configured, display verified Nicrron mode and **PRISM trace successfully ingested** in both dashboards. If not configured, clearly say this is the offline safety engine, and do not assert a live trace.

## Judging differentiators

- **Trust (5/5 target):** uncertainty gate, original source lines, audit trail, review actions, PRISM integration.
- **Execution:** runnable intake, 6-line sample, supplier matching, quote totals, PDF/CSV/JSON, repeatable unit tests.
- **Usability:** 3-step journey, loading example, drag-drop files, clear statuses, one-click buyer questions.
- **Originality:** "No phantom quotes" — quote generation is conditional on real evidence, not fluent AI guesses.

> Pricing data in the bundled sample catalog is fictitious demo data. Do not present it as a live industry benchmark or a binding supplier offer.

# Session Summary

This is the durable project context for future changes. The application uses one workspace and the existing unit/godown and party-ledger pattern. Read this file before changing company setup, locations, catalog fields or gate-pass workflows.

# Decisions Made

- All human-facing text displays in uppercase across screens, portals, entry controls, print/PDF, CSV and Excel exports. This is presentation only: retain stored names, references, location codes and request values. Passwords (including revealed passwords), email/URL inputs and explicit `data-preserve-case` values retain exact case. Export helpers preserve URLs, emails, technical IDs, numeric/date types and formulas. Do not migrate existing records to uppercase or uppercase authentication payloads.
- Rozain Textile and ZR Trading are distinct sibling companies, represented as units/godowns and linked parties in the same application. Do not restore a company dropdown, separate workspaces or automatic paired-company posting in normal user flows.
- Existing records belong to Rozain Textile. Keep their IDs, stock, balances and location codes. Do not introduce historical/read-only modes or ownership-review migration requirements.
- The `OWN` ownership option displays **Rozain Textile**, including fabric/yarn forms and stock ownership summaries. Owner dropdowns exclude exact Rozain Textile, Rozain Textile Godown and Rozain Knitting party aliases. These aliases resolve to `OWN` for stock/yarn lookups and new postings; existing party IDs, financial balances and stored ownership references remain intact. ZR Trading and other clients remain distinct owners. Avoid ambiguous labels such as “This business” or “Business-owned”. Ownership and godown location remain separate; retain the `OWN` value and existing party IDs.
- Use **Rozain Textile** as the single business name across ownership, the main stock location, dashboards, documents and report headings. Do not introduce Rozain Knitting or Rozain Textile Godown as alternative business labels. `ZR_GODOWN` remains the main location's technical code; retain all stock, party and ledger IDs. `ZR_TRADING_GODOWN` means **ZR Trading Godown**. Never label both as ZR, and never duplicate a location code in a dropdown.
- Location selectors and filters must use `useLocations` and server-registered active units. Preserve custom godowns/mills; do not copy hard-coded arrays into forms.
- Paper references are strings: retain leading zeros and slashes. Use **Gate pass / challan number**; the mill's outgoing gate pass is an inward receipt for us.
- A linked dyeing return consumes the recorded issue allocation. A receipt with no earlier issue records only actual finished stock, with no fabricated issue, raw weight, production or wastage.
- Reusable fabric names use `CatalogField`, explicit Other/add-name entry, and transactional catalog persistence. A name is not stock.
- Stock selectors use `StockChoice`. Other records physically available stock with measured rolls/kg and an audit reason before selection. Never bypass stock checks or invent available inventory merely from a name.
- Add another starts blank; Copy is explicit. Modal dropdowns start closed. Shared components must retain system theme, dark black surfaces, mobile sizing and local spinner-only loading.
- Knitting wastage is the actual kg entered manually, including zero. Never restore an automatic 1% deduction.
- A nested dialog form must stop submit propagation so it cannot submit its parent delivery/transfer form. Missing-stock entry must select existing matching stock rather than count it again.

# Completed Work

- Uppercase presentation now covers all pages, shared controls, native confirmation/error messages, printed PDFs and CSV/Excel content. Verified server/client builds, case-sensitive login (including revealed password), every-page browser checks, mobile/dark layouts, export type/formula/link preservation, 12 uppercase PDFs and 13 reopened CSV/XLSX downloads. Wrapped paper references are validated across line breaks.
- Previous baseline: single workspace, sibling godown and linked party, original-data compatibility, source-based stock/billing corrections and saved verification suite.
- Current work: central location labeling in selectors, filters and printed documents; Other fabric names and audited missing-stock entry; gate-pass terminology; external mill receipt/history, printing and controlled correction through the existing receipt source.
- The saved suite now covers external-mill receipt retries, no fabricated production/issue/wastage, invalid quantities returning 400, missing-stock duplicate protection, reusable names, unique location options, actual PDF contents and nested stock-dialog submission.
- Final `npm run verify` passed: server/client builds, request-policy checks, isolated API workflows, real browser workflows, 12 actual PDF samples and 13 reopened CSV/XLSX downloads. Visual review included the external mill form/receipt and missing-stock delivery selector.

# Pending Work

None for the requested dropdown and gate-pass changes. Existing live-database access remains an environment limitation noted below.

# Known Issues

- Earlier implementation incorrectly introduced separate company workspaces and a historical-review gate. Those assumptions were rejected by the user and must not return.
- Earlier forms copied location lists and labeled `ZR_GODOWN` as ZR, causing missing Rozain choices and duplicate options. Earlier direct dyeing receipt UI submitted unmatched batches to an endpoint that required a prior issue.
- Visual inspection caught a nested stock form's submit bubbling to the parent delivery form. It is now stopped in `StockChoice`, and the browser test asserts no delivery error after saving/selecting stock.
- Previous live-database inspection failed at MongoDB DNS resolution. Verification uses isolated data; do not claim live records were inspected or migrated without evidence.
- Repository convention: no new source-code comments; strict TypeScript; shared components/tokens; `cn` for dynamic classes. Markdown is broadly ignored, so durable docs use a `README.md` inside a descriptive folder.

# Next Recommended Step

Read these decisions before future changes. When changing entry controls or stock/receipt workflows, run `npm run verify` and inspect the saved screenshots and actual PDFs. Extend the regression scenarios for any new behavior instead of reintroducing copied selectors or a new company model.

# Workspace UI

The interface defaults to the operating system appearance. `ThemeProvider` watches system changes and supports an explicit light or dark preference through `ThemePicker`. Preferences use the `rozain-theme` storage key.

## Foundations

All interface text uses the global uppercase presentation rule, including portals, placeholders, dropdowns and printed pages. Keep underlying record/request values intact. Passwords, email/URL inputs and `data-preserve-case` content preserve exact case; password visibility toggles retain this exception. CSV exports use `uppercaseDisplay`; server Excel/report exports use `uppercaseWorkbook`. Never uppercase passwords, link targets, formula source or stored identifiers to achieve visual formatting.

Use the semantic colors in `src/index.css`: `canvas`, `surface`, `subtle`, `muted`, `line`, `control`, `strong`, `ink`, `soft`, `brand`, `brand-soft`, `primary`, `danger`, `danger-soft`, `warning`, `warning-soft`, `info`, and `info-soft`. Choose colors by meaning so each component works in both themes. Primary actions use white text on `primary` in either theme.

Use restrained borders, rounded corners, Lucide icons, and a clear hierarchy. Page titles use 24–28 px, content and controls 14 px, and dense labels/table content 12–13 px. Numeric values use tabular figures. Keep every business field and action available when changing density or layout.

## Component registry

| Component | Purpose and variants | Interaction requirements |
| --- | --- | --- |
| `PageHeader` | Page title, explanation, and wrapping actions | One main title per route; actions wrap on phones |
| `Button` | Primary, secondary, outline, ghost, destructive; small, medium, large | Loading and disabled states, visible keyboard focus, existing submission guards |
| `Input` / `Select` | Labelled fields and validation | Generated ID when needed; associated labels, error descriptions, numeric constraints |
| `PartyCombobox` | Party search and permitted custom names | Starts closed on modal focus; click or typing opens; Arrow keys, Enter, Escape, clear selection, visible active option |
| `Card` / `Badge` | Content surfaces and compact status | Semantic theme colors; status always has text |
| `Dialog` | Operational forms, mobile navigation, previews | Portal, focus trap, focus restoration, Escape, scroll lock, scrollable body, fixed footer |
| `FormSection` | Numbered groups of related fields | Required work stays visible; collapse only optional information |
| `OptionalDetails` | Secondary setup, reports, optional entry fields | Native keyboard-accessible disclosure |
| `FormFeedback` / `QueryError` | Save feedback and data-load recovery | Announced states; retain inputs after failure; retry records explicitly |
| `WorkflowActions` | Clear next steps for knitting and dyeing | Describe what the user is sending or receiving |
| `ScrollableTable` | Wide operational registers | Keep every column; scroll in a contained region and show an overflow hint |
| `PaginationControls` | Page and row-count selection | Named controls, current-page indication, disabled boundaries |
| `ThemedSpinner`, `LoadingState`, `Skeleton` | Loading feedback | Spinner only with an accessible name and reduced-motion support; full-screen loading is reserved for startup |

`AppLayout` owns grouped navigation, the responsive menu, current workspace context, theme selection and sign-out. Module screens retain their original filters, history, exports, permissions and domain workflows.

## Forms and dense entry

Group party, fabric, quantity, billing and transport fields into meaningful steps. Associate footer submit buttons with the form ID. New entry dialogs mount for each opening so old input does not appear as a new transaction. Keep edit state and contextual receipt/transfer information. Use generic examples. Challan fields accept plain numbers and existing references; party codes are optional and generated when omitted. Preserve historical codes.

`RapidGridEntry` retains Enter-to-add roll entry, gross/tare/net calculations, add/remove controls and totals. Its table scrolls on small screens instead of shrinking weight fields.

## Printing exception

Printed invoices, gate passes, statements and registers use white paper and dark text in both themes. Print media forces a light browser color scheme to keep page margins white. `#print-area` isolates the active document, removes app controls, and resets scrolling and sticky elements for A4 output. Source references remain visible on paper while interactive controls are hidden. Business registers use actual inward/outward source events; filtered printing includes every matching page. Paper typography and widths may differ from screen controls.

## Lists, requests and exports

Use `useQueryPagination` for server lists and `useListPagination` for small cached setup catalogs. Search waits 300 ms; changes to filters reset the page before querying. Server lists use stable ordering and limits up to 100. Summary totals cover all matching records.

`requestPolicy` deduplicates identical concurrent requests and throttles successful reads for 300 ms. Mutations invalidate recent reads; session changes isolate request keys. Auth, uploads and independently cancellable calls retain their own behavior. Inactive operational tabs do not fetch list data. Party options share cached queries and load every bounded page.

`fileDownload`, `csvExport` and `reportExport` centralize UTF-8 CSV encoding, safe text, server filenames, delayed object URL cleanup, duplicate download protection and visible export failures. Inventory CSV and statement CSV/PDF include all matching records. Ledger Excel retains the complete statement for the chosen date range. Excel generation caches formula results, handles empty reports and safe worksheet names, and repeats table headers across printed pages.

## Validation

The development login shows the seeded testing admin account and a button to fill the form without submitting it. A testing production build can opt in with `VITE_SHOW_TEST_CREDENTIALS=true`; normal production builds omit the hint.

Use isolated fixture data for destructive or transactional browser checks. Verify keyboard entry, request payloads, failed-save retry, desktop/mobile layouts, system/light/dark behavior, and actual PDF output. Run `npm run build --prefix client` and `npm run build --prefix server` from the repository root. Download and reopen each workbook type, inspect CSV contents beyond one list page, and inspect first/last pages of long PDF documents.

## Business workflow patterns

The application has one workspace with ordinary routes and party ledger links. Sibling companies follow the existing unit/godown and linked-party pattern; there is no company selector. `CatalogField` supports a reusable fabric/yarn/shade name without leaving the form; `PartySelector` provides explicit inline party creation. Dynamic location choices use `useLocations` and include ZR Trading Godown.

`ZR_GODOWN` displays as Rozain Textile; ZR Trading uses `ZR_TRADING_GODOWN`. All location selectors, filters and paper renderers use registered location labels. `CatalogField` exposes Other/add-name entry and saves new names on blur; stock-posting transactions also remember fabric names. `StockChoice` is the shared stock picker with an audited Other/add-missing-stock path. It selects existing matching stock without adding quantity again and stops nested form submission from reaching the parent form.

Gate-pass fields use “Gate pass / challan number”. Receiving a mill's outgoing paper is an inward receipt. `ReceiveGatePassModal` distinguishes a recorded dyeing return from an external mill receipt with no earlier issue. External receipts record actual finished stock, retain the mill's paper reference/transport notes, and appear in their own paginated history under Received fabric.

`DocumentReferences` retains plain PO/external reference strings. `EntryCard` keeps Add another blank and Copy details explicit. `OperationForm` separates goods receipt from bill posting and supports editable drafts. `DocumentPreview` is the common paper renderer; `ReasonDialog` collects a reversal reason using the same accessible themed dialog instead of a native prompt.

Actual measured kg use up to three decimals. New knitting receipts require manually entered wastage, including zero. Source-linked billing exposes only unbilled quantities and identifies fully billed sources. Posted records are corrected from their sources; independent stock, bill and ledger edits must not diverge.

`npm run verify` runs the saved build, request-policy, isolated API, real-browser and downloaded-file checks. Existing records remain editable; ZR Trading uses a normal godown and separate party ledger in the same workspace. Operator notes are documented in `docs/verification/README.md`.

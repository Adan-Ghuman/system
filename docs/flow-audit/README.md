# System flow verification

Audit date: 2 November 2026. Run `npm run verify` from the repository root. Transaction fixtures use disposable MongoDB replica sets. Browser checks exercise the built client against those isolated APIs; they do not post live records.

## Coverage

| Flow | Verified behavior | Primary evidence |
| --- | --- | --- |
| Users and access | Login, revoked staff access, permission checks, business isolation, protected exports | business-flows.e2e.mjs |
| Parties and locations | One canonical own-fabric owner; independent owners retained; sibling godown uses ordinary party accounts | business-flows.e2e.mjs and its owner/location regressions |
| Yarn | Own/client receipts, measured packages/kg, issues, unused returns, signed corrections and dependency-ordered reversals | business-flows.e2e.mjs |
| Knitting | In-house/outside work, owner retention, explicit blends, actual wastage, partial consumption and receipt reversal | business-flows.e2e.mjs, consistent-transactions.e2e.mjs |
| Dyeing | Raw ECRU versus target shade, selected stock/location/owner, partial raw allocations, finished receipts, actual loss and ordered reversals | business-flows.e2e.mjs, consistent-transactions.e2e.mjs |
| External processing returns | Verified returned stock without an invented raw issue or loss | business-flows.e2e.mjs, consistent-transactions.e2e.mjs |
| Purchases and supplier charges | Receive/bill/pay together, receipt only, multiple earlier receipts, paper evidence, duplicate checks and atomic rollback | consistent-transactions.e2e.mjs |
| Sales and customer charges | Delivery/bill/receipt together, delivery only, later partial billing, multiple challans, client-owned service eligibility | unified-sales.e2e.mjs, consistent-transactions.e2e.mjs |
| Payments and refunds | Partial/full payment, existing voucher allocation without new cash, unlinking, overpayment protection, credit/refund correction order | business-flows.e2e.mjs, unified-sales.e2e.mjs, consistent-transactions.e2e.mjs |
| Credits and reversals | Original locations/ownership, physical versus financial-only credits, stock restoration once, dependent source protection | flow-corrections.e2e.mjs and transaction suites |
| Ledger | Chronological running/current balance reconciliation, backdated postings and source-linked correction protection | all transaction suites, flow-corrections.e2e.mjs |
| Stock | Transfers, returns, adjustments, nonnegative balances and final roll/kg reconciliation | business-flows.e2e.mjs, flow-corrections.e2e.mjs |
| Retry and concurrency | Durable replay, changed-payload rejection, simultaneous submissions, source locks and rollback after partial writes | all transaction suites |
| Drafts and recovery | Resume, legacy draft compatibility, review, lost-response recovery after reload, service-mode reset | unified-sales.browser.mjs, consistent-transactions.browser.mjs |
| Reports and documents | Complete pagination, source quantities, actual generated PDFs and reopened CSV/XLSX, unknown settlement display | inspect-pdfs.mjs, inspect-downloads.mjs and browser suites |
| Compatibility APIs | Paired trade/settlement/return, transit shortages and business-scoped accounts | business-flows.e2e.mjs |

## Corrections made during this audit

- Delivery reversal finds bills through header links, individual lines and work allocations. A bill spanning multiple deliveries must be reversed first; a rejected correction changes neither stock nor allocations.
- A source-linked ledger adjustment is protected from independent editing/deletion, including reversal entries. The UI follows the same rule.
- Active delivery invoice reads and invoice-type filters exclude reversed bills and reversed deliveries. Reversed deliveries no longer contribute to current delivery totals.
- A delivery fully billed through later bills offers its existing history instead of another billing action. Financial summary labels describe invoices created with delivery; later and combined bills remain in Transactions.
- Physical fabric returns must leave both remaining rolls and measured kg together. Financial-only credits retain their separate behavior.
- Historical yarn-with-knitters snapshots include issues reversed after the cutoff, while the current snapshot excludes them. Earlier balances no longer change when a later correction is posted.
- Changing a new customer's transaction type clears incompatible earlier lines/rates. Source-less legacy paper drafts retain their deliberate conversion behavior. Customer and search links carry their context into Transactions.

## Live-data audit boundaries

The live audit uses raw read-only collection queries, without application model initialization or import scripts. It checks party and running balances, ledger source ownership, voucher amounts, payment/credit allocations, work allocation capacity, stock validity and production balances. Detailed results and collection fingerprints stay outside version control.

Historical bills whose settlements were not recorded remain explicitly unknown. Source workbooks held for unresolved ownership or physical movements are not treated as available stock. Source arithmetic does not establish the accuracy of an original paper record, an actual cash receipt, physical quantities or ownership. These require source evidence and reconciliation.

Passing this suite establishes the listed tested behaviors, not a guarantee that every possible input, third-party outage or real-world record is correct. Re-run verification whenever a posting, reversal, ownership, allocation, permission or report rule changes.

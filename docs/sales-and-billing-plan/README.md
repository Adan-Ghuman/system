# Unified sales and billing implementation plan

Status: implemented 2 November 2026; release verification is recorded below.

## Intended outcome

Provide one **Sales & billing** workspace where an operator can choose a customer, record a fabric sale or service charge, enter the price, optionally record money received, and save. The system creates the appropriate linked records automatically. The operator remains in that workspace to view, print, receive later payments, or follow a correction.

The normal fabric-sale flow must not require a separate delivery screen or a generic Source dropdown. Completed knitting/dyeing work remains the basis for service charges, presented as recognizable work/challan entries belonging to the selected customer.

## Scope and defaults

- One customer and one transaction type per entry: **Fabric sale**, **Knitting charge**, or **Dyeing charge**.
- Fabric sales default to **Deliver & bill together**. Retain **Deliver only · bill later** and **Bill an existing delivery** as secondary paths inside the same workspace.
- Service charges in this workspace are customer receivables. Supplier invoices and charges from outside knitters/dyeing mills remain payable workflows, clearly labelled separately.
- Use the existing fabric delivery shape and per-roll gross/tare measurements. Preserve current quantity, tax, charge and print rules through shared calculation functions. Do not silently change an existing single-fabric delivery into a new multi-fabric invoice model.
- Payment choices: **Pay later**, **Part payment received**, **Full payment received**, and an optional **Use an existing receipt** path.
- Preserve the current single workspace, Rozain/ZR ownership distinctions, stock identity rules, manual wastage, document IDs and paper references.

## 1. Build the customer-first workspace

Introduce `/sales` as the main customer transaction entry point. Use a single form with visible sections rather than nested dialogs:

1. **Customer and transaction** — customer, type, date and paper references.
2. **Fabric or work** — sale stock and roll weights, or eligible completed service work.
3. **Price and charges** — rate basis, price, additional charges where supported, and tax selection.
4. **Payment** — payment timing, actual amount received, method, date and applicable bank/cheque/reference details.
5. **Review and save** — goods/work, bill total, amount received, remaining bill balance, and the records that will be created.

Select the customer once. A service receipt's processor must never replace that customer. Changing the customer/type/stock condition clears incompatible selections and refreshes eligible work or stock, while retaining unrelated form entries.

The success view stays on the same page and shows the saved transaction with actions to print the gate pass, invoice/service bill and receipt, record a later payment, or start a blank entry. Starting another entry must not copy quantities, rates or references automatically.

### Source selection and empty states

- **New fabric sale:** derive the delivery source from the new dispatch automatically; show no Source dropdown.
- **Bill an existing delivery:** display the customer's posted, unbilled deliveries using gate pass number, date, fabric, rolls, kg and remaining billable quantity. Previously billed quantities cannot be selected again.
- **Service charge:** display eligible completed knitting/dyeing receipt lines with challan, date, processor and remaining billable quantity. An outgoing dyeing batch is not completed work.
- If no eligible records exist, explain the specific reason and provide a contextual action. Examples: **No deliveries awaiting a bill → Start a new sale**, **No completed knitting work → Open knitting receipts**, or **No verified stock at this location → Review fabric stock**.
- Preserve an in-progress draft when following a contextual action and returning. Do not manufacture stock or a completed job to satisfy billing requirements.

## 2. Make posting one atomic operation

Add a customer-sales command endpoint, for example `POST /workspace/sales`, that accepts the complete reviewed submission and returns the persisted document IDs and totals.

Refactor the existing posting implementations into internal functions that accept a shared MongoDB session. Keep their existing public endpoints as compatible wrappers. The unified command runs these internal actions under **one** `postCommand` and **one** database transaction; do not call several existing transactional HTTP endpoints from the browser or start nested transactions.

| Selected flow | Records and effects |
|---|---|
| New fabric sale | Deduct stock once; create delivery/OGP; create linked invoice and customer bill; post one receivable debit. Preserve the existing Invoice/BusinessDocument linkage used by printing and reports. |
| Bill existing delivery | Allocate only its remaining unbilled quantity; create bill and receivable debit; leave stock unchanged. |
| Knitting/dyeing charge | Allocate eligible completed work; create the customer service bill and receivable debit; leave physical stock unchanged. |
| New payment with a bill | Create one receipt voucher and bill-payment allocation; post one customer credit; update the bill's allocated paid amount. |
| Existing receipt | Link the eligible existing voucher to the bill; create no second cash or customer-ledger entry. Retain current full-voucher allocation limits. |
| Deliver only | Deduct stock once and create the delivery; create no invoice or bill-linked payment. Existing independently recorded advances can be linked when billing later. |

Server calculations are authoritative. A read-only review/quote response can supply totals and validation messages, but it reserves no stock; all eligibility, stock and financial limits must be checked again when saving.

Use a required stable request ID for submission/retry, bound to the authenticated actor, business and payload. Retrying the same request returns the original records. Reusing it with changed values is rejected. A lost response must be recoverable without re-entering or reposting the sale.

All writes roll back together if stock, bill allocation or payment validation fails. Preserve ordered reversals and audit reasons for later corrections; saved financial documents are corrected through the existing audited reversal/credit flows.

## 3. Enforce eligibility, ownership and permissions

Move source eligibility into shared server queries and posting validators so the chooser and save operation enforce the same rules.

- Fabric sales consume available Rozain-owned stock at the selected location and condition. Client-owned fabric remains client owned; returning it does not create a fabric sale.
- Knitting client ownership is derived from the recorded yarn issue allocations. Dyeing customer relationships use the recorded batch/receipt allocations. Processor identity, material ownership and billed customer are separate fields.
- Where completed work has no proven billing-customer relationship, require an explicit audited assignment before it becomes eligible. Store the assignment at source-line level with customer, actor, reason and version; retain the physical owner and processor unchanged. Do not guess the customer from the processor's name.
- Filter eligible source records by customer, work type, business and remaining billable quantity. Lock/revalidate source allocations during posting to prevent concurrent double billing.
- Validate finite measured quantities, gross/tare values, decimal precision, dates, positive rates, supported taxes/charges, payment amount and applicable payment details. Reject overpayment in this flow; advances remain explicit receipts.
- Combine requested quantities against each inventory/source row before validating capacity. Stale or unavailable stock must produce an actionable message while preserving the draft.
- Require every underlying permission for the selected action. Delivery needs dispatch authority; billing/receipts need accounts authority; creating production records, if followed through a contextual link, keeps its existing production permissions. The unified screen must not expand staff access.
- Keep accounts with unknown historical bill allocations marked **Payment history not recorded**. Do not present their unpaid amount as known or enable settlement/reversal paths that bypass reconciliation safeguards.

## 4. Present existing and new transactions together

Add a server-backed sales register/read model assembled from existing deliveries, customer bills, allocations and receipts. Group linked records before sorting and pagination so a delivery and its invoice are not displayed or totalled as two sales. Support existing partial-billing relationships in the detail view.

Show customer, date, transaction type, references, delivery/billing status, bill total, allocated payments and remaining balance. Provide search, filters and accessible mobile views. Imported bills without operational source records appear as existing financial history, with their recorded provenance and unknown settlement state; do not reconstruct a fictitious delivery.

Replace duplicate customer-sale entry buttons with **New sale / charge** leading to the unified workspace. Keep Accounts & ledgers for full statements and financial review. Preserve direct access to payable workflows and existing deep links: `/dispatch` and `/bills` should open an appropriate register/filter or a compatibility view, rather than break saved links or hide supplier documents.

Add contextual **Bill this work** / **Bill this delivery** actions to the applicable records. These open the same form with validated selections prefilled. Use customer-specific labels such as **Delivery to bill** or **Completed knitting work**, retaining technical IDs internally.

Keep current uppercase presentation, theme tokens, keyboard access, mobile widths, closed initial dropdowns and local loading indicators.

## 5. Preserve imported data and deploy the complete flow

Implement against isolated data first. The existing live import, users, contacts, party balances and source audit records require no reseed or cleanup for this interface change.

The five physical source holds remain separate from active stock/production until their source gaps are resolved. A new screen must accurately show that limitation and cannot make those quantities available automatically.

Ship the existing `NOT_RECORDED` settlement handling together with the new workspace so deployed historical bill displays and API restrictions agree. Keep new metadata additive and optional for existing records, with sensible presentation for legacy records.

Roll out backend-compatible changes first, then the new interface. Preserve old endpoints/deep links during the transition and keep a UI fallback for rollback. Verify the actual deployed asset/API behavior and use read-only checks on existing live records. Run transaction-creation checks only in isolated/staging data.

## Implementation sequence and affected areas

1. **Posting foundation:** extract shared session-aware delivery, bill and settlement actions; add the unified command, schema, permissions and idempotency checks. Existing endpoints retain their behavior.
2. **Source and register queries:** implement customer/work eligibility, explicit missing assignments, unbilled quantities and the grouped sales register.
3. **Unified form:** build customer/type selection, fabric/work sections, pricing, optional payment, review, draft recovery and the result view. Reuse existing field components and posting calculations instead of nesting the old full dialogs.
4. **Navigation and history:** connect contextual entry points, old routes, the register, printing, later receipts and audited correction actions.
5. **Regression and rollout:** run API/browser/print checks, validate imported-history presentation, then verify the deployed workflow and preserved live financial records.

Primary existing files:

- [Routing](/Users/adanghuman/Documents/system/client/src/app/App.tsx) and [navigation](/Users/adanghuman/Documents/system/client/src/app/AppLayout.tsx).
- [Delivery form](/Users/adanghuman/Documents/system/client/src/features/dispatch/components/CreateDispatchModal.tsx), [billing form](/Users/adanghuman/Documents/system/client/src/business/OperationForm.tsx), [payment form](/Users/adanghuman/Documents/system/client/src/business/PaymentForm.tsx), and [bill register](/Users/adanghuman/Documents/system/client/src/business/WorkspacePage.tsx).
- [Delivery posting](/Users/adanghuman/Documents/system/server/src/business/delivery.ts), [bill/settlement posting](/Users/adanghuman/Documents/system/server/src/business/commerce.ts), [posting commands](/Users/adanghuman/Documents/system/server/src/business/posting.ts), and [source queries/routes](/Users/adanghuman/Documents/system/server/src/business/commerce.routes.ts).

Expected new modules include a Sales page/form on the client and sales command/query/schema modules on the server. Exact filenames can follow existing repository conventions during implementation.

## Verification and acceptance criteria

Extend the existing business/browser suites and add focused unified-sales scenarios. Use isolated MongoDB replica-set fixtures and actual browser requests.

1. **Part-paid fabric sale:** a hypothetical non-tax sale of 10 rolls/200 kg at 100 per kg with 5,000 received reduces stock by exactly 10 rolls/200 kg, debits the customer by 20,000, credits 5,000, and leaves 15,000 outstanding. The delivery, invoice, voucher and allocation all link correctly.
2. **All-or-nothing posting:** a forced payment/validation failure leaves no delivery, stock change, invoice, receipt, bill allocation or ledger change from that submission.
3. **Retry and concurrency:** double click, response loss, replay and two competing requests create one set of records; changed-payload replay is rejected; concurrent stock/source limits hold.
4. **Later billing:** delivery-only changes stock without customer debt. Billing it later changes debt without another stock deduction. Full and partial quantities cannot be billed twice.
5. **Customer service charges:** completed client work creates the right receivable and optional receipt, without stock movement. The wrong customer's work, outgoing-only batches and unassigned work are rejected with useful messages.
6. **Existing receipts:** allocation settles the bill without changing cash or the customer's ledger again. Wrong-party, already allocated, oversized or ineligible vouchers are rejected.
7. **History and permissions:** imported unknown settlements retain their state; held stock remains unavailable; original record IDs/history are preserved; partial staff permissions cannot trigger unauthorized actions.
8. **Drafts and corrections:** follow a source/stock action and resume safely; save/reopen a draft; record later part/full payments; test payment reversal followed by the permitted bill/delivery correction order.
9. **Browser and exports:** complete a new sale and service charge from the unified page without switching sections. Verify empty states, mobile/keyboard/dark layouts, matching server/display totals, actual gate-pass/invoice/receipt PDFs and register exports.

Run `npm run verify` from `/Users/adanghuman/Documents/system`, plus the focused unified-posting and unknown-settlement checks. Source import/reconciliation scripts must not be rerun as part of UI verification.

The implementation is complete when a user can create, bill, record an optional payment and print an ordinary customer transaction from one workspace, while stock and financial posting remain exactly once, atomic and traceable. Record actual deployment verification separately from local test results.


## Implemented behavior

The `/sales` workspace now combines customer delivery, billing, optional payment, saved drafts, recovery, printing and later receipts. Supplier billing retains its separate register. Customer sources are filtered by ownership and explicit billing assignments. A verified paper-service path records historical service charges without creating physical stock or pretending a receipt occurred.

The posting command uses one MongoDB session and transaction for stock, invoice, bill, voucher, allocations and ledger. Retries retain the same actor/business/payload key. Paper references are checked for duplicates. Multi-bill delivery rows expose bill-specific payment and correction actions. New fabric sales retain the selected inventory identity for withdrawal and reversal.

Historical unknown settlement data remains protected in the interface, API and exports. No cleanup, import or historical financial migration is part of this release. Existing endpoints and delivery screens remain available for compatibility and client fabric returns.

Verification runs use disposable databases. `npm run verify` includes the existing business/browser/print/export regression suite, unknown-settlement safeguards and the new unified-sales API/browser suite. New tests include rollback after payment writes, concurrent replay, partial billing, existing receipts, paper services, role checks, ordered corrections, three-decimal kg/currency rounding, mobile layout and lost-response recovery across reloads. Reusable committed fixtures are synthetic.

Deployment target: GitHub main, automatically deployed by Vercel. Production checks must inspect the deployed assets/API and compare read-only fingerprints of retained data; deployment success is reported only after those checks complete.

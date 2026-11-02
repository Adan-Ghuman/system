# Consistent transaction flow

Status: implementation completed locally on 2 November 2026; verification and rollout notes follow below. This extends the deployed customer sales workflow to supplier billing, processing receipts and yarn purchases.

## Outcome

Use one Transactions workspace and one form pattern for customer sales, supplier purchases, knitting/dyeing charges and related payments. An operator describes what happened, enters the details once, reviews the stock and money effects, and saves. The application creates and links the necessary records.

Keep the relationship between a bill and its goods/work. Remove the requirement to understand a generic “Source” field or visit another section to create a receipt before recording an ordinary receipt and bill together.

Operations still happen at real dates. Sending yarn, receiving fabric and collecting payment may occur separately. One workspace should make these linked events easy to follow without pretending they happened at the same time.

## Current gaps to address

- Customer sales have a combined delivery/bill/payment flow, but supplier knitting, dyeing and yarn bills still use the older source-first OperationForm.
- Purchase yarn already combines stock receipt and supplier debt. A separate Yarn bill action is for yarn received earlier, but its label does not explain that distinction.
- Supplier processing charges require completed receipts recorded through separate production forms. The billing form cannot receive the work inline.
- Receipt histories and production previews have different document kinds and inconsistent billing shortcuts. A shortcut in the production preview does not cover every receipt history entry.
- Existing mill gate passes without a prior issue are stored as external fabric receipts, not normal dyeing receipts. Treating these automatically as completed production or a processing bill would be incorrect.
- Generic source messages, including a yarn-bill error that refers to a fabric receipt, make valid accounting rules difficult to understand.

## Workspace and navigation

Introduce `/transactions` as the main entry point, with **New transaction** as the consistent global action. Use views for All activity, Customer bills, Supplier bills, Goods/work movements, Receipts & payments, Awaiting bill, and Drafts. These are filtered views of linked records rather than independent entry systems.

Keep Knitting, Dyeing, Yarn stock and Fabric stock for balances, production work and operational histories. Their action buttons open the same transaction editor with the action, party and known work prefilled. Keep Accounts & ledgers for statements and financial review.

Preserve `/sales`, `/bills`, `/buying` and `/dispatch` links by routing them to the appropriate view or retaining a compatible view during rollout. Keep old APIs available. Replace duplicate creation widgets only after the replacement supports their complete behavior, including client returns and saved drafts.

Opening New transaction presents plain actions grouped by purpose:

| Purpose | Actions |
|---|---|
| Sell or charge a customer | Sell fabric; Charge for knitting; Charge for dyeing |
| Buy or record a supplier cost | Buy yarn; Buy fabric; Record knitter bill; Record dyeing mill bill |
| Handle material or production | Receive customer-owned yarn; Send yarn for knitting; Receive knitted fabric; Send fabric for dyeing; Receive dyed fabric; Return client material |
| Record money | Receive money; Pay money |

Contextual buttons skip this chooser. Receiving a known dyeing batch should open its receipt details directly. A party that is both a supplier and a customer is used in either role; selecting a name alone never determines the direction of money.

## One editor pattern

All actions use the same visible sections, omitting fields that do not apply:

1. **What happened and with whom?** Action, customer/supplier/processor, actual transaction date and paper reference.
2. **Goods or work.** Describe the real goods/work, ownership, location, quantities and any relevant production job.
3. **Bill.** Record a bill now, record the movement only and bill later, or bill work/goods already recorded. Enter rates and supported charges/tax when billing.
4. **Money.** No payment now, part/full payment, or link an existing voucher. Labels say “received from customer” or “paid to supplier.”
5. **Review and save.** Show the stock movement, new bill, payment and remaining bill balance separately, with one final save.

Use a single page with expandable optional details, not nested forms. Keep drafts through validation errors, contextual navigation, reloads and uncertain save responses. Changing the action or party clears incompatible work/payment selections without silently discarding unrelated notes.

The success view remains in the workspace with View details, Print relevant documents, Record later payment, permitted correction actions and Start another entry. A new entry starts with blank quantities and rates.

## Replace “Source” with an explicit situation

| Situation | What the operator does | What the system does |
|---|---|---|
| Goods/work are arriving now | Enter the receipt and choose Record bill now or Bill later | Create the receipt and optionally the linked bill together |
| Goods/work were recorded earlier | Choose “Bill goods/work already recorded” | Show the selected party's eligible remaining quantities |
| An existing historical bill has no operational record | Choose “Existing bill only” and verify the paper/history | Record a financial bill with evidence; create no stock, production or cash movement by assumption |

For an earlier receipt, label the chooser **Yarn receipts to bill**, **Knitting work to bill**, **Dyed fabric receipts to bill**, or **Deliveries to bill**. Show challan/reference, date, fabric/yarn, owner where relevant, actual quantity and remaining billable quantity. Prefill a record chosen from history; always display it in review. Do not silently match ambiguous work.

Permit a bill to cover multiple eligible challans for the same party and compatible bill type. Allocate each line to its receipt/line and check the remaining quantity. Customer charges and supplier costs have independent allocations against the work. A bill date must not precede its linked completed work. Show a work period separately from the actual issue date.

An empty chooser explains the reason: no receipt recorded, already fully billed, reversed, wrong owner/customer, wrong processor or unresolved relationship. Offer **Record receipt here**, **View existing bill**, or **Review ownership**, as appropriate. The first action expands the required receipt fields in the same editor. It must not fabricate missing yarn issues, opening stock or completed production.

## Ownership and party rules

| Scenario | Material ownership | Financial result |
|---|---|---|
| Buy yarn/fabric | Rozain owns the purchased material | Supplier bill when recorded; no assumed payment |
| Receive yarn from a client for knitting | Client retains ownership | Receipt only; no purchase bill |
| Knit client-owned yarn in house | Client retains ownership of resulting fabric | Optional customer service charge; no external knitter payable |
| Receive outsourced knitting/dyeing work | Preserve the proven material owner | Optional supplier processing bill |
| Charge a client for outsourced work | Preserve the material owner | Separate customer service bill linked to the same confirmed work |
| Produce own fabric in house | Rozain retains ownership | Production receipt; no external processing payable |
| Return a client's fabric/yarn | Client retains ownership | Material return; no fabric sale |
| Sell Rozain-owned fabric | Customer receives the delivered quantity | Customer bill now or later |

Keep material owner, processor, billed customer and supplier distinct. Show extra party fields only where the situation needs them. Derive an owner/customer from verified allocations where available; require explicit evidence when a relationship is unresolved. Never infer ownership from a mill name or a payment.

Where both a supplier cost and customer charge apply, show separate linked bills. After saving the supplier receipt/bill, **Charge customer for this work** opens a prefilled customer entry in the same workspace. Do not automatically create or net a customer bill when a supplier bill is posted. Each bill has its own amount, date, settlement and correction history.

For mill receipts without a recorded prior issue, distinguish **Finished fabric purchased** from **Existing processed material returning**. A processing-return path requires verified ownership and completed-work evidence. Keep it separate from native batch production and do not invent raw issues or wastage. Adapt external receipt eligibility explicitly rather than treating every FABRIC_RECEIPT as processing work.

## Historical bills and payments

Offer Existing bill only for customer services and supplier yarn/fabric/processing bills. Store bill identity, party, date, verified lines and an evidence note. Do not create inventory merely because a paper bill lists kg.

Check both native and imported financial records before posting. A recognized existing bill is opened or reconciled, not posted again. A matching paper number with conflicting details needs review rather than automatic merging. Check duplicate customer bills across customer bill types; check supplier identity/reference and provenance across supplier bill types. Distinct customer and supplier references must not conflict with each other.

For historical bills, payment history can be Not recorded. Unknown is distinct from zero paid, wholly unpaid and fully settled. Keep settlement/correction safeguards until reconciliation establishes actual allocations. Do not change the account ledger just to make a bill appear settled.

For current entries, record only an actual payment. An existing voucher is linked without another cash or ledger posting. Keep the currently supported full-voucher allocation limit initially; do not silently add split-voucher allocation. Advances remain explicit, and excess payments must not be hidden as bill overpayments.

Review should say, for example, “80 kg yarn added; supplier bill 8,000; paid 2,000; bill balance 6,000,” using hypothetical values. For a bill against an earlier receipt, say “Stock unchanged.” For a customer service charge, say “Service charge only.” Show a party's overall account balance separately from a particular bill's remaining balance.

## Linked history and correction

Use one activity detail view with a timeline: material sent/received, bill(s), payment(s), returns/credits and reversals. Display references and statuses such as Awaiting work, Received / bill later, Partly billed, Billed, Part paid, Paid, Payment history not recorded and Reversed. Keep physical, billing and settlement states as separate dimensions.

Group receipt/bill/payment records before pagination so one combined entry is not counted several times. Link later independent events to the same activity without silently merging separate bills. Keep customer and supplier financial totals separate; money-only advances remain visible standalone until allocated. Exports use the same filters/grouping and retain unknown settlement labels.

Drafts remain editable. Posted records use reasons, returns, credits, refunds and ordered reversals. Distinguish correcting a bill, refunding money and physically returning material. Reversing a service charge never moves stock. Reversing a bill recorded later leaves the original receipt intact; reversing the physical receipt requires dependent bills/work to be resolved first. Payment allocation-only reversal leaves the original voucher and ledger unchanged.

## Implementation work

1. **Shared vocabulary and editor contract.** Define the action/situation matrix, direction-specific labels, validation, draft versioning and permission requirements. Specify a common transaction payload/result that retains existing document IDs and model-specific details. Do not make unrelated financial and operational permissions interchangeable.
2. **Supplier posting foundation.** Extract session-aware yarn/fabric receipt, knitting receipt, dyeing receipt and bill/payment functions. Reuse deployed sale and commerce posting helpers. Add read-only quotes and combined commands under one postCommand and MongoDB transaction. Source creation, stock, consumption, allocations, bill, voucher and ledger must succeed or roll back together. Use the existing stable request ID, actor/business/payload checks and reload recovery.
3. **Eligibility and historical evidence.** Share eligibility queries between the chooser and save validators. Add optional line-level receipt references for multiple challans while retaining legacy document-level sourceId compatibility. Apply source locks/version checks and unique constraints to concurrent billing/duplicate references. Add explicit historical supplier evidence and the external-mill classification path with no stock assumption.
4. **Supplier forms first.** Implement Buy yarn/fabric and Receive knitting/dyeing & bill using the shared sections. Expose receive-only and bill-existing modes in the same editor. Replace the three generic supplier Source forms. Contextual operational buttons open this editor and retain measured gross/tare, packages, manual loss and partial raw-batch allocations.
5. **Unified workspace and links.** Add the Transactions views/detail timeline, contextual actions across every receipt history, and route aliases. Bring the existing customer Sales form into the shared structure without rewriting its working posting rules. Connect standalone receipts/payments and saved drafts. Preserve uppercase presentation, theme tokens, keyboard navigation, mobile containment, closed initial dropdowns and local loading feedback.
6. **Verification and deployment.** Test the complete matrix with disposable data, run existing regressions, verify printed documents and exports, then deploy through main/Vercel. Compare read-only fingerprints of retained live financial/operational/user/contact records before and after. No seed, cleanup or opening-balance reset is part of this work.

The main modules are client/src/business/{SalesForm,SalesPage,OperationForm,WorkspacePage,YarnPage,ReceiptHistory,ExternalMillReceipts}.tsx, the knitting/dyeing receipt components, and server/src/business/{sales,commerce,knitting,dyeing,external-mill,posting,finance,records,commerce.models}.ts. Keep operation-specific rules in their domain modules and share orchestration/UI patterns.

## Acceptance checks

- Purchase yarn/fabric plus bill and part/full payment from one entry: stock changes once, one supplier debt is posted, one actual payment is posted, and all references reconcile.
- Receive-only followed by billing several challans: only remaining quantities are allowed and no second stock receipt occurs.
- Receive knitting/dyeing work with supplier bill: ownership, yarn consumption, actual loss and partial batch allocations match the existing operations. Missing/unproven inputs do not generate fictional production.
- Client-owned yarn received/knitted/returned: no purchased stock or fabric-sale debt is created. In-house production cannot create an external knitter payable.
- A supplier cost and separate customer charge can reference the same job without crossing parties, amounts or settlement allocations.
- Historical customer/supplier bills create no stock or assumed cash and cannot duplicate imported/native bills. Unknown settlement remains unknown in screens, printing and exports.
- External mill purchase and processing-return classifications produce the appropriate financial/stock effects and do not count a purchased receipt as production.
- Existing voucher allocation/unlink creates no duplicate cash; actual payments, refunds, credits and ordered reversals reconcile both bill balances and chronological party balances.
- Forced failures after a receipt, bill or payment write roll back the whole combined command. Concurrent stock/bill requests cannot exceed available quantities. Replays and lost responses return the same result.
- Permissions cover every underlying action; changing intent cannot create stock or financial entries outside the operator's authority.
- Every shortcut and legacy URL reaches the same editor or matching history. Drafts resume without losing ownership, quantities, rates or references. No normal combined receipt/bill needs a separate page or generic Source selector.
- Actual browser flows, keyboard/mobile layouts, bill/challan/voucher PDFs and register CSV/XLSX files agree with server amounts and quantities. Read-only production checks confirm the deployed code and retained data.

Completion means an operator can record an ordinary purchase, processing receipt/bill, sale or payment using the same entry pattern and workspace, while the system handles traceable stock and accounting links exactly once.


## Implemented workflow

The Transactions workspace is available at `/transactions`. It combines customer, supplier, movement, money, awaiting-bill and draft views. Contextual purchase and supplier charge actions open its shared form. Existing customer routes and detailed receipt-only production forms remain compatible; receipt histories provide direct supplier/customer billing actions.

Supplier entries support arriving-now receipt/bill/payment, billing remaining quantities across multiple earlier challans, and verified historical bills without stock. Knitting and dyeing receipts use the existing consumption, ownership and batch rules inside the same transaction as their bill and optional payment. External processing returns require owner/evidence confirmation and record no invented raw issue or wastage. Purchases remain separate from client-owned material receipts.

Customer and supplier forms share payment controls. Customer charges can cover several eligible completed-work receipts. Standalone money entries have review and response-loss recovery. Linked details expose work, bills, payments, credits and stock movements. Cash entries are kept distinct from bill balances, including after unlinking an advance.

Corrections distinguish physical fabric returns from financial-only credits. Multi-location bill lines retain their actual receipt/delivery locations; older purchase/credit location defaults remain compatible. Historical bill-only credits and service credits create no goods movement. Partial billing eligibility is calculated per receipt line. New native knitting/dyeing challans have duplicate protection.

`npm run verify` includes the existing business API/browser suites, PDF/download inspection, unknown settlements, unified customer sales, and the new `consistent-transactions` API/browser checks. New fixtures are synthetic and run in disposable databases. Production validation is read-only and compares retained-record fingerprints. No import, cleanup or opening-balance reset is included.

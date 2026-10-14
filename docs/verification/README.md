# Implementation and verification - 15 October 2026

Rozain Textile and ZR Trading are separate sibling companies. All existing records belong to Rozain Textile and remain editable in their original collections, with the same IDs, stock and balances. ZR Trading is added as a separate company with its own godown, stock, party accounts and documents. There is no historical mode or ownership-review step. The verification uses a disposable MongoDB replica set and an isolated browser server; it does not enter records in the operating database.

## Operator workflow

1. Choose the business in the header. Stock, party balances, numbering, bills and reports belong to that business. A party-name link retains the business when opening or refreshing its ledger.
2. Add reusable fabric, yarn and shade names under **Color program & names**, or save a new name from a transaction. Archive and restore names from the master list. Historical document names remain intact.
3. Under **Yarn stock**, receive yarn or record a counted opening/adjustment with a reason. Choose business or client ownership and the actual package unit. Enter the measured total kg directly, including cone deliveries.
4. Under **Knitting**, send yarn to a knitter, then receive its fabric. Enter actual wastage, including zero. For a blend, enter the actual kg used from each component. The receipt, fabric stock and remaining yarn are posted together. Receipt history supports printing and controlled reversal.
5. Under **Dyeing**, send available raw stock to a mill and choose the target shade. On a partial return, enter both the raw quantity covered and the actual finished quantity. The rest remains in process. The source receipt records actual loss and is available for processing bills.
6. Under **Buy fabric**, use **Receive fabric** if the bill will come later, or **Buy fabric & record bill** if goods and bill arrive together. A later supplier bill links the receipt and does not receive the same stock again.
7. Under **Bills & charges**, bill deliveries or completed knitting/dyeing receipts. Source quantities prevent duplicate billing. Record partial payments, returns/credits and refunds from the source bill.
8. Under **Deliveries & invoices**, enter gross/tare weights for each roll. Net weights and prices are computed by the server. Use **Deliver only** to bill later, or **Deliver & bill together**. Save an unfinished delivery as a draft and resume it without changing stock or balances.
9. Under **Trade between businesses**, start from the seller. One posting creates both businesses' documents and balances. The buyer receives goods from transit into store. Payments, refunds, agreed shortages, returns and credit reversals update both businesses together.
10. Correct posted work from its source using **Reverse**, with a reason. Reverse dependent bills/payments or later stock movements first. Generated ledger entries cannot be edited independently. Standalone voucher corrections retain and reverse the original before posting its replacement.
11. Use **Production report** for actual output, actual wastage, dyeing stages, source documents and balances as of a date. Purchases are excluded from production. Knitting output and dyeing throughput are not added into one inflated total.

**Add another** starts a blank line. **Copy details** is a separate action. PO and external references are optional strings, preserving leading zeroes and slashes. Entry dates default to the local date. Printed pages use white paper in either screen theme.

## Verification command

Run from the project root:

```text
npm run verify
```

This builds both applications, checks request/download utilities, runs the actual API against an isolated replica set, exercises the built client in a real browser, and reopens generated PDFs, CSVs and workbooks.

The browser test uses installed Microsoft Edge on Windows and Playwright. It can use the Codex bundled runtime, an installed Playwright package, or `PLAYWRIGHT_MODULE_PATH`. `PLAYWRIGHT_BROWSER_CHANNEL` overrides the browser channel. PDF inspection uses the bundled pdfjs runtime. The cached MongoDB Windows binary is used on this workstation; other platforms use mongodb-memory-server's normal binary resolution.

`npm run test:business` runs the API scenarios without rebuilding or starting the browser. The verification servers use ports 5182 and 5333 and always close their disposable database on completion.

## Executed checks

| Flow | Checks |
| --- | --- |
| Business/access | Existing Rozain IDs/balances/stock preserved, editable original records and ledger, continued numbering, separate sibling godowns/accounts, equal local codes, company-scoped population, foreign-ID rejection, existing staff access, staff creation/revocation, protected exports and unauthenticated rejection |
| Catalogs/forms | Reusable shade creation, blank Add another, explicit source selection, initially closed dropdown, generic references and retained failed entries |
| Yarn/knitting | Actual measured kg, units, opening/correction, issue, manual loss, durable retry, explicit blend allocation, receipt history and reversal |
| Exact balance | 200 kg issued, 196 kg fabric plus 2.4 kg actual wastage, 1.6 kg remaining |
| Ownership | Client-owned yarn/fabric remain separate; client goods cannot be sold as business-owned stock; fabric transfer preserves ownership |
| Dyeing | Raw stock consumed at issue, partial allocation, actual finished output/loss, matched processing bill, dependent reversal protection, ordered receipt/issue reversal |
| Buying/accounts | Receive then bill, combined purchase, partial payment, supplier return/credit, refund, duplicate bill rejection, standalone voucher correction and reversal |
| Deliveries | Forged submitted net weight ignored, invalid tare and duplicate rolls rejected, draft/resume/post, delivery-only, later invoice, coordinated reversal, OGP/invoice PDF |
| Inter-company | Paired sale/purchase, transit and partial receipt, insufficient-stock rollback, retry, settlement, shortage, physical return, refund, paired credit reversal and reconciliation |
| Inventory | Transfer and return, location validation, signed correction, client custody, paper-reference search |
| Concurrency/history | Concurrent stock additions and document counters, managed-payment protection, ledger period balances, source drill-through |
| Reports/files | More than one list page of source receipts and ledger entries, full filtered CSV/XLSX, multi-page PDF, final-record presence, company names, quantity/amount assertions, text bounds and cached workbook formulas |
| Browser UX | Core entry chains, party ledger refresh/back, themed reversal dialog, all-page smoke, system dark mode, mobile widths and modal sizing |

Generated evidence is under `scratch/qa-completion/`: screenshots, actual downloads, extracted PDF text and inspection JSON. The suite inspects 12 PDF document samples and 13 CSV/XLSX samples. Production and ledger samples include records beyond one list page. These are repeatable scenario checks, not a guarantee against every possible data combination or printer configuration.

## Existing records and sibling company setup

Existing records are Rozain Textile records. They are read directly from their original collections, including records created before company IDs were introduced. Reads do not rewrite their IDs, balances, quantities or dates. Normal authorized edits and postings remain available. The former historical-review screen and read-only restriction have been removed.

ZR Trading has separate stock, accounts, bills, numbering and a company-owned godown. Godown codes are local to each company; the existing `ZR_GODOWN` location code is retained so existing Rozain stock references do not change. The company name identifies the godown in selectors. Inter-company trades remain explicit linked sales/purchases at the agreed price; a location transfer never shares stock or ledgers between companies.

The stock index is extended to distinguish ownership without changing stock records. New document numbering continues above existing numbers. Older staff records retain Rozain access; explicitly assigned or revoked memberships remain enforced. No ownership worksheet, data reassignment, balance copying or production cutover is needed for this setup.

The corrected setup passed `npm run verify`, including original-format records without company IDs and a browser check of existing-party isolation. The configured operating database could not be inspected from this session because its MongoDB DNS lookup failed. No operating database records were moved or changed during verification.

Operational demo seeding is disabled by default. `ENABLE_DEMO_SEED=true` explicitly enables it for a testing database. The testing login hint appears in development; testing builds can opt in with `VITE_SHOW_TEST_CREDENTIALS=true`.

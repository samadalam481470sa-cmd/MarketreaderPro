# Government trade and filing data: implemented scope and legal boundary

## SEC Form 4 (actual transaction extraction)
With a valid `SEC_USER_AGENT` and comma-separated `MRP_SEC_CIKS` run:
```bash
npm run db:migrate
npm run sec:transactions
```
This fetches Form 4 XML **only for the configured CIKs**, normalizes transaction codes, share quantities, prices, owners, dates and original filing URLs and deduplicates by accession/row. Records are stored in `sec_form4_transactions`, available at `GET /api/government/sec-transactions?limit=50&ticker=AAPL`. These may reflect insider equity compensation, option exercises, gifts or amended filings—not necessarily open-market buys or sales. Verify original SEC documents.

The SEC provides data APIs and bulk submission archives for wider discovery, subject to its fair-access rules. Current code does **not** index every SEC filer automatically.

## House public annual filing index
Official annual House download page: https://disclosures-clerk.house.gov/FinancialDisclosure .

For an operator who has verified the permitted use of disclosure records, download the annual archive from the official site, then run:
```bash
HOUSE_DISCLOSURE_USE_AUTHORIZED=true npm run house:import -- /path/to/2026FD.zip 2026
```
This imports **filing index metadata only**, not PDF transaction rows. The bulk index is parsed offline using standard Python ZIP/CSV modules and rejects unsafe compressed structures. File URLs are constructed according to official House archive conventions; verify actual document links before presenting a specific record as a verified filing. View at `GET /api/government/filings?source=house`.

**IMPORTANT:** House disclosure statements prohibit several categories of commercial use, with exceptions in the statutory language. An operator must obtain appropriate legal advice before using data in a monetized product. This importer is opt-in and never crawls or bypasses the House website.

## U.S. Senate
Official access portal: https://efdsearch.senate.gov/search/home/
Official Ethics guidance: https://www.ethics.senate.gov/public/index.cfm/financialdisclosure

The Senate prohibits certain commercial and other uses of disclosures, with a media dissemination exception. There is **no automated Senate report importer** here; no claim of comprehensive Senate coverage. The dashboard should direct users to the official Senate portal and disclose the gap.

## Other markets
Broader stocks, FX, commodities, futures and international exchanges need appropriately licensed vendor contracts. Do **not** copy a personal-use-only price database into a public fintech product. The repository's price collection continues to cover public prediction markets and selected macro news.

## Compliance
- No inference that a disclosure is evidence of an illegal trade.
- Preserve transaction vs. filing date, issuer and owner provenance.
- No automated trade execution from public filing data.
- These imports are **not** automatically enabled by installing the research dashboard.

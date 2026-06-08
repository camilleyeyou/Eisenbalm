/**
 * charity-ledger.mjs — Year-end charity donation export.
 *
 * Queries the Convex charityLedger.charityTotals endpoint and prints a
 * readable aligned table to stdout, then writes a CSV file.
 *
 * Donation totals are PRODUCT SUBTOTAL ONLY — shipping is excluded.
 *
 * Usage:
 *   NEXT_PUBLIC_CONVEX_URL=https://... node apps/web/scripts/charity-ledger.mjs
 *   NEXT_PUBLIC_CONVEX_URL=https://... node apps/web/scripts/charity-ledger.mjs --year 2026
 *
 * Requires: NEXT_PUBLIC_CONVEX_URL env var.
 * Output:   Aligned table to stdout + charity-ledger-<year|all>.csv in cwd.
 */
import { ConvexHttpClient } from 'convex/browser'
import fs from 'fs'
import path from 'path'

// ── Resolve Convex generated api ──────────────────────────────────────────────
// Path from apps/web/scripts/ to convex/_generated/api.js
const apiUrl = new URL('../../../convex/_generated/api.js', import.meta.url)
let api
try {
  const mod = await import(apiUrl.pathname)
  api = mod.api
} catch {
  // Fallback: use string-based query reference (works without generated types)
  api = null
}

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const yearIdx = args.indexOf('--year')
const year = yearIdx !== -1 ? parseInt(args[yearIdx + 1], 10) : null

if (yearIdx !== -1 && (isNaN(year) || year < 1970 || year > 2100)) {
  console.error('Error: --year must be a valid four-digit year (e.g. --year 2026)')
  process.exit(1)
}

// ── Convex client ─────────────────────────────────────────────────────────────
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
if (!convexUrl) {
  console.error(
    'Error: NEXT_PUBLIC_CONVEX_URL is not set.\n' +
    'Usage: NEXT_PUBLIC_CONVEX_URL=https://... node apps/web/scripts/charity-ledger.mjs [--year YYYY]'
  )
  process.exit(1)
}

const client = new ConvexHttpClient(convexUrl)

// ── Build query args ──────────────────────────────────────────────────────────
const queryArgs = {}
if (year !== null) {
  queryArgs.startMs = Date.UTC(year, 0, 1, 0, 0, 0, 0)
  queryArgs.endMs = Date.UTC(year + 1, 0, 1, 0, 0, 0, 0) - 1
}

// ── Run query ─────────────────────────────────────────────────────────────────
let rows
try {
  if (api) {
    rows = await client.query(api.charityLedger.charityTotals, queryArgs)
  } else {
    // String-based fallback when generated api.js is not available
    rows = await client.query('charityLedger:charityTotals', queryArgs)
  }
} catch (err) {
  console.error('Error querying Convex:', err.message ?? err)
  process.exit(1)
}

if (!rows || rows.length === 0) {
  console.log('No orders found' + (year ? ` for ${year}` : '') + '.')
  process.exit(0)
}

// ── Format helpers ────────────────────────────────────────────────────────────
const toDollars = (cents) => (cents / 100).toFixed(2)

// ── Print aligned table to stdout ─────────────────────────────────────────────
const COL_SLUG = 30
const COL_DONATION = 14
const COL_SHIPPING = 14
const COL_ORDERS = 8
const COL_CURRENCY = 10

const pad = (s, n) => String(s).padEnd(n)
const padLeft = (s, n) => String(s).padStart(n)

const header =
  pad('charitySlug', COL_SLUG) +
  padLeft('donation ($)', COL_DONATION) +
  padLeft('shipping ($)', COL_SHIPPING) +
  padLeft('orders', COL_ORDERS) +
  padLeft('currency', COL_CURRENCY)

const divider = '-'.repeat(COL_SLUG + COL_DONATION + COL_SHIPPING + COL_ORDERS + COL_CURRENCY)

console.log('\nCharity Donation Ledger' + (year ? ` — ${year}` : ' — All Time'))
console.log('Donation totals are PRODUCT SUBTOTAL ONLY (shipping excluded)\n')
console.log(header)
console.log(divider)

for (const row of rows) {
  console.log(
    pad(row.charitySlug, COL_SLUG) +
    padLeft(toDollars(row.donationTotal), COL_DONATION) +
    padLeft(toDollars(row.shippingTotal), COL_SHIPPING) +
    padLeft(row.orderCount, COL_ORDERS) +
    padLeft(row.currency, COL_CURRENCY)
  )
}
console.log(divider)

const totalDonation = rows.reduce((sum, r) => sum + r.donationTotal, 0)
const totalShipping = rows.reduce((sum, r) => sum + r.shippingTotal, 0)
const totalOrders = rows.reduce((sum, r) => sum + r.orderCount, 0)
console.log(
  pad('TOTAL', COL_SLUG) +
  padLeft(toDollars(totalDonation), COL_DONATION) +
  padLeft(toDollars(totalShipping), COL_SHIPPING) +
  padLeft(totalOrders, COL_ORDERS)
)
console.log()

// ── Write CSV ─────────────────────────────────────────────────────────────────
const label = year ? String(year) : 'all'
const csvFilename = `charity-ledger-${label}.csv`
const csvPath = path.resolve(process.cwd(), csvFilename)

const csvHeader = 'charitySlug,donationTotalCents,shippingTotalCents,orderCount,currency'
const csvRows = rows.map(
  (r) => `${r.charitySlug},${r.donationTotal},${r.shippingTotal},${r.orderCount},${r.currency}`
)
fs.writeFileSync(csvPath, [csvHeader, ...csvRows].join('\n') + '\n', 'utf8')

console.log(`CSV written: ${csvPath}`)

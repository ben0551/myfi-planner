import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { CGTSummary, DividendSummary } from '@/lib/tax'

export interface PortfolioResult {
  name: string
  currency: string
  cgt: CGTSummary
  div: DividendSummary
}

export interface TaxReportPDFProps {
  fyLabel: string
  fyYear: number
  currency: string
  agg: {
    grossGain: number
    discountApplied: number
    capitalLosses: number
    netAssessableGain: number
    cashDividends: number
    frankingCredits: number
    grossedUp: number
  }
  totalAssessable: number
  perPortfolio: PortfolioResult[]
  generatedAt: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 }).format(n)

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', color: '#1a202c' },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  appName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#4338ca' },
  reportTitle: { fontSize: 11, color: '#374151', marginTop: 2 },
  meta: { fontSize: 8, color: '#9ca3af', marginTop: 2 },
  fyBadge: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#374151', textAlign: 'right' },

  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', borderBottomStyle: 'solid', marginBottom: 14 },

  sectionTitle: {
    fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },

  // Tiles
  tileRow: { flexDirection: 'row', marginBottom: 16 },
  tile: {
    flex: 1, padding: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'solid',
    borderRadius: 4,
    marginRight: 8,
  },
  tileLast: { marginRight: 0 },
  tileLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  tileValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 4, color: '#1a202c' },
  tileNote: { fontSize: 6, color: '#9ca3af', marginTop: 2 },

  // Total card
  totalCard: {
    padding: 14, backgroundColor: '#eef2ff',
    borderWidth: 1, borderColor: '#c7d2fe', borderStyle: 'solid',
    borderRadius: 6, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#3730a3' },
  totalSub: { fontSize: 7.5, color: '#6366f1', marginTop: 2 },
  totalValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#3730a3' },

  // Colours
  positive: { color: '#059669' },
  negative: { color: '#dc2626' },
  indigo: { color: '#4f46e5' },

  // Table
  table: {
    borderWidth: 1, borderColor: '#e5e7eb', borderStyle: 'solid',
    borderRadius: 4, marginBottom: 16,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingTop: 5, paddingBottom: 5, paddingLeft: 8, paddingRight: 8,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb', borderBottomStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', borderBottomStyle: 'solid',
  },
  tableRowAlt: { backgroundColor: '#f9fafb' },
  th: { flex: 1, fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase' },
  thR: { flex: 1, fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', textAlign: 'right' },
  td: { flex: 1, fontSize: 8, color: '#374151' },
  tdR: { flex: 1, fontSize: 8, color: '#374151', textAlign: 'right' },
  tdB: { flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151' },
  tdBR: { flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', textAlign: 'right' },

  disclaimer: {
    padding: 10, backgroundColor: '#fffbeb',
    borderWidth: 1, borderColor: '#fcd34d', borderStyle: 'solid',
    borderRadius: 4,
  },
  disclaimerTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#92400e', marginBottom: 3 },
  disclaimerText: { fontSize: 7, color: '#78350f', lineHeight: 1.5 },

  pageNum: { position: 'absolute', bottom: 24, right: 40, fontSize: 7.5, color: '#9ca3af' },
  pageHeader: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#4338ca', marginBottom: 4 },
})

export function TaxReportPDF({ fyLabel, agg, totalAssessable, perPortfolio, generatedAt }: TaxReportPDFProps) {
  const allCGTEvents = perPortfolio
    .flatMap((p) => p.cgt.events)
    .sort((a, b) => new Date(a.sellDate).getTime() - new Date(b.sellDate).getTime())

  // Merge dividend totals by ticker
  const divMap = new Map<string, { cashTotal: number; frankingCreditTotal: number; grossedUpTotal: number }>()
  for (const p of perPortfolio) {
    for (const d of p.div.byTicker) {
      const ex = divMap.get(d.ticker)
      if (ex) {
        ex.cashTotal += d.cashTotal
        ex.frankingCreditTotal += d.frankingCreditTotal
        ex.grossedUpTotal += d.grossedUpTotal
      } else {
        divMap.set(d.ticker, { cashTotal: d.cashTotal, frankingCreditTotal: d.frankingCreditTotal, grossedUpTotal: d.grossedUpTotal })
      }
    }
  }
  const divByTicker = [...divMap.entries()]
    .map(([ticker, v]) => ({ ticker, ...v }))
    .sort((a, b) => b.cashTotal - a.cashTotal)

  return (
    <Document title={`Tax Summary ${fyLabel}`} author="MyFiPlanner">

      {/* ── Page 1: Summary ── */}
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.appName}>MyFiPlanner</Text>
            <Text style={s.reportTitle}>Tax Summary Report</Text>
            <Text style={s.meta}>Generated {generatedAt}</Text>
          </View>
          <View>
            <Text style={s.fyBadge}>{fyLabel}</Text>
            <Text style={s.meta}>All portfolios</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* CGT */}
        <Text style={s.sectionTitle}>Capital Gains Tax</Text>
        <View style={s.tileRow}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Gross Gains</Text>
            <Text style={[s.tileValue, agg.grossGain >= 0 ? s.positive : s.negative]}>{fmt(agg.grossGain)}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>50% CGT Discount</Text>
            <Text style={[s.tileValue, s.positive]}>{agg.discountApplied > 0 ? fmt(-agg.discountApplied) : '—'}</Text>
            <Text style={s.tileNote}>Assets held &gt;12 months</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Capital Losses</Text>
            <Text style={[s.tileValue, s.negative]}>{agg.capitalLosses > 0 ? fmt(-agg.capitalLosses) : '—'}</Text>
          </View>
          <View style={[s.tile, s.tileLast]}>
            <Text style={s.tileLabel}>Net Assessable</Text>
            <Text style={[s.tileValue, agg.netAssessableGain >= 0 ? s.positive : s.negative]}>{fmt(agg.netAssessableGain)}</Text>
          </View>
        </View>

        {/* Dividends */}
        <Text style={s.sectionTitle}>Dividend Income</Text>
        <View style={s.tileRow}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Cash Dividends</Text>
            <Text style={s.tileValue}>{fmt(agg.cashDividends)}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>Franking Credits</Text>
            <Text style={[s.tileValue, s.indigo]}>{agg.frankingCredits > 0 ? fmt(agg.frankingCredits) : '—'}</Text>
            <Text style={s.tileNote}>Offset against tax payable</Text>
          </View>
          <View style={[s.tile, s.tileLast]}>
            <Text style={s.tileLabel}>Grossed-Up Total</Text>
            <Text style={s.tileValue}>{fmt(agg.grossedUp)}</Text>
          </View>
        </View>

        {/* Total */}
        <View style={s.totalCard}>
          <View>
            <Text style={s.totalLabel}>Total Assessable Income — {fyLabel}</Text>
            <Text style={s.totalSub}>Net CGT gain + grossed-up dividend income</Text>
            {agg.frankingCredits > 0 && (
              <Text style={[s.totalSub, { marginTop: 3 }]}>
                Plus {fmt(agg.frankingCredits)} franking credits offset against income tax
              </Text>
            )}
          </View>
          <Text style={s.totalValue}>{fmt(totalAssessable)}</Text>
        </View>

        {/* Per-portfolio breakdown (multi-portfolio only) */}
        {perPortfolio.length > 1 && (
          <View>
            <Text style={s.sectionTitle}>By Portfolio</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.th, { flex: 2 }]}>Portfolio</Text>
                <Text style={s.thR}>Net CGT</Text>
                <Text style={s.thR}>Cash Dividends</Text>
                <Text style={s.thR}>Grossed-Up</Text>
              </View>
              {perPortfolio.map((p, i) => (
                <View key={p.name} style={i % 2 === 1 ? [s.tableRow, s.tableRowAlt] : s.tableRow} wrap={false}>
                  <Text style={[s.td, { flex: 2 }]}>{p.name}</Text>
                  <Text style={[s.tdR, p.cgt.netAssessableGain >= 0 ? s.positive : s.negative]}>
                    {fmt(p.cgt.netAssessableGain)}
                  </Text>
                  <Text style={s.tdR}>{fmt(p.div.totalCash)}</Text>
                  <Text style={s.tdR}>{fmt(p.div.totalGrossedUp)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerTitle}>Important Disclaimer</Text>
          <Text style={s.disclaimerText}>
            This report is generated from transaction data you have entered and is for informational purposes only.
            It does not constitute financial or tax advice. CGT calculations use an average cost method and may differ
            from your broker&apos;s records. Consult a registered tax agent or accountant before lodging your tax return.
            MyFiPlanner is not responsible for any errors or omissions in this report.
          </Text>
        </View>

        <Text style={s.pageNum} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>

      {/* ── Page 2: CGT Events ── */}
      {allCGTEvents.length > 0 && (
        <Page size="A4" style={[s.page, { fontSize: 8 }]}>
          <Text style={s.pageHeader}>MyFiPlanner — {fyLabel} CGT Disposal Events</Text>
          <View style={s.divider} />

          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.th, { flex: 1.2 }]}>Ticker</Text>
              <Text style={[s.th, { flex: 1.5 }]}>Sell Date</Text>
              <Text style={[s.thR, { flex: 0.8 }]}>Qty</Text>
              <Text style={s.thR}>Cost Base</Text>
              <Text style={s.thR}>Proceeds</Text>
              <Text style={s.thR}>Gross Gain</Text>
              <Text style={s.thR}>Discount</Text>
              <Text style={s.thR}>Assessable</Text>
            </View>
            {allCGTEvents.map((e, i) => (
              <View key={e.sellTxId} style={i % 2 === 1 ? [s.tableRow, s.tableRowAlt] : s.tableRow} wrap={false}>
                <Text style={[s.tdB, { flex: 1.2 }]}>{e.ticker}</Text>
                <Text style={[s.td, { flex: 1.5 }]}>{fmtDate(e.sellDate)}</Text>
                <Text style={[s.tdR, { flex: 0.8 }]}>{e.qty.toFixed(0)}</Text>
                <Text style={s.tdR}>{fmt(e.costBase)}</Text>
                <Text style={s.tdR}>{fmt(e.proceeds)}</Text>
                <Text style={[s.tdR, e.grossGain >= 0 ? s.positive : s.negative]}>{fmt(e.grossGain)}</Text>
                <Text style={[s.tdR, s.positive]}>{e.discountApplied > 0 ? fmt(-e.discountApplied) : '—'}</Text>
                <Text style={[s.tdR, e.assessableGain >= 0 ? s.positive : s.negative]}>{fmt(e.assessableGain)}</Text>
              </View>
            ))}
          </View>

          <Text style={s.pageNum} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`} fixed />
        </Page>
      )}

      {/* ── Page 3: Dividend by Ticker ── */}
      {divByTicker.length > 0 && (
        <Page size="A4" style={s.page}>
          <Text style={s.pageHeader}>MyFiPlanner — {fyLabel} Dividend Income by Stock</Text>
          <View style={s.divider} />

          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.th, { flex: 2 }]}>Stock</Text>
              <Text style={s.thR}>Cash Dividends</Text>
              <Text style={s.thR}>Franking Credits</Text>
              <Text style={s.thR}>Grossed-Up Total</Text>
            </View>
            {divByTicker.map((d, i) => (
              <View key={d.ticker} style={i % 2 === 1 ? [s.tableRow, s.tableRowAlt] : s.tableRow} wrap={false}>
                <Text style={[s.tdB, { flex: 2 }]}>{d.ticker}</Text>
                <Text style={s.tdR}>{fmt(d.cashTotal)}</Text>
                <Text style={[s.tdR, s.indigo]}>{d.frankingCreditTotal > 0 ? fmt(d.frankingCreditTotal) : '—'}</Text>
                <Text style={s.tdR}>{fmt(d.grossedUpTotal)}</Text>
              </View>
            ))}
            {/* Totals row */}
            <View style={[s.tableRow, { backgroundColor: '#f3f4f6' }]}>
              <Text style={[s.tdB, { flex: 2 }]}>TOTAL</Text>
              <Text style={s.tdBR}>{fmt(agg.cashDividends)}</Text>
              <Text style={[s.tdBR, s.indigo]}>{agg.frankingCredits > 0 ? fmt(agg.frankingCredits) : '—'}</Text>
              <Text style={s.tdBR}>{fmt(agg.grossedUp)}</Text>
            </View>
          </View>

          <Text style={s.pageNum} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`} fixed />
        </Page>
      )}
    </Document>
  )
}

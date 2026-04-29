export function TaxDisclaimer() {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span className="shrink-0 text-amber-500">⚠</span>
      <span>
        <strong>Indicative estimates only.</strong> Calculations use average cost basis
        (ATO s112-20 ITAA 1997) and are not a substitute for advice from a registered
        tax agent. Cross-year loss carry-forwards are not tracked automatically.
      </span>
    </div>
  )
}

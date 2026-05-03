/**
 * Minimal CSV serialization. Quotes every cell, escapes embedded quotes.
 * Suitable for export endpoints — not for parsing user input.
 */

type Cell = string | number | null | undefined

export function toCsv(headers: string[], rows: Cell[][]): string {
  const escape = (v: Cell): string => {
    if (v === null || v === undefined) return '""'
    return `"${String(v).replace(/"/g, '""')}"`
  }
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) lines.push(row.map(escape).join(','))
  return lines.join('\n')
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_')
}

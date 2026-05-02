import https from 'node:https'

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json, */*',
        'Accept-Encoding': 'identity',
      },
      rejectUnauthorized: false,
    } as Parameters<typeof https.get>[0], (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function main() {
  // Try Yahoo Finance summary endpoint for VAS.AX
  const url = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/VAS.AX?modules=summaryDetail,earningsHistory,dividendHistory'
  console.log('Fetching:', url)
  const raw = await httpsGet(url)
  console.log(raw.substring(0, 2000))

  // Also try the ASX API
  console.log('\n--- ASX dividends API ---')
  try {
    const asxRaw = await httpsGet('https://www.asx.com.au/asx/1/company/VAS/dividends?count=20')
    console.log(asxRaw.substring(0, 2000))
  } catch (e) {
    console.log('ASX failed:', e)
  }
}

main().catch(console.error)

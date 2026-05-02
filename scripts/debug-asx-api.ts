import https from 'node:https'

function httpsGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: '*/*',
        'Accept-Encoding': 'identity',
      },
      rejectUnauthorized: false,
    } as Parameters<typeof https.get>[0], (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function main() {
  const urls = [
    'https://www.asx.com.au/asx/1/company/VAS/dividends?count=10',
    'https://www.asx.com.au/json/dividends/VAS.json',
    'https://www.listcorp.com/asx/vas/dividends',
    'https://au.finance.yahoo.com/quote/VAS.AX/history/?p=VAS.AX',
  ]
  for (const url of urls) {
    try {
      const r = await httpsGet(url)
      console.log(`\n${url}\nStatus: ${r.status}, Length: ${r.body.length}`)
      console.log(r.body.substring(0, 300))
    } catch (e) {
      console.log(`\n${url}\nERROR: ${e}`)
    }
  }
}

main().catch(console.error)

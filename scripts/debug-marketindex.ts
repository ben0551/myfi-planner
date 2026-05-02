import https from 'node:https'

async function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'identity',
        'Accept-Language': 'en-AU,en;q=0.9',
      },
      rejectUnauthorized: false,
    } as Parameters<typeof https.get>[0], (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        httpsGet(res.headers.location).then(resolve).catch(reject)
        res.resume(); return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

async function main() {
  const html = await httpsGet('https://www.marketindex.com.au/asx/vas')
  console.log('Response length:', html.length)
  const dates = html.match(/\d{2}\/\d{2}\/\d{4}/g)
  console.log('DD/MM/YYYY dates:', dates?.slice(0, 10) ?? 'none')
  const fi = html.toLowerCase().indexOf('franking')
  console.log('First "franking" at:', fi)
  if (fi > 0) console.log(html.substring(fi - 200, fi + 400))
  // Show first 500 chars to check if it's a real page
  console.log('\n--- HTML start ---\n', html.substring(0, 500))
}

main().catch(console.error)

/**
 * AES-256-GCM at-rest encryption for sensitive fields (API keys, SMTP passwords).
 *
 * Plaintext values written before this module existed are still readable —
 * `decrypt` returns them as-is. Use `encrypt` on every write so they get
 * upgraded to ciphertext over time (lazy migration).
 *
 * Key source: MASTER_KEY env var, hex-encoded 32 bytes (64 hex chars).
 * Generate with: `openssl rand -hex 32`.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

const VERSION = 'enc:v1:'

function getKey(): Buffer {
  const raw = process.env.MASTER_KEY
  if (!raw) {
    // No key configured — derive an ephemeral one from a stable but weak source
    // so dev/test still works. Production MUST set MASTER_KEY.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MASTER_KEY env var is required in production')
    }
    return createHash('sha256').update('dev-fallback-key').digest()
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  // Anything else → derive a 32-byte key by hashing
  return createHash('sha256').update(raw).digest()
}

/** Encrypt a string. Returns the versioned ciphertext, or null/'' for empty. */
export function encrypt(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === '') return plain ?? null
  if (plain.startsWith(VERSION)) return plain // already encrypted
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return VERSION + iv.toString('hex') + ':' + tag.toString('hex') + ':' + ct.toString('hex')
}

/** Decrypt a versioned ciphertext. Returns plaintext input unchanged if not versioned. */
export function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null
  if (!value.startsWith(VERSION)) return value // legacy plaintext — return as-is
  try {
    const rest = value.slice(VERSION.length)
    const [ivHex, tagHex, ctHex] = rest.split(':')
    if (!ivHex || !tagHex || !ctHex) return null
    const key = getKey()
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const ct = Buffer.from(ctHex, 'hex')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    return pt.toString('utf8')
  } catch (err) {
    console.error('[crypto] decrypt failed:', err)
    return null
  }
}

/** True if the value is in the versioned ciphertext format. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(VERSION)
}

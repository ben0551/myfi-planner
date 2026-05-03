import { describe, it, expect, beforeAll } from 'vitest'
import { encrypt, decrypt, isEncrypted } from './crypto'

beforeAll(() => {
  // Use a deterministic test key. Real production sets via env var.
  process.env.MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
})

describe('crypto round-trip', () => {
  it('encrypts and decrypts back to the same plaintext', () => {
    const ct = encrypt('sk-ant-secret-key')
    expect(ct).not.toBe('sk-ant-secret-key')
    expect(isEncrypted(ct)).toBe(true)
    expect(decrypt(ct)).toBe('sk-ant-secret-key')
  })

  it('different IVs produce different ciphertexts for the same plaintext', () => {
    const a = encrypt('hello')
    const b = encrypt('hello')
    expect(a).not.toBe(b) // random IV means different output each call
    expect(decrypt(a)).toBe('hello')
    expect(decrypt(b)).toBe('hello')
  })

  it('passes through null/undefined/empty', () => {
    expect(encrypt(null)).toBe(null)
    expect(encrypt(undefined)).toBe(null)
    expect(encrypt('')).toBe('')
    expect(decrypt(null)).toBe(null)
    expect(decrypt(undefined)).toBe(null)
    expect(decrypt('')).toBe('')
  })

  it('legacy plaintext (no version prefix) is returned as-is by decrypt', () => {
    expect(decrypt('sk-legacy-plaintext-key')).toBe('sk-legacy-plaintext-key')
    expect(isEncrypted('sk-legacy-plaintext-key')).toBe(false)
  })

  it('does not double-encrypt already-encrypted values', () => {
    const once = encrypt('foo')
    const twice = encrypt(once)
    expect(twice).toBe(once) // same exact ciphertext, not re-encrypted
  })

  it('returns null for tampered ciphertext', () => {
    const ct = encrypt('payload')!
    const tampered = ct.slice(0, -2) + 'ff' // corrupt the last byte
    expect(decrypt(tampered)).toBe(null)
  })
})

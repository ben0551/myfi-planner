'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'

type Provider = 'anthropic' | 'openai' | 'gemini' | 'ollama'

interface Config {
  provider: Provider
  model: string
  apiKey: string
  baseUrl: string
}

const PROVIDERS: { value: Provider; label: string; models: string[]; needsKey: boolean; needsUrl: boolean; keyLabel: string; urlPlaceholder?: string; urlLabel?: string }[] = [
  {
    value: 'anthropic',
    label: 'Anthropic (Claude)',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'],
    needsKey: true,
    needsUrl: false,
    keyLabel: 'Anthropic API Key',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    needsKey: true,
    needsUrl: false,
    keyLabel: 'OpenAI API Key',
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    needsKey: true,
    needsUrl: false,
    keyLabel: 'Gemini API Key',
  },
  {
    value: 'ollama',
    label: 'Ollama (local)',
    models: ['llama3', 'llama3.1', 'mistral', 'mixtral', 'phi3', 'gemma2', 'qwen2'],
    needsKey: false,
    needsUrl: true,
    keyLabel: '',
    urlLabel: 'Ollama Base URL',
    urlPlaceholder: 'http://localhost:11434/v1',
  },
]

const OPENAI_COMPATIBLE: { value: string; label: string; url: string }[] = [
  { value: '', label: 'Custom', url: '' },
  { value: 'lmstudio', label: 'LM Studio', url: 'http://localhost:1234/v1' },
  { value: 'ollama-compat', label: 'Ollama (OpenAI mode)', url: 'http://localhost:11434/v1' },
  { value: 'vllm', label: 'vLLM', url: 'http://localhost:8000/v1' },
]

export function AIProviderSettings({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<Config>({ provider: 'anthropic', model: '', apiKey: '', baseUrl: '' })
  const [hasStoredKey, setHasStoredKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/ai-settings')
      .then((r) => r.json())
      .then((d) => {
        setConfig({ provider: d.provider ?? 'anthropic', model: d.model ?? '', apiKey: '', baseUrl: d.baseUrl ?? '' })
        setHasStoredKey(Boolean(d.hasApiKey))
      })
      .finally(() => setLoading(false))
  }, [])

  const providerDef = PROVIDERS.find((p) => p.value === config.provider)!

  async function save() {
    setSaving(true)
    setSaved(false)
    // If user left apiKey blank but a key is stored, omit it from the payload
    // so the server keeps the existing one.
    const payload = config.apiKey
      ? config
      : { provider: config.provider, model: config.model, baseUrl: config.baseUrl }
    const res = await fetch('/api/ai-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      const d = await res.json()
      setHasStoredKey(Boolean(d.hasApiKey))
      // Wipe the key field after a successful save
      setConfig((c) => ({ ...c, apiKey: '' }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading…</div>

  return (
    <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">AI Provider Settings</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>

      {/* Provider */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
        <select
          value={config.provider}
          onChange={(e) => setConfig((c) => ({ ...c, provider: e.target.value as Provider, model: '', baseUrl: '' }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
          <option value="openai" disabled>── OpenAI-Compatible ──</option>
        </select>
      </div>

      {/* OpenAI-compatible presets */}
      {config.provider === 'openai' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Compatible endpoint (optional)</label>
          <select
            onChange={(e) => {
              const preset = OPENAI_COMPATIBLE.find((p) => p.value === e.target.value)
              if (preset) setConfig((c) => ({ ...c, baseUrl: preset.url }))
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {OPENAI_COMPATIBLE.map((p) => (
              <option key={p.value} value={p.value}>{p.label}{p.url ? ` — ${p.url}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Model */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
        <div className="flex gap-2">
          <select
            value={providerDef.models.includes(config.model) ? config.model : ''}
            onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Default ({providerDef.models[0]})</option>
            {providerDef.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input
            type="text"
            placeholder="or type custom model"
            value={!providerDef.models.includes(config.model) ? config.model : ''}
            onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* API Key */}
      {providerDef.needsKey && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{providerDef.keyLabel}</label>
          <input
            type="password"
            placeholder={hasStoredKey ? 'Key stored — type to replace' : 'sk-...'}
            value={config.apiKey}
            onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
            autoComplete="off"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            {hasStoredKey
              ? 'Key is stored encrypted. Leave blank to keep, or type a new key to replace.'
              : 'Stored encrypted in your database. Never sent anywhere except the provider.'}
          </p>
        </div>
      )}

      {/* Base URL (Ollama or OpenAI-compatible) */}
      {(providerDef.needsUrl || config.provider === 'openai') && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {providerDef.urlLabel ?? 'Base URL (leave blank for default OpenAI)'}
          </label>
          <input
            type="text"
            placeholder={providerDef.urlPlaceholder ?? 'https://api.openai.com/v1'}
            value={config.baseUrl}
            onChange={(e) => setConfig((c) => ({ ...c, baseUrl: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" onClick={save} loading={saving}>Save</Button>
        {saved && <span className="text-xs text-green-600 font-medium">Saved!</span>}
      </div>
    </div>
  )
}

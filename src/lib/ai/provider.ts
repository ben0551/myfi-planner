/**
 * Unified AI provider abstraction.
 * Returns an async generator of text chunks for streaming.
 */

export type Provider = 'anthropic' | 'openai' | 'gemini' | 'ollama'

export interface AIConfig {
  provider: Provider
  model?: string | null
  apiKey?: string | null
  baseUrl?: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Default models per provider
const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  ollama: 'llama3',
}

export async function* streamChat(
  config: AIConfig,
  messages: ChatMessage[],
  system: string
): AsyncGenerator<string> {
  const model = config.model || DEFAULT_MODELS[config.provider]

  switch (config.provider) {
    case 'anthropic':
      yield* streamAnthropic(config.apiKey, model, messages, system)
      break
    case 'openai':
      yield* streamOpenAI(config.apiKey, model, messages, system, config.baseUrl)
      break
    case 'gemini':
      yield* streamGemini(config.apiKey, model, messages, system)
      break
    case 'ollama':
      // Ollama exposes an OpenAI-compatible API
      yield* streamOpenAI(
        config.apiKey || 'ollama',
        model,
        messages,
        system,
        config.baseUrl || 'http://localhost:11434/v1'
      )
      break
    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}

async function* streamAnthropic(
  apiKey: string | null | undefined,
  model: string,
  messages: ChatMessage[],
  system: string
): AsyncGenerator<string> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('Anthropic API key not configured')

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: key })

  // Cache the system prompt — it's a static financial-data snapshot for the
  // duration of a conversation, so subsequent turns within the 5-minute TTL
  // pay ~10% of normal input cost. Worth it for any multi-turn chat.
  const response = await client.messages.stream({
    model,
    max_tokens: 1024,
    system: [
      { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
    ],
    messages,
  })

  for await (const chunk of response) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      yield chunk.delta.text
    }
  }
}

async function* streamOpenAI(
  apiKey: string | null | undefined,
  model: string,
  messages: ChatMessage[],
  system: string,
  baseUrl?: string | null
): AsyncGenerator<string> {
  const key = apiKey || process.env.OPENAI_API_KEY || 'no-key'
  const { default: OpenAI } = await import('openai')

  const client = new OpenAI({
    apiKey: key,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  })

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: 'system', content: system },
      ...messages,
    ],
    max_tokens: 1024,
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) yield text
  }
}

async function* streamGemini(
  apiKey: string | null | undefined,
  model: string,
  messages: ChatMessage[],
  system: string
): AsyncGenerator<string> {
  const key = apiKey || process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini API key not configured')

  const { GoogleGenAI } = await import('@google/genai')
  const client = new GoogleGenAI({ apiKey: key })

  // Convert messages to Gemini format
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const lastMessage = messages[messages.length - 1]

  const chat = client.chats.create({
    model,
    config: { systemInstruction: system },
    history,
  })

  const response = await chat.sendMessageStream({ message: lastMessage.content })

  for await (const chunk of response) {
    const text = chunk.text
    if (text) yield text
  }
}

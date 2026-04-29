import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ChatInterface } from '@/components/chat/ChatInterface'

export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const aiSettings = await prisma.aISettings.findUnique({ where: { userId: session.user.id } })
  const provider = aiSettings?.provider ?? 'anthropic'
  const isConfigured =
    provider === 'ollama'
      ? true // Ollama needs no key
      : !!(aiSettings?.apiKey || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">AI Finance Assistant</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ask anything about your portfolio, holdings, FIRE progress, or general investing.
        </p>
      </div>
      <ChatInterface isConfigured={isConfigured} provider={provider} />
    </div>
  )
}

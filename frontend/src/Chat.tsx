import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Wrench, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: any[]
  mode?: string
}

interface Props {
  mode: 'rag' | 'agent'
}

export default function Chat({ mode }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好！我是你的 AI 知识库助手。请先上传文档，然后我可以帮你检索和回答问题。\n\n**当前模式**: ' + (mode === 'agent' ? 'Agent（支持工具调用）' : 'RAG（纯检索生成）'),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: messages.length > 1 ? 'smooth' : 'auto'
        })
      })
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    const tempAssistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, tempAssistantMsg])

    try {
      const endpoint = mode === 'agent' ? '/api/agent/stream' : '/api/chat/stream'
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history }),
      })

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let fullText = ''

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

          const data = trimmedLine.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.chunk) {
              fullText += parsed.chunk
              setMessages(prev => {
                const newMsgs = [...prev]
                const lastMsg = newMsgs[newMsgs.length - 1]
                if (lastMsg.role === 'assistant') {
                  lastMsg.content = fullText
                }
                return newMsgs
              })
            }
          } catch (e) {
            console.warn('Parse error', e)
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ 请求失败: ' + err.message,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto',
          padding: '24px 32px',
          display: 'flex', flexDirection: 'column', gap: 20,
          minHeight: 0,
        }}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: msg.role === 'user' ? '#38bdf8' : '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {msg.role === 'user' ? <User size={16} color="#0f172a" /> : <Bot size={16} color="#fff" />}
            </div>

            <div style={{ maxWidth: '70%' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? '#38bdf8' : '#1e293b',
                color: msg.role === 'user' ? '#0f172a' : '#e2e8f0',
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>

              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div style={{
                  marginTop: 8, padding: '8px 12px',
                  background: '#1e1b4b', borderRadius: 8,
                  fontSize: 12, color: '#a5b4fc',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Wrench size={12} />
                  调用了 {msg.toolCalls.length} 个工具: {msg.toolCalls.map((t: any) => t.toolName).join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13 }}>
            <Loader2 size={16} className="spin" />
            AI 思考中...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 32px',
        borderTop: '1px solid #334155',
        background: '#1e293b',
      }}>
        <div style={{
          display: 'flex', gap: 12,
          background: '#0f172a',
          borderRadius: 12,
          padding: '8px 16px',
          border: '1px solid #334155',
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={mode === 'agent' 
              ? '试试问：这份文档的预算总和是多少？' 
              : '输入问题，基于知识库回答...'}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: '#e2e8f0', fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              background: loading ? '#334155' : '#38bdf8',
              color: loading ? '#94a3b8' : '#0f172a',
              border: 'none', borderRadius: 8,
              padding: '8px 16px', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Send size={16} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 8, textAlign: 'center' }}>
          {mode === 'agent' 
            ? 'Agent 模式：AI 会自主决定调用知识库检索或计算器工具' 
            : 'RAG 模式：直接从知识库检索相关内容生成答案'}
        </p>
      </div>
    </div>
  )
}

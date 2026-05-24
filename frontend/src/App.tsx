import { useState } from 'react'
import DocumentUpload from './DocumentUpload'
import Chat from './Chat'
import { Brain, Database, MessageSquare, Trash2 } from 'lucide-react'

function App() {
  const [vectorCount, setVectorCount] = useState(0)
  const [mode, setMode] = useState<'rag' | 'agent'>('agent')

  const handleUploadSuccess = (count: number) => {
    setVectorCount(count)
  }

  const handleClear = async () => {
    await fetch('/api/clear', { method: 'POST' })
    setVectorCount(0)
    alert('知识库已清空')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        padding: '20px 32px',
        borderBottom: '1px solid #334155',
        background: '#1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Brain size={28} color="#38bdf8" />
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>AI Knowledge Assistant</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: '#94a3b8' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={16} />
            知识库片段: {vectorCount}
          </span>
          <button
            onClick={handleClear}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'transparent', border: '1px solid #ef4444',
              color: '#ef4444', padding: '4px 12px', borderRadius: 6,
              cursor: 'pointer', fontSize: 12,
            }}
          >
            <Trash2 size={14} /> 清空
          </button>
        </div>
      </header>

      {/* Mode Switch */}
      <div style={{
        padding: '12px 32px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex',
        gap: 8,
      }}>
        <button
          onClick={() => setMode('rag')}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            background: mode === 'rag' ? '#38bdf8' : '#334155',
            color: mode === 'rag' ? '#0f172a' : '#e2e8f0',
          }}
        >
          RAG 模式
        </button>
        <button
          onClick={() => setMode('agent')}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            background: mode === 'agent' ? '#38bdf8' : '#334155',
            color: mode === 'agent' ? '#0f172a' : '#e2e8f0',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MessageSquare size={14} />
            Agent 模式
          </span>
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{
          width: 320,
          borderRight: '1px solid #334155',
          padding: 24,
          overflowY: 'auto',
        }}>
          <DocumentUpload onSuccess={handleUploadSuccess} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Chat mode={mode} />
        </div>
      </div>
    </div>
  )
}

export default App

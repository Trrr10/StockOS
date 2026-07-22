import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bot, Send, Zap, User, Loader, TrendingUp, Package, AlertTriangle, BarChart3, RefreshCw, X } from 'lucide-react'
import axios from 'axios'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const QUICK = [
  { icon: Package,       label: 'Low stock',       q: 'Which products are below reorder threshold right now? Give me a full list.' },
  { icon: TrendingUp,    label: '30-day forecast',  q: 'Give me a demand forecast for the next 30 days based on recent stock movements.' },
  { icon: AlertTriangle, label: 'Anomaly check',    q: 'Are there any unusual stock drops or suspicious patterns in recent movements?' },
  { icon: BarChart3,     label: 'Reorder plan',     q: 'Generate a complete reorder plan for next month with quantities and suppliers.' },
  { icon: Zap,           label: 'Top movers',       q: 'Which products have the highest outflow rate in the last 30 days?' },
  { icon: TrendingUp,    label: 'Stock value',      q: 'What is the total current stock value and which categories are most valuable?' },
]

const WELCOME = `Hey! I'm your inventory AI, powered by **LLaMA 3 via Groq**. I have full context of your stock levels, movements, orders and supplier data.\n\nTry asking:\n• "Which products are running critically low?"\n• "Generate a reorder plan for next month"\n• "Any suspicious stock drops this week?"\n• "What's the total stock value by category?"`

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([{
    id: '0', role: 'assistant', ts: new Date(), text: WELCOME,
  }])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [forecasts, setForecasts]     = useState([])
  const [forecastLoading, setForecastLoading] = useState(false)
  const [backendStatus, setBackendStatus]     = useState('unknown') // 'ok' | 'error' | 'unknown'
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    checkBackend()
    loadForecasts()
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function getAuthHeader() {
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data?.session?.access_token) {
        console.warn('No active session found')
        return {}
      }
      return { Authorization: `Bearer ${data.session.access_token}` }
    } catch (err) {
      console.error('getAuthHeader failed:', err)
      return {}
    }
  }

  async function checkBackend() {
    try {
      await axios.get(`${BACKEND}/health`, { timeout: 4000 })
      setBackendStatus('ok')
    } catch {
      setBackendStatus('error')
      console.error(`Backend unreachable at ${BACKEND}`)
    }
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  async function loadForecasts() {
    setForecastLoading(true)
    try {
      const headers = await getAuthHeader()
      if (!headers.Authorization) {
        setForecasts([])
        return
      }
      const res = await axios.get(`${BACKEND}/api/ai/demand-forecast`, { headers, timeout: 15000 })
      setForecasts(res.data || [])
    } catch (err) {
      console.error('Forecast load failed:', err.response?.status, err.response?.data?.detail || err.message)
      setForecasts([])
    } finally {
      setForecastLoading(false)
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────

  async function send(text) {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')

    setMessages(prev => [...prev, {
      id: Date.now().toString(), role: 'user', ts: new Date(), text: q,
    }])
    setLoading(true)

    try {
      const headers = await getAuthHeader()

      if (!headers.Authorization) {
        throw { isAuthError: true }
      }

      const res = await axios.post(
        `${BACKEND}/api/ai/query`,
        { query: q, context: 'inventory' },
        { headers, timeout: 30000 }
      )

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        ts: new Date(),
        text: res.data.response,
        tokens: res.data.tokens_used,
      }])
    } catch (err) {
      let errorText

      if (err.isAuthError) {
        errorText = `⚠️ You're not logged in or your session expired. Please refresh the page and log in again.`
      } else if (!err.response) {
        errorText = `⚠️ Cannot reach the backend at **${BACKEND}**.\n\nMake sure:\n• The backend server is running\n• VITE_BACKEND_URL is set correctly in your .env`
      } else {
        const status = err.response.status
        const detail = err.response.data?.detail || err.message

        console.error(`AI query failed [${status}]:`, detail)

        if (status === 401) {
          errorText = `⚠️ Authentication failed (401). Your session may have expired — please refresh the page.`
        } else if (status === 422) {
          errorText = `⚠️ Request validation error (422): ${JSON.stringify(detail)}`
        } else if (status === 500) {
          errorText = `⚠️ Backend error (500): ${typeof detail === 'string' ? detail : JSON.stringify(detail)}\n\nCheck that GROQ_API_KEY is valid in your backend .env`
        } else {
          errorText = `⚠️ Error ${status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
        }
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        ts: new Date(),
        text: errorText,
      }])
    } finally {
      setLoading(false)
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderText(text) {
    return text.split('\n').map((line, i) => {
      const bold   = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      const bullet = line.startsWith('• ') || line.startsWith('- ')
        ? `<span style="display:flex;gap:6px"><span style="color:#7effd4;flex-shrink:0">•</span><span>${bold.replace(/^[•\-]\s*/, '')}</span></span>`
        : bold
      return (
        <p key={i}
          dangerouslySetInnerHTML={{ __html: bullet || '&nbsp;' }}
          className="leading-relaxed"
        />
      )
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-5" style={{ height: 'calc(100vh - 112px)' }}>

      {/* ── Chat panel ── */}
      <div className="flex-1 glass-card rounded-2xl flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <motion.div
            animate={{ boxShadow: ['0 0 10px rgba(126,255,212,0.3)', '0 0 22px rgba(126,255,212,0.55)', '0 0 10px rgba(126,255,212,0.3)'] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(126,255,212,0.12)', border: '1px solid rgba(126,255,212,0.25)' }}
          >
            <Bot size={16} style={{ color: '#7effd4' }} />
          </motion.div>

          <div>
            <div className="font-display font-semibold text-white text-sm">Inventory AI</div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: backendStatus === 'error' ? '#f87171' : '#4ade80' }}
              />
              {backendStatus === 'error'
                ? <span style={{ color: '#f87171' }}>Backend offline</span>
                : 'LLaMA 3 · Full inventory context'
              }
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {backendStatus === 'error' && (
              <button
                onClick={checkBackend}
                className="text-muted hover:text-white transition-colors text-xs flex items-center gap-1"
              >
                <RefreshCw size={11} /> Retry
              </button>
            )}
            <button
              onClick={() => setMessages(msgs => [msgs[0]])}
              className="text-muted hover:text-white transition-colors text-xs flex items-center gap-1"
            >
              <X size={12} /> Clear
            </button>
          </div>
        </div>

        {/* Backend offline banner */}
        {backendStatus === 'error' && (
          <div className="px-5 py-2.5 text-xs flex items-center gap-2 flex-shrink-0"
            style={{ background: 'rgba(248,113,113,0.07)', borderBottom: '1px solid rgba(248,113,113,0.15)', color: '#f87171' }}>
            <AlertTriangle size={12} />
            Backend unreachable at <code className="font-mono">{BACKEND}</code> — make sure the server is running
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={msg.role === 'user'
                  ? { background: '#7effd4', color: '#07080f' }
                  : { background: 'rgba(126,255,212,0.12)', border: '1px solid rgba(126,255,212,0.2)' }}
              >
                {msg.role === 'user'
                  ? <User size={14} />
                  : <Bot size={14} style={{ color: '#7effd4' }} />}
              </div>

              <div className={`flex flex-col gap-1 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className="px-4 py-3 rounded-2xl text-sm leading-relaxed space-y-0.5"
                  style={msg.role === 'user'
                    ? { background: '#7effd4', color: '#07080f', fontWeight: 500, borderBottomRightRadius: 4 }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderBottomLeftRadius: 4, color: '#e2e8f0' }}
                >
                  {renderText(msg.text)}
                </div>
                <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <span>{format(msg.ts, 'HH:mm')}</span>
                  {msg.tokens && <span>· {msg.tokens} tokens</span>}
                </div>
              </div>
            </motion.div>
          ))}

          {loading && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(126,255,212,0.12)', border: '1px solid rgba(126,255,212,0.2)' }}>
                <Bot size={14} style={{ color: '#7effd4' }} />
              </div>
              <div className="px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, delay: i * 0.12, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: 'rgba(126,255,212,0.6)' }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        <div
          className="px-4 py-2.5 border-t border-border flex gap-2 overflow-x-auto flex-shrink-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {QUICK.map(({ icon: Icon, label, q }) => (
            <button
              key={label}
              onClick={() => send(q)}
              disabled={loading || backendStatus === 'error'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all disabled:opacity-40 flex-shrink-0 hover:text-accent"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border flex-shrink-0">
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              className="input-dark flex-1 rounded-xl px-4 py-2.5 text-sm resize-none leading-relaxed"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              placeholder={backendStatus === 'error'
                ? 'Backend offline — cannot send messages'
                : 'Ask anything about inventory, stock levels, orders...'}
              value={input}
              disabled={backendStatus === 'error'}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              rows={1}
            />
            <motion.button
              whileHover={{ scale: 1.07, boxShadow: '0 0 20px rgba(126,255,212,0.3)' }}
              whileTap={{ scale: 0.93 }}
              onClick={() => send()}
              disabled={!input.trim() || loading || backendStatus === 'error'}
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 btn-primary disabled:opacity-40"
            >
              {loading
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}>
                    <Loader size={15} />
                  </motion.div>
                : <Send size={15} />}
            </motion.button>
          </div>
          <p className="text-xs mt-2 font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>

      {/* ── Demand forecast sidebar ── */}
      <div className="w-64 flex-col gap-4 flex-shrink-0 hidden lg:flex">
        <div className="glass-card rounded-2xl p-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: '#7effd4' }} />
              <h3 className="font-display font-bold text-white text-sm">30-Day Forecast</h3>
            </div>
            <button
              onClick={loadForecasts}
              disabled={forecastLoading}
              className="text-muted hover:text-accent transition-colors disabled:opacity-40"
            >
              <motion.div
                animate={forecastLoading ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 0.7, repeat: forecastLoading ? Infinity : 0, ease: 'linear' }}
              >
                <RefreshCw size={12} />
              </motion.div>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5">
            {forecastLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-20 skeleton rounded-xl" />
              ))
            ) : forecasts.length === 0 ? (
              <div className="text-center text-muted text-xs py-8">
                <TrendingUp size={24} className="mx-auto mb-2 opacity-30" />
                No forecast data yet. Log some stock movements first.
              </div>
            ) : (
              forecasts.slice(0, 8).map((f, i) => {
                const urgency      = f.days_until_stockout <= 5 ? 'red' : f.days_until_stockout <= 14 ? 'yellow' : 'green'
                const urgencyColor = urgency === 'red' ? '#f87171' : urgency === 'yellow' ? '#fbbf24' : '#4ade80'
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 rounded-xl border border-border"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="font-medium text-white text-xs truncate mb-2">{f.product_name}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { l: 'ON HAND',    v: `${f.current_stock}`,        c: 'text-white' },
                        { l: '30D NEED',   v: `${f.forecast_30d_need}`,    c: 'text-accent' },
                        { l: 'DAYS LEFT',  v: `${f.days_until_stockout}d`, color: urgencyColor },
                        { l: 'CONFIDENCE', v: f.confidence,                color: urgencyColor },
                      ].map(({ l, v, c, color }) => (
                        <div key={l}>
                          <div className="text-[9px] text-muted uppercase tracking-wider font-mono">{l}</div>
                          <div
                            className={`text-xs font-mono font-bold capitalize ${c || ''}`}
                            style={color ? { color } : {}}
                          >
                            {v}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
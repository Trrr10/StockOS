// Orders.jsx — Sarvam STT primary, Web Speech fallback, audit-page dark UI

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus, Search, X, ShoppingCart, TrendingDown, Filter, Eye,
  MapPin, Mic, MicOff, Loader2, Volume2, CheckCircle2,
  AlertCircle, Sparkles, ChevronDown, ChevronUp, RefreshCw,
  ShieldAlert, ArrowUp, ArrowDown
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import TrackingMap from './TrackingMap'
import { supabase } from '../../lib/supabase'

const STATUS_COLORS = {
  open: 'badge-cyan', pending: 'badge-amber', dispatched: 'badge-violet',
  completed: 'badge-green', received: 'badge-green', cancelled: 'badge-red',
}
const ALL_STATUSES = ['open', 'pending', 'dispatched', 'completed', 'received', 'cancelled']
const INITIAL_FORM = {
  type: 'sales', product: '', quantity: '', unit: 'kg',
  status: 'open', date: new Date().toISOString().split('T')[0],
  customer: '', value: '', notes: ''
}
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const MIME_MAP = {
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/opus': 'ogg',
  'audio/mp4': 'mp4',   'audio/mpeg': 'mp3','audio/mp3': 'mp3',
  'audio/wav': 'wav',   'audio/flac': 'flac','audio/aac': 'aac',
}

async function checkSalesManagerRole() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return data?.role === 'sales_manager' || data?.role === 'admin'
}

async function fetchOrders() {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function upsertOrder(order) {
  const { data, error } = await supabase.from('orders').upsert(order, { onConflict: 'id' }).select().single()
  if (error) throw error
  return data
}

async function updateOrderStatus(id, status) {
  const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

async function updateOrderTrackingLogs(id, trackingLogs) {
  const { error } = await supabase.from('orders').update({ tracking_logs: trackingLogs, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) console.warn('Tracking log save failed:', error.message)
}

export function parseOrderIntent(transcript) {
  const t = transcript.toLowerCase().trim()
  const statusWords = 'open|pending|dispatched|completed|received|cancelled'
  const idPat = '([a-z]+-\\d+)'

  const patterns = [
    new RegExp(`(?:mark|update|set|change)\\s+${idPat}\\s+(?:as|to|status)?\\s+(${statusWords})`, 'i'),
    new RegExp(`${idPat}\\s+(?:is|as|to)?\\s*(${statusWords})`, 'i'),
  ]
  for (const pat of patterns) {
    const m = t.match(pat)
    if (m) return { intent: 'update_status', orderId: m[1].toUpperCase(), status: m[2] }
  }

  const verbMap = [
    [/(?:ship|dispatch)\s+([a-z]+-\d+)/i, 'dispatched'],
    [/(?:complete|finish|close|done)\s+([a-z]+-\d+)/i, 'completed'],
    [/cancel\s+([a-z]+-\d+)/i, 'cancelled'],
    [/(?:receive|received|mark received)\s+([a-z]+-\d+)/i, 'received'],
  ]
  for (const [pat, status] of verbMap) {
    const m = t.match(pat)
    if (m) return { intent: 'update_status', orderId: m[1].toUpperCase(), status }
  }

  const queryMatch = t.match(/(?:what(?:'s| is)(?: the)? status of|status of|find|show|open|view|check)\s+([a-z]+-\d+)/i)
  if (queryMatch) return { intent: 'query_order', orderId: queryMatch[1].toUpperCase() }

  const createMatch = t.match(
    /(?:new|create|add|place)\s+(sales?|purchase|buy)\s+order[,\s]+(\d+)\s*(\w+)\s+(.+?)\s+(?:for|from|to)\s+(.+?)(?:\s+(?:value|worth|amount|at|@)\s*(?:rupees?|rs\.?|₹)?\s*(\d+))?\.?\s*$/i
  )
  if (createMatch) return {
    intent: 'create_order',
    type: createMatch[1].toLowerCase().startsWith('sale') ? 'sales' : 'purchase',
    quantity: parseInt(createMatch[2]),
    unit: createMatch[3].toLowerCase(),
    product: createMatch[4].trim(),
    customer: createMatch[5].replace(/\s+(?:value|worth|amount).*$/, '').trim(),
    value: createMatch[6] ? parseInt(createMatch[6]) : 0,
  }

  const filterMatch = t.match(/(?:show|filter|list|display)\s+(?:all\s+)?(open|pending|dispatched|completed|received|cancelled)?\s*(sales?|purchase)?\s*orders?/i)
  if (filterMatch && (filterMatch[1] || filterMatch[2])) return {
    intent: 'filter',
    status: filterMatch[1]?.toLowerCase() || null,
    type: filterMatch[2]?.toLowerCase().replace('sale', 'sales') || null,
  }

  if (/(?:how many|total|summary|count).*order/.test(t)) return { intent: 'summary' }
  return { intent: 'unknown' }
}

// ─── Sarvam STT (primary) ────────────────────────────────────────────────────
const SARVAM_COOLDOWN = 4000
let lastSarvamTs = 0

async function sarvamSTT(blob, mimeType, language) {
  const now = Date.now()
  if (now - lastSarvamTs < SARVAM_COOLDOWN) throw new Error('cooldown')
  lastSarvamTs = now
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('no_auth_token')
  const cleanMime = mimeType.split(';')[0].trim().toLowerCase()
  const ext = MIME_MAP[cleanMime] || 'webm'
  const fd = new FormData()
  fd.append('file', new Blob([await blob.arrayBuffer()], { type: cleanMime }), `voice.${ext}`)
  fd.append('language_code', language)
  const res = await fetch(`${BACKEND_URL}/api/voice/stt`, {
    method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `STT error ${res.status}`)
  }
  return (await res.json()).transcript || ''
}

function webSpeechSTT(lang = 'en-IN') {
  return new Promise(resolve => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { resolve(''); return }
    const sr = new SR()
    sr.lang = lang; sr.interimResults = false; sr.maxAlternatives = 1
    let fired = false
    const done = v => { if (!fired) { fired = true; resolve(v) } }
    sr.onresult = e => done(e.results[0][0].transcript)
    sr.onerror = () => done('')
    sr.onend = () => done('')
    try { sr.start() } catch { done('') }
  })
}

function speak(text) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.slice(0, 150))
  u.lang = 'en-IN'; u.rate = 1.05
  const voices = window.speechSynthesis.getVoices()
  const v = voices.find(x => x.lang === 'en-IN') || voices.find(x => x.lang.startsWith('en'))
  if (v) u.voice = v
  window.speechSynthesis.speak(u)
}

function getBestMime() {
  const types = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4']
  return types.find(t => { try { return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t) } catch { return false } }) || 'audio/webm'
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function VoiceToast({ result, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t) }, [onDismiss])
  const isErr = result.type === 'error'
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      style={{ position:'fixed', bottom:24, right:24, zIndex:9999, display:'flex', alignItems:'flex-start', gap:12, padding:'12px 16px', borderRadius:16, maxWidth:360, background: isErr ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', border: isErr ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(16,185,129,0.25)' }}
    >
      {isErr ? <AlertCircle size={17} color="#f87171" style={{ marginTop:2, flexShrink:0 }} /> : <CheckCircle2 size={17} color="#34d399" style={{ marginTop:2, flexShrink:0 }} />}
      <div style={{ minWidth:0 }}>
        <p style={{ fontSize:13, fontWeight:600, color: isErr ? '#fca5a5' : '#6ee7b7', margin:0 }}>{result.title}</p>
        {result.detail && <p style={{ fontSize:12, color:'#9394a5', margin:'2px 0 0' }}>{result.detail}</p>}
        {result.heard && <p style={{ fontSize:11, color:'#6b6e89', margin:'4px 0 0', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>"{result.heard}"</p>}
      </div>
      <button onClick={onDismiss} style={{ background:'none', border:'none', color:'#6b6e89', cursor:'pointer', marginLeft:4, flexShrink:0 }}><X size={13} /></button>
    </motion.div>
  )
}

// ─── Voice Panel ──────────────────────────────────────────────────────────────
function VoicePanel({ onCommand, language, isOpen, onToggle }) {
  const [phase, setPhase] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState(null)
  const [waveLevel, setWaveLevel] = useState(0)
  const [sarvamUsed, setSarvamUsed] = useState(false)

  const mrRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const analyserRef = useRef(null)
  const frameRef = useRef(null)
  const mimeRef = useRef(getBestMime())
  const startTsRef = useRef(0)

  useEffect(() => () => stopStream(), [])

  const stopStream = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    analyserRef.current = null; streamRef.current = null; setWaveLevel(0)
  }

  const animWave = useCallback(() => {
    if (!analyserRef.current) return
    const d = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(d)
    setWaveLevel(Math.round(d.slice(0, 32).reduce((a, b) => a + b, 0) / 32))
    frameRef.current = requestAnimationFrame(animWave)
  }, [])

  const startRec = async () => {
    if (mrRef.current?.state === 'recording') return
    try {
      setPhase('recording'); setTranscript(''); setParsed(null); setSarvamUsed(false)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      startTsRef.current = Date.now()
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const ana = ctx.createAnalyser(); ana.fftSize = 128
      src.connect(ana); analyserRef.current = ana; animWave()
      const mr = new MediaRecorder(stream, { mimeType: mimeRef.current })
      mrRef.current = mr; chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => { stopStream(); runPipeline() }
      mr.start(100)
    } catch (err) {
      console.error('Mic error:', err); setPhase('error')
    }
  }

  const stopRec = () => {
    if (mrRef.current?.state === 'recording') { mrRef.current.stop(); setPhase('processing') }
  }

  const runPipeline = async () => {
    const duration = Date.now() - startTsRef.current
    if (duration < 400) { setPhase('idle'); return }
    try {
      let tx = ''
      const blob = new Blob(chunksRef.current, { type: mimeRef.current })

      // ── Step 1: Sarvam STT (primary) ──
      if (blob.size > 1000) {
        try {
          tx = await sarvamSTT(blob, mimeRef.current, language)
          if (tx) setSarvamUsed(true)
        } catch (e) {
          if (e.message !== 'cooldown' && e.message !== 'no_auth_token') {
            console.warn('Sarvam failed:', e.message)
          }
        }
      }

      // ── Step 2: Web Speech fallback ──
      if (!tx) {
        console.log('Falling back to Web Speech...')
        await new Promise(r => setTimeout(r, 300))
        tx = await webSpeechSTT(language)
      }

      if (!tx) { setPhase('error'); onCommand({ intent: 'error' }, ''); return }

      setTranscript(tx)
      const intent = parseOrderIntent(tx)
      setParsed(intent)
      setPhase('done')
      onCommand(intent, tx)
    } catch (err) {
      console.error('Voice pipeline error:', err)
      setPhase('error')
      onCommand({ intent: 'error' }, '')
    }
  }

  const reset = () => { setPhase('idle'); setTranscript(''); setParsed(null) }

  const intentLabels = {
    create_order: '📝 Create Order', update_status: '🔄 Update Status',
    query_order: '🔍 View Order',    filter: '🔎 Filter Applied',
    summary: '📊 Summary',           unknown: '❓ Not understood', error: '⚠️ Error',
  }

  const panelBg = { background: 'rgba(20,22,38,0.8)', border: '1px solid rgba(75,77,107,0.4)', borderRadius: 16, padding: 20 }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={onToggle}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:12, fontSize:13, fontWeight:500, cursor:'pointer', background: isOpen ? 'rgba(124,58,237,0.2)' : 'rgba(30,31,50,0.6)', border: isOpen ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(75,77,107,0.4)', color: isOpen ? '#c4b5fd' : '#9394a5', transition:'all 0.2s' }}
      >
        <Sparkles size={14} color={isOpen ? '#c4b5fd' : '#6b6e89'} />
        Voice Commands
        {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={panelBg}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <p style={{ fontSize:11, color:'#6b6e89', textTransform:'uppercase', letterSpacing:'0.06em', margin:0 }}>
                Sarvam STT → local parser → browser TTS
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {sarvamUsed && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', color:'#fbbf24', fontFamily:'monospace' }}>1 Sarvam call</span>}
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', color:'#34d399', fontFamily:'monospace' }}>0 LLM tokens</span>
              </div>
            </div>

            <div style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, flexShrink:0 }}>
                <motion.button
                  onMouseDown={startRec} onMouseUp={stopRec}
                  onTouchStart={e => { e.preventDefault(); startRec() }}
                  onTouchEnd={e => { e.preventDefault(); stopRec() }}
                  disabled={phase === 'processing'}
                  whileTap={{ scale: 0.95 }}
                  style={{ position:'relative', width:56, height:56, borderRadius:'50%', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor: phase === 'processing' ? 'not-allowed' : 'pointer', background: phase === 'recording' ? '#ef4444' : '#7c3aed', opacity: phase === 'processing' ? 0.6 : 1 }}
                >
                  {phase === 'processing' ? <Loader2 size={20} color="#fff" style={{ animation:'spin 1s linear infinite' }} /> : phase === 'recording' ? <MicOff size={20} color="#fff" /> : <Mic size={20} color="#fff" />}
                  {phase === 'recording' && <motion.span animate={{ scale: [1, 1.6, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ position:'absolute', inset:0, borderRadius:'50%', background:'rgba(239,68,68,0.2)' }} />}
                </motion.button>
                <p style={{ fontSize:11, textAlign:'center', margin:0, color: phase === 'idle' ? '#6b6e89' : phase === 'recording' ? '#fca5a5' : phase === 'done' ? '#6ee7b7' : '#9394a5' }}>
                  {phase === 'idle' && 'Hold'}{phase === 'recording' && 'Release'}{phase === 'processing' && 'Parsing…'}{phase === 'done' && 'Done ✓'}{phase === 'error' && 'Try again'}
                </p>
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                {phase === 'idle' && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {[['📝','New sales order 200 kg Cotton for Rajesh value 17000'],['🔄','Mark SO-2041 as dispatched'],['🔍','Status of PO-2034'],['🔎','Show open purchase orders']].map(([icon, cmd]) => (
                      <div key={cmd} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'10px', borderRadius:10, background:'rgba(30,31,50,0.6)', border:'1px solid rgba(75,77,107,0.3)' }}>
                        <span style={{ fontSize:13, flexShrink:0 }}>{icon}</span>
                        <p style={{ fontSize:11, color:'#6b6e89', margin:0, lineHeight:1.5 }}>"{cmd}"</p>
                      </div>
                    ))}
                  </div>
                )}

                {phase === 'recording' && (
                  <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:48, paddingTop:12 }}>
                    {Array.from({ length: 14 }).map((_, i) => (
                      <div key={i} style={{ width:5, borderRadius:2, background:'rgba(248,113,113,0.6)', height: Math.max(4, (waveLevel / 4) * Math.abs(Math.sin(i * 0.8)) + 5) }} />
                    ))}
                    <p style={{ fontSize:12, color:'#fca5a5', marginLeft:12, alignSelf:'center' }}>Listening…</p>
                  </div>
                )}

                {phase === 'processing' && (
                  <div style={{ display:'flex', alignItems:'center', gap:12, paddingTop:8 }}>
                    <Loader2 size={15} color="#a78bfa" style={{ animation:'spin 1s linear infinite', flexShrink:0 }} />
                    <div>
                      <p style={{ fontSize:13, color:'#c4c6d0', margin:0 }}>Transcribing via Sarvam…</p>
                      <p style={{ fontSize:12, color:'#6b6e89', margin:'2px 0 0' }}>Local parse — no LLM cost</p>
                    </div>
                  </div>
                )}

                {(phase === 'done' || phase === 'error') && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {transcript && (
                      <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(30,31,50,0.6)', border:'1px solid rgba(75,77,107,0.3)' }}>
                        <p style={{ fontSize:10, color:'#6b6e89', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 4px' }}>Heard</p>
                        <p style={{ fontSize:13, color:'#c4c6d0', fontStyle:'italic', margin:0 }}>"{transcript}"</p>
                      </div>
                    )}
                    {parsed && (
                      <div style={{ padding:'10px 12px', borderRadius:10, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontSize:13, fontWeight:500, background: parsed.intent === 'unknown' || phase === 'error' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${parsed.intent === 'unknown' || phase === 'error' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`, color: parsed.intent === 'unknown' || phase === 'error' ? '#fbbf24' : '#6ee7b7' }}>
                        <span>{intentLabels[parsed.intent] || '❓'}</span>
                        {parsed.orderId && <span style={{ fontFamily:'monospace', fontSize:11, opacity:0.7 }}>· {parsed.orderId}</span>}
                        {parsed.status && <span style={{ fontFamily:'monospace', fontSize:11, opacity:0.7 }}>→ {parsed.status}</span>}
                      </div>
                    )}
                    <button onClick={reset} style={{ fontSize:12, color:'#6b6e89', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>↺ Try again</button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function Unauthorised() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:256, gap:16, textAlign:'center', padding:32 }}>
      <div style={{ width:56, height:56, borderRadius:16, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <ShieldAlert size={26} color="#f87171" />
      </div>
      <div>
        <p style={{ fontWeight:600, color:'#e2e3ed', fontSize:18, margin:0 }}>Access Restricted</p>
        <p style={{ fontSize:13, color:'#6b6e89', marginTop:4 }}>This page requires a <span style={{ color:'#a78bfa', fontFamily:'monospace' }}>sales_manager</span> account.</p>
      </div>
    </div>
  )
}

const STATUS_BADGE_STYLE = {
  open:       { bg:'rgba(34,211,238,0.1)',  border:'rgba(34,211,238,0.25)',  color:'#22d3ee' },
  pending:    { bg:'rgba(251,191,36,0.1)',  border:'rgba(251,191,36,0.25)',  color:'#fbbf24' },
  dispatched: { bg:'rgba(167,139,250,0.1)', border:'rgba(167,139,250,0.25)', color:'#a78bfa' },
  completed:  { bg:'rgba(52,211,153,0.1)',  border:'rgba(52,211,153,0.25)',  color:'#34d399' },
  received:   { bg:'rgba(52,211,153,0.1)',  border:'rgba(52,211,153,0.25)',  color:'#34d399' },
  cancelled:  { bg:'rgba(248,113,113,0.1)', border:'rgba(248,113,113,0.25)', color:'#f87171' },
}

function StatusBadge({ status }) {
  const s = STATUS_BADGE_STYLE[status] || STATUS_BADGE_STYLE.open
  return (
    <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:s.bg, border:`1px solid ${s.border}`, color:s.color, fontFamily:'monospace', fontWeight:500 }}>
      {status}
    </span>
  )
}

export default function Orders({ language = 'en-IN' }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [authorised, setAuthorised] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [viewOrder, setViewOrder] = useState(null)
  const [expandedTracker, setExpandedTracker] = useState(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [highlightId, setHighlightId] = useState(null)

  useEffect(() => {
    checkSalesManagerRole().then(ok => { setAuthorised(ok); if (ok) loadOrders() })
  }, [])

  useEffect(() => {
    if (!authorised) return
    const ch = supabase.channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, ({ eventType, new: nw, old }) => {
        if (eventType === 'INSERT') setOrders(p => [{ ...nw, _new: true }, ...p])
        if (eventType === 'UPDATE') setOrders(p => p.map(o => o.id === nw.id ? nw : o))
        if (eventType === 'DELETE') setOrders(p => p.filter(o => o.id !== old.id))
      }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [authorised])

  const loadOrders = async () => {
    setLoading(true)
    try { setOrders(await fetchOrders()) } catch (e) { console.error(e.message) }
    finally { setLoading(false) }
  }

  const flash = id => { setHighlightId(id); setTimeout(() => setHighlightId(null), 3000) }

  const handleCommand = useCallback(async (parsed, rawTx) => {
    switch (parsed.intent) {
      case 'create_order': {
        setSaving(true)
        try {
          const prefix = parsed.type === 'sales' ? 'SO' : 'PO'
          const saved = await upsertOrder({ order_number: `${prefix}-${Date.now().toString().slice(-4)}`, type: parsed.type || 'sales', product: parsed.product || '', quantity: parsed.quantity || 0, unit: parsed.unit || 'pcs', status: 'open', date: new Date().toISOString().split('T')[0], customer: parsed.customer || '', value: parsed.value || 0, notes: 'Created via voice', tracking_logs: [] })
          flash(saved.id)
          speak(`Order created for ${parsed.product || 'product'}`)
          setToast({ type: 'success', title: `✅ ${saved.order_number} created`, detail: `${parsed.product} · ${parsed.customer}`, heard: rawTx })
        } catch (e) { setToast({ type: 'error', title: 'Create failed', detail: e.message, heard: rawTx }) }
        finally { setSaving(false) }
        break
      }
      case 'update_status': {
        const found = orders.find(o => (o.order_number || '').toUpperCase() === parsed.orderId || String(o.id) === parsed.orderId)
        if (!found) { setToast({ type: 'error', title: `${parsed.orderId} not found`, heard: rawTx }); return }
        try {
          await updateOrderStatus(found.id, parsed.status)
          speak(`${found.order_number || found.id} marked ${parsed.status}`)
          flash(found.id)
          setToast({ type: 'success', title: `🔄 ${found.order_number || found.id} → ${parsed.status}`, detail: found.customer, heard: rawTx })
        } catch (e) { setToast({ type: 'error', title: 'Update failed', detail: e.message, heard: rawTx }) }
        break
      }
      case 'query_order': {
        const found = orders.find(o => (o.order_number || '').toUpperCase() === parsed.orderId || String(o.id) === parsed.orderId)
        if (!found) { setToast({ type: 'error', title: `${parsed.orderId} not found`, heard: rawTx }); return }
        setViewOrder(found)
        speak(`${found.order_number || found.id}: ${found.product}, status ${found.status}`)
        setToast({ type: 'success', title: `🔍 Opened ${found.order_number || found.id}`, detail: `Status: ${found.status}`, heard: rawTx })
        break
      }
      case 'filter': {
        if (parsed.status) setStatusFilter(parsed.status)
        if (parsed.type) setTypeFilter(parsed.type)
        speak(`Showing ${parsed.status || 'all'} orders`)
        setToast({ type: 'success', title: '🔎 Filter applied', detail: `${parsed.type || 'all'} · ${parsed.status || 'all'}`, heard: rawTx })
        break
      }
      case 'summary': {
        const open = orders.filter(o => o.status === 'open').length
        const msg = `${open} open orders of ${orders.length} total`
        speak(msg)
        setToast({ type: 'success', title: `📊 ${msg}`, heard: rawTx })
        break
      }
      default:
        setToast({ type: 'error', title: "Didn't understand", detail: 'Try: "Mark SO-2041 dispatched"', heard: rawTx })
    }
  }, [orders])

  const handleCreate = async () => {
    setSaving(true)
    try {
      const prefix = form.type === 'sales' ? 'SO' : 'PO'
      await upsertOrder({ ...form, order_number: `${prefix}-${Date.now().toString().slice(-4)}`, value: Number(form.value), quantity: Number(form.quantity), tracking_logs: [] })
      setShowModal(false); setForm(INITIAL_FORM)
    } catch (e) { console.error(e.message) }
    finally { setSaving(false) }
  }

  const updateStatus = async (id, status) => {
    setOrders(p => p.map(o => o.id === id ? { ...o, status } : o))
    try { await updateOrderStatus(id, status) } catch { loadOrders() }
  }

  const handleLogsChange = useCallback(async (orderId, logs) => {
    setOrders(p => p.map(o => o.id === orderId ? { ...o, tracking_logs: logs } : o))
    await updateOrderTrackingLogs(orderId, logs)
  }, [])

  const filtered = orders.filter(o => {
    const s = search.toLowerCase()
    return (!s || (o.order_number || '').toLowerCase().includes(s) || (o.product || '').toLowerCase().includes(s) || (o.customer || '').toLowerCase().includes(s))
      && (typeFilter === 'all' || o.type === typeFilter)
      && (statusFilter === 'all' || o.status === statusFilter)
  })

  const stats = {
    openSales: orders.filter(o => o.type === 'sales' && o.status === 'open').length,
    openPurchase: orders.filter(o => o.type === 'purchase' && o.status === 'open').length,
    totalValue: orders.reduce((s, o) => s + (Number(o.value) || 0), 0),
  }

  const inputStyle = { padding:'8px 12px', borderRadius:10, background:'rgba(20,21,35,0.8)', border:'1px solid rgba(75,77,107,0.5)', color:'#e2e3ed', fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }
  const labelStyle = { fontSize:11, color:'#6b6e89', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:500, display:'block', marginBottom:4 }

  if (authorised === null) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:192 }}><Loader2 size={22} color="#a78bfa" style={{ animation:'spin 1s linear infinite' }} /></div>
  if (!authorised) return <Unauthorised />

  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:20 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }`}</style>

      {/* Header */}
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:600, color:'#e2e3ed' }}>Orders</h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'#6b6e89' }}>{loading ? 'Loading…' : `${orders.length} total orders`}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }} onClick={loadOrders} style={{ padding:'8px', borderRadius:10, background:'rgba(30,31,50,0.6)', border:'1px solid rgba(75,77,107,0.4)', color:'#9394a5', cursor:'pointer', display:'flex', alignItems:'center' }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </motion.button>
          <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }} onClick={() => { setForm(INITIAL_FORM); setShowModal(true) }} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, background:'#7c3aed', border:'none', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:500 }}>
            <Plus size={14} /> New Order
          </motion.button>
        </div>
      </motion.div>

      {/* Voice Panel */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <VoicePanel onCommand={handleCommand} language={language} isOpen={voiceOpen} onToggle={() => setVoiceOpen(v => !v)} />
      </div>

      {/* Stats */}
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }} style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
        {[
          { label: 'Open Sales', value: stats.openSales, icon: ShoppingCart, color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', bdr: 'rgba(34,211,238,0.2)' },
          { label: 'Open Purchase', value: stats.openPurchase, icon: TrendingDown, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', bdr: 'rgba(251,191,36,0.2)' },
          { label: 'Total Value', value: `₹${stats.totalValue.toLocaleString()}`, icon: Filter, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', bdr: 'rgba(167,139,250,0.2)' },
        ].map(({ label, value, icon: Icon, color, bg, bdr }) => (
          <div key={label} style={{ background:'rgba(20,22,38,0.8)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:14, padding:16, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:bg, border:`1px solid ${bdr}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon size={16} color={color} />
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:20, color:'#e2e3ed' }}>{value}</div>
              <div style={{ fontSize:12, color:'#6b6e89' }}>{label}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08 }} style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative' }}>
          <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#6b6e89' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders…" style={{ ...inputStyle, width:220, paddingLeft:32 }} />
        </div>
        <div style={{ display:'flex', gap:3, padding:4, borderRadius:10, background:'rgba(20,22,38,0.6)', border:'1px solid rgba(75,77,107,0.3)' }}>
          {['all','sales','purchase'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{ fontSize:12, padding:'6px 12px', borderRadius:8, fontWeight:500, cursor:'pointer', background: typeFilter === t ? 'rgba(124,58,237,0.2)' : 'transparent', color: typeFilter === t ? '#a78bfa' : '#9394a5', border: typeFilter === t ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent' }}>
              {t === 'all' ? 'All Types' : t === 'sales' ? 'Sales' : 'Purchase'}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width:140 }}>
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(statusFilter !== 'all' || typeFilter !== 'all') && (
          <button onClick={() => { setStatusFilter('all'); setTypeFilter('all') }} style={{ fontSize:12, color:'#6b6e89', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
            <X size={11} /> Clear
          </button>
        )}
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }} style={{ background:'rgba(20,22,38,0.8)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(75,77,107,0.4)' }}>
                {['Order ID','Type','Product','Party','Qty','Value','Status','Date','Actions'].map(h => (
                  <th key={h} style={{ padding:'12px 16px', fontSize:11, fontWeight:500, color:'#6b6e89', textTransform:'uppercase', letterSpacing:'0.05em', textAlign: ['Qty','Value','Actions'].includes(h) ? 'right' : 'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding:'48px 0', textAlign:'center' }}>
                    <Loader2 size={20} color="#a78bfa" style={{ display:'block', margin:'0 auto 8px', animation:'spin 1s linear infinite' }} />
                    <p style={{ fontSize:13, color:'#6b6e89', margin:0 }}>Loading from Supabase…</p>
                  </td>
                </tr>
              ) : filtered.map((order, idx) => (
                <React.Fragment key={order.id}>
                  <motion.tr
                    initial={order._new ? { backgroundColor:'rgba(126,255,212,0.06)' } : { opacity:0, y:4 }}
                    animate={{ opacity:1, y:0, backgroundColor: highlightId === order.id ? 'rgba(124,58,237,0.08)' : 'transparent' }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    style={{ borderBottom:'1px solid rgba(75,77,107,0.2)', cursor:'default' }}
                    whileHover={{ backgroundColor:'rgba(255,255,255,0.02)' }}
                  >
                    <td style={{ padding:'12px 16px', fontFamily:'monospace', fontSize:12, color:'#a78bfa', whiteSpace:'nowrap' }}>
                      {order.order_number || order.id}
                      {order._new && <span style={{ marginLeft:6, fontSize:9, color:'#34d399', verticalAlign:'middle' }}>● NEW</span>}
                      {highlightId === order.id && <span style={{ marginLeft:6, fontSize:9, color:'#a78bfa' }}>● voice</span>}
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontFamily:'monospace', fontWeight:500, ...(order.type === 'sales' ? { background:'rgba(34,211,238,0.1)', border:'1px solid rgba(34,211,238,0.2)', color:'#22d3ee' } : { background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.2)', color:'#fbbf24' }) }}>
                        {order.type === 'sales' ? 'Sale' : 'Purchase'}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px', fontSize:13, color:'#e2e3ed', fontWeight:500, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{order.product}</td>
                    <td style={{ padding:'12px 16px', fontSize:13, color:'#9394a5', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{order.customer}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:'monospace', fontSize:12, color:'#c4c6d0', whiteSpace:'nowrap' }}>{order.quantity} {order.unit}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', fontFamily:'monospace', fontSize:13, color:'#c4c6d0', whiteSpace:'nowrap' }}>₹{(Number(order.value) || 0).toLocaleString()}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <select
                        value={order.status}
                        onChange={e => updateStatus(order.id, e.target.value)}
                        style={{ fontSize:11, padding:'4px 8px', borderRadius:8, fontFamily:'monospace', cursor:'pointer', outline:'none', ...(STATUS_BADGE_STYLE[order.status] ? { background: STATUS_BADGE_STYLE[order.status].bg, border:`1px solid ${STATUS_BADGE_STYLE[order.status].border}`, color: STATUS_BADGE_STYLE[order.status].color } : {}) }}
                      >
                        {ALL_STATUSES.map(s => <option key={s} value={s} style={{ background:'#1a1b2e', color:'#e2e3ed' }}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'12px 16px', fontSize:12, color:'#6b6e89', fontFamily:'monospace', whiteSpace:'nowrap' }}>{order.date}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}>
                        <motion.button
                          whileHover={{ scale:1.1 }} whileTap={{ scale:0.9 }}
                          onClick={() => setExpandedTracker(expandedTracker === order.id ? null : order.id)}
                          style={{ padding:'5px 8px', borderRadius:8, display:'flex', alignItems:'center', gap:4, cursor:'pointer', fontSize:11, background: expandedTracker === order.id ? 'rgba(124,58,237,0.2)' : 'rgba(75,77,107,0.2)', border: expandedTracker === order.id ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent', color: expandedTracker === order.id ? '#a78bfa' : '#6b6e89' }}
                          title="Track location"
                        >
                          <MapPin size={12} />
                          {(order.tracking_logs || []).length > 0 && <span>{order.tracking_logs.length}</span>}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale:1.1 }} whileTap={{ scale:0.9 }}
                          onClick={() => setViewOrder(order)}
                          style={{ padding:'5px', borderRadius:8, cursor:'pointer', background:'rgba(75,77,107,0.2)', border:'1px solid transparent', color:'#6b6e89', display:'flex' }}
                        >
                          <Eye size={12} />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>

                  <AnimatePresence>
                    {expandedTracker === order.id && (
                      <motion.tr initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                        <td colSpan={9} style={{ padding:'0 16px 16px' }}>
                          <TrackingMap
                            entityId={order.order_number || order.id}
                            entityType="order"
                            entityLabel={`${order.product} → ${order.customer}`}
                            initialLogs={order.tracking_logs || []}
                            language={language}
                            onLogsChange={logs => handleLogsChange(order.id, logs)}
                          />
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 0', color:'#6b6e89' }}>
              <ShoppingCart size={32} style={{ display:'block', margin:'0 auto 12px', opacity:0.3 }} />
              <p style={{ fontSize:13, margin:0 }}>No orders found</p>
            </div>
          )}
        </div>

        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(75,77,107,0.3)', display:'flex', justifyContent:'space-between', fontSize:12, color:'#6b6e89', fontFamily:'monospace' }}>
          <span>{filtered.length} orders shown</span>
          <span>Total: ₹{filtered.reduce((s, o) => s + (Number(o.value) || 0), 0).toLocaleString()}</span>
        </div>
      </motion.div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} style={{ position:'absolute', inset:0, background:'rgba(10,11,20,0.8)', backdropFilter:'blur(4px)' }} onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity:0, scale:0.95, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.95 }} style={{ position:'relative', zIndex:10, width:'100%', maxWidth:480, background:'rgba(20,22,38,0.98)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:20, padding:24 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <h3 style={{ margin:0, fontSize:17, fontWeight:600, color:'#e2e3ed' }}>New Order</h3>
                <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', color:'#6b6e89', cursor:'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div><label style={labelStyle}>Order Type</label><select style={inputStyle} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="sales">Sales Order</option><option value="purchase">Purchase Order</option></select></div>
                  <div><label style={labelStyle}>Date</label><input type="date" style={inputStyle} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                </div>
                <div><label style={labelStyle}>Product</label><input style={inputStyle} value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="Product name" /></div>
                <div><label style={labelStyle}>{form.type === 'sales' ? 'Customer' : 'Supplier'}</label><input style={inputStyle} value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} placeholder="Name" /></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  <div><label style={labelStyle}>Qty</label><input type="number" style={inputStyle} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="100" /></div>
                  <div><label style={labelStyle}>Unit</label><select style={inputStyle} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>{['kg','m','pcs','spools','rolls','boxes'].map(u => <option key={u}>{u}</option>)}</select></div>
                  <div><label style={labelStyle}>Value (₹)</label><input type="number" style={inputStyle} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="5000" /></div>
                </div>
                <div><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, resize:'none', height:60 }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional…" /></div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button onClick={() => setShowModal(false)} style={{ flex:1, padding:'10px 0', borderRadius:10, background:'transparent', border:'1px solid rgba(75,77,107,0.5)', color:'#9394a5', cursor:'pointer', fontSize:13 }}>Cancel</button>
                <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={handleCreate} disabled={saving} style={{ flex:1, padding:'10px 0', borderRadius:10, background:'#7c3aed', border:'none', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:500, display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity: saving ? 0.7 : 1 }}>
                  {saving ? <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }} /> : <Plus size={13} />}
                  Create Order
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {viewOrder && (
          <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} style={{ position:'absolute', inset:0, background:'rgba(10,11,20,0.8)', backdropFilter:'blur(4px)' }} onClick={() => setViewOrder(null)} />
            <motion.div initial={{ opacity:0, scale:0.95, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.95 }} style={{ position:'relative', zIndex:10, width:'100%', maxWidth:460, background:'rgba(20,22,38,0.98)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:20, padding:24 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
                <h3 style={{ margin:0, fontSize:17, fontWeight:600, color:'#e2e3ed' }}>Order {viewOrder.order_number || viewOrder.id}</h3>
                <button onClick={() => setViewOrder(null)} style={{ background:'none', border:'none', color:'#6b6e89', cursor:'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {[['Order ID', viewOrder.order_number || viewOrder.id],['Type', viewOrder.type],['Product', viewOrder.product],[viewOrder.type === 'sales' ? 'Customer' : 'Supplier', viewOrder.customer],['Quantity', `${viewOrder.quantity} ${viewOrder.unit}`],['Value', `₹${(Number(viewOrder.value) || 0).toLocaleString()}`],['Status', viewOrder.status],['Date', viewOrder.date],['Notes', viewOrder.notes || '—']].map(([k, v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(75,77,107,0.2)' }}>
                    <span style={{ fontSize:11, color:'#6b6e89', textTransform:'uppercase', letterSpacing:'0.05em' }}>{k}</span>
                    <span style={{ fontSize:13, color:'#e2e3ed', fontFamily:'monospace', textTransform:'capitalize' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button onClick={() => speak(`${viewOrder.order_number || viewOrder.id}: ${viewOrder.product} for ${viewOrder.customer}, status ${viewOrder.status}`)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 0', borderRadius:10, background:'transparent', border:'1px solid rgba(75,77,107,0.5)', color:'#9394a5', cursor:'pointer', fontSize:13 }}>
                  <Volume2 size={13} /> Read Aloud
                </button>
                <button onClick={() => setViewOrder(null)} style={{ flex:1, padding:'10px 0', borderRadius:10, background:'transparent', border:'1px solid rgba(75,77,107,0.5)', color:'#9394a5', cursor:'pointer', fontSize:13 }}>Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <VoiceToast result={toast} onDismiss={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  )
}
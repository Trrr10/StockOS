import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Minus, Search, CheckCircle, Loader,
  BarChart2, AlertCircle, Package, X,
  Mic, MicOff, Volume2, ChevronDown, Sparkles, AlertTriangle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import axios from 'axios'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const REASONS_IN  = ['Purchase Received','Return from Customer','Production Output','Correction - Undercount','Transfer In','Opening Stock']
const REASONS_OUT = ['Sales Order','Production Input','Wastage / Damage','Correction - Overcount','Transfer Out','Sample / Testing','Expired / Disposed']

const SARVAM_LANGUAGES = [
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'en-IN', label: 'English' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'ml-IN', label: 'Malayalam' },
]

// ── Hindi number words → digits ───────────────────────────────────────────────
const HINDI_NUMBERS = {
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5,
  'पाँच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8,
  'नौ': 9, 'दस': 10, 'ग्यारह': 11, 'बारह': 12, 'तेरह': 13,
  'चौदह': 14, 'पंद्रह': 15, 'सोलह': 16, 'सत्रह': 17,
  'अठारह': 18, 'उन्नीस': 19, 'बीस': 20, 'तीस': 30,
  'चालीस': 40, 'पचास': 50, 'साठ': 60, 'सत्तर': 70,
  'अस्सी': 80, 'नब्बे': 90, 'सौ': 100, 'दो सौ': 200,
  'पाँच सौ': 500, 'हज़ार': 1000, 'हजार': 1000,
}

// ── Debounce guard (prevents mic spam) ───────────────────────────────────────
let lastVoiceCall = 0

// ── Local rule-based parser — zero API calls ──────────────────────────────────
function localParseIntent(text, products) {
  let t = text.toLowerCase().trim().slice(0, 200)

  // Resolve Hindi number words to digits first
  for (const [word, num] of Object.entries(HINDI_NUMBERS)) {
    t = t.replace(word, String(num))
  }

  // Detect type
  const IN_WORDS  = ['add', 'added', 'in', 'daalo', 'daal', 'aaya', 'received', 'mila',
                     'milega', 'purchase', 'stock in', 'andar', 'jama', 'ऐड', 'आया', 'जमा']
  const OUT_WORDS = ['remove', 'removed', 'out', 'hatao', 'hata', 'gaya', 'sold', 'sell',
                     'nikalo', 'nikal', 'use', 'wastage', 'damaged', 'expired', 'bahar',
                     'निकालो', 'हटाओ', 'गया', 'बेचा']
  const type = OUT_WORDS.some(w => t.includes(w)) ? 'out' : 'in'

  // Extract quantity — matches digits anywhere in text
  const numMatch = t.match(/\b(\d+)\b/)
  const quantity = numMatch ? parseInt(numMatch[1]) : null

  // Match product — score each product by how many of its name words appear in transcript
  let bestMatch = null
  let bestScore = 0
  for (const p of products) {
    const nameWords = p.name.toLowerCase().split(/\s+/)
    const score = nameWords.filter(w => w.length > 2 && t.includes(w)).length
    const codeMatch = t.includes(p.product_code.toLowerCase()) ? 2 : 0
    if (score + codeMatch > bestScore) {
      bestScore = score + codeMatch
      bestMatch = p
    }
  }

  // Require at least one word overlap for confidence
  const confidence = quantity && bestMatch && bestScore >= 1 ? 'high' : 'low'

  // Auto-pick a sensible reason
  const reason = type === 'in'
    ? (t.includes('return') ? 'Return from Customer'
      : t.includes('production') || t.includes('output') ? 'Production Output'
      : 'Purchase Received')
    : (t.includes('sold') || t.includes('sale') || t.includes('order') ? 'Sales Order'
      : t.includes('waste') || t.includes('damage') ? 'Wastage / Damage'
      : t.includes('expir') ? 'Expired / Disposed'
      : t.includes('production') || t.includes('input') ? 'Production Input'
      : 'Sales Order')

  return { type, quantity, product_name: bestMatch?.name || null, reason, confidence, _source: 'local' }
}

export default function StockAdjustmentPage() {
  const { user } = useAuth()
  const [products, setProducts]   = useState([])
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(null)
  const [type, setType]           = useState('in')
  const [quantity, setQuantity]   = useState('')
  const [reason, setReason]       = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [done, setDone]           = useState(false)
  const [history, setHistory]     = useState([])
  const [histLoading, setHistLoading] = useState(true)
  const [dropOpen, setDropOpen]   = useState(false)

  // ── Voice state ──
  const [voiceOpen, setVoiceOpen]     = useState(false)
  const [voiceLang, setVoiceLang]     = useState('en-IN')
  const [recording, setRecording]     = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('idle')
  const [transcript, setTranscript]   = useState('')
  const [langDropOpen, setLangDropOpen] = useState(false)

  // ── Confirmation popup state ──
  const [confirmData, setConfirmData] = useState(null)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])

  useEffect(() => { fetchProducts(); fetchHistory() }, [])

  useEffect(() => {
    const sub = supabase.channel('stock-adj-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stock_movements' }, () => fetchHistory())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, quantity, unit, product_code, reorder_threshold, category')
      .order('name')
    if (data) setProducts(data)
  }

  async function fetchHistory() {
    setHistLoading(true)
    const { data } = await supabase
      .from('stock_movements')
      .select('id, created_at, type, quantity, reason, products(name, product_code), profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(12)
    if (data) setHistory(data)
    setHistLoading(false)
  }

  // ── Voice recording ───────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []
      recorder.ondataavailable = e => audioChunksRef.current.push(e.data)
      recorder.onstop = () => handleRecordingStop(stream)
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setVoiceStatus('recording')
      setTranscript('')
    } catch {
      toast.error('Microphone access denied')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function handleRecordingStop(stream) {
    stream.getTracks().forEach(t => t.stop())

    const now = Date.now()
    if (now - lastVoiceCall < 4000) return
    lastVoiceCall = now

    setVoiceStatus('transcribing')

    try {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

      if (blob.size < 3000) {
        setVoiceStatus('idle')
        toast('Hold the mic longer and speak clearly', { icon: '🎙️' })
        return
      }

      const formData = new FormData()
      formData.append('file', blob, 'audio.webm')
      formData.append('model', 'saarika:v2.5')
      formData.append('language_code', voiceLang)

      const { data: sessionData2 } = await supabase.auth.getSession()
      const sttRes = await axios.post(`${BACKEND}/api/voice/stt`, formData, {
        headers: {
          Authorization: `Bearer ${sessionData2?.session?.access_token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      const text = sttRes.data?.transcript || ''
      setTranscript(text)

      if (!text.trim()) {
        setVoiceStatus('error')
        toast.error('Could not understand audio. Try again.')
        return
      }

      setVoiceStatus('parsing')

      // Local parser only — no Groq
      const intent = localParseIntent(text, products)

      if (!intent || intent.confidence === 'low' || !intent.product_name || !intent.quantity) {
        setVoiceStatus('error')
        toast.error('Could not parse intent. Try: "50 units cotton add karo" or "remove 20 denim"')
        return
      }

      // Fuzzy match product
      const matched = products.find(p =>
        p.name.toLowerCase().includes(intent.product_name.toLowerCase()) ||
        intent.product_name.toLowerCase().includes(p.name.toLowerCase())
      )

      if (!matched) {
        setVoiceStatus('error')
        toast.error(`Product "${intent.product_name}" not found in inventory.`)
        return
      }

      setConfirmData({
        type: intent.type || 'in',
        product: matched,
        quantity: intent.quantity,
        reason: intent.reason || (intent.type === 'in' ? REASONS_IN[0] : REASONS_OUT[0]),
        transcript: text,
      })

      setVoiceStatus('done')
    } catch (err) {
      console.error(err)
      setVoiceStatus('error')
      toast.error(err.response?.data?.detail || 'Voice processing failed')
    }
  }

  function applyConfirm() {
    if (!confirmData) return
    setType(confirmData.type)
    setSelected(confirmData.product)
    setSearch(confirmData.product.name)
    setQuantity(String(confirmData.quantity))
    setReason(confirmData.reason)
    setConfirmData(null)
    setVoiceStatus('idle')
    toast.success('Form filled from voice!')
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selected)                            return toast.error('Select a product first')
    if (!quantity || parseInt(quantity) <= 0) return toast.error('Enter a valid quantity')
    if (!reason)                              return toast.error('Select a reason')
    if (type === 'out' && parseInt(quantity) > (selected.quantity || 0))
      return toast.error(`Only ${selected.quantity} ${selected.unit} available`)

    setSaving(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      await axios.post(`${BACKEND}/api/stock/adjust`, {
        product_id: selected.id,
        type,
        quantity: parseInt(quantity),
        reason,
        notes,
        adjustment_type: 'manual',
      }, { headers: { Authorization: `Bearer ${token}` } })

      const newQty = type === 'in'
        ? (selected.quantity || 0) + parseInt(quantity)
        : (selected.quantity || 0) - parseInt(quantity)

      toast.success(`${type === 'in' ? '+' : '-'}${quantity} ${selected.unit} — ${selected.name}`)
      if (newQty < selected.reorder_threshold) {
        setTimeout(() => toast('⚠️ Now below reorder threshold!', { icon: '🔴' }), 600)
      }

      setSaving(false)
      setDone(true)
      await fetchProducts()
      await fetchHistory()
      setSelected(prev => prev ? { ...prev, quantity: newQty } : null)

      setTimeout(() => {
        setDone(false)
        setSelected(null)
        setSearch('')
        setQuantity('')
        setReason('')
        setNotes('')
        setType('in')
        setTranscript('')
        setVoiceStatus('idle')
      }, 2200)
    } catch (err) {
      setSaving(false)
      toast.error(err.response?.data?.detail || err.message || 'Adjustment failed')
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.product_code.toLowerCase().includes(search.toLowerCase())
  )
  const reasons = type === 'in' ? REASONS_IN : REASONS_OUT
  const selectedLang = SARVAM_LANGUAGES.find(l => l.code === voiceLang)

  const voiceStatusInfo = {
    idle:         { label: 'Hold mic and speak',               color: 'rgba(255,255,255,0.3)' },
    recording:    { label: 'Listening… release to process',    color: '#f87171' },
    transcribing: { label: 'Transcribing via Sarvam…',         color: '#fbbf24' },
    parsing:      { label: 'Parsing intent…',                  color: '#818cf8' },
    done:         { label: 'Done! Review below.',              color: '#4ade80' },
    error:        { label: 'Failed — try again',               color: '#f87171' },
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">

      {/* ── Confirmation popup ── */}
      <AnimatePresence>
        {confirmData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) setConfirmData(null) }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 16, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{ background: '#0f1019', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(126,255,212,0.1)', border: '1px solid rgba(126,255,212,0.2)' }}>
                    <Sparkles size={15} style={{ color: '#7effd4' }} />
                  </div>
                  <h3 className="font-display font-bold text-white text-base">Voice Confirmation</h3>
                  <button onClick={() => setConfirmData(null)} className="ml-auto text-muted hover:text-white transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <p className="text-xs text-muted ml-11 font-mono italic">"{confirmData.transcript}"</p>
              </div>

              {/* Parsed data */}
              <div className="px-6 py-5 space-y-3">
                {[
                  { label: 'Action',    value: confirmData.type === 'in' ? '📥 Stock In' : '📤 Stock Out',
                    color: confirmData.type === 'in' ? '#7effd4' : '#f87171' },
                  { label: 'Product',  value: confirmData.product.name },
                  { label: 'Quantity', value: `${confirmData.quantity} ${confirmData.product.unit}` },
                  { label: 'Reason',   value: confirmData.reason },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-muted uppercase tracking-wider font-mono">{label}</span>
                    <span className="text-sm font-medium" style={{ color: color || '#e2e8f0' }}>{value}</span>
                  </div>
                ))}

                {/* Stock after preview */}
                <div className="mt-2 p-3 rounded-xl text-xs font-mono"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                  <span className="text-muted">Current: </span>
                  <span className="text-white">{confirmData.product.quantity} {confirmData.product.unit}</span>
                  <span className="text-muted mx-2">→</span>
                  <span style={{ color: confirmData.type === 'in' ? '#4ade80' : '#f87171' }}>
                    {confirmData.type === 'in'
                      ? confirmData.product.quantity + confirmData.quantity
                      : Math.max(0, confirmData.product.quantity - confirmData.quantity)
                    } {confirmData.product.unit}
                  </span>
                </div>

                {/* Below threshold warning */}
                {confirmData.type === 'out' &&
                  (confirmData.product.quantity - confirmData.quantity) < confirmData.product.reorder_threshold && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                    <AlertTriangle size={11} />
                    Will go below reorder threshold!
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setConfirmData(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={applyConfirm}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: 'rgba(126,255,212,0.1)', border: '1px solid rgba(126,255,212,0.25)', color: '#7effd4' }}
                >
                  <CheckCircle size={14} /> Apply to Form
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEFT: Form ── */}
      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="font-display font-bold text-white text-xl">Stock Adjustment</h2>
          <p className="text-muted text-sm">Update inventory with full audit trail</p>
        </motion.div>

        {/* ── VOICE MODE SECTION ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(126,255,212,0.03)', border: '1px solid rgba(126,255,212,0.12)' }}
        >
          <button
            onClick={() => { setVoiceOpen(o => !o); if (recording) stopRecording() }}
            className="w-full px-4 pt-4 pb-3 flex items-center gap-2 border-b border-border/50 transition-colors hover:bg-white/[0.02]"
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(126,255,212,0.1)', border: '1px solid rgba(126,255,212,0.2)' }}>
              <Volume2 size={11} style={{ color: '#7effd4' }} />
            </div>
            <span className="text-xs font-semibold text-white">Voice Mode</span>
            <span className="text-xs text-muted ml-1">· powered by Sarvam AI</span>
            <motion.div
              animate={{ rotate: voiceOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="ml-auto"
            >
              <ChevronDown size={13} style={{ color: 'var(--muted)' }} />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
          {voiceOpen && (
          <motion.div
            key="voice-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
          <div className="p-4 flex items-center gap-4">
            <motion.button
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerLeave={stopRecording}
              disabled={voiceStatus === 'transcribing' || voiceStatus === 'parsing'}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              animate={recording ? {
                boxShadow: ['0 0 0px rgba(248,113,113,0)', '0 0 22px rgba(248,113,113,0.5)', '0 0 0px rgba(248,113,113,0)'],
              } : {}}
              transition={recording ? { duration: 1.4, repeat: Infinity } : {}}
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-all"
              style={recording
                ? { background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.4)' }
                : { background: 'rgba(126,255,212,0.08)', border: '1px solid rgba(126,255,212,0.2)' }
              }
            >
              {voiceStatus === 'transcribing' || voiceStatus === 'parsing'
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}>
                    <Loader size={20} style={{ color: '#fbbf24' }} />
                  </motion.div>
                : recording
                  ? <MicOff size={20} style={{ color: '#f87171' }} />
                  : <Mic size={20} style={{ color: '#7effd4' }} />
              }
            </motion.button>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono mb-2" style={{ color: voiceStatusInfo[voiceStatus].color }}>
                {voiceStatusInfo[voiceStatus].label}
              </p>

              {transcript && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-muted italic truncate mb-2"
                >
                  "{transcript}"
                </motion.p>
              )}

              <div className="relative">
                <button
                  onClick={() => setLangDropOpen(o => !o)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                >
                  {selectedLang?.label}
                  <ChevronDown size={10} />
                </button>

                <AnimatePresence>
                  {langDropOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      className="absolute top-full mt-1 left-0 rounded-xl shadow-2xl z-30 overflow-y-auto"
style={{ background: '#12131f', border: '1px solid var(--border)', minWidth: '140px', maxHeight: '220px' }}
                      
                    >
                      {SARVAM_LANGUAGES.map(l => (
                        <button
                          key={l.code}
                          onClick={() => { setVoiceLang(l.code); setLangDropOpen(false) }}
                          className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5"
                          style={{ color: l.code === voiceLang ? '#7effd4' : 'var(--muted)' }}
                        >
                          {l.label}
                          {l.code === voiceLang && <span className="ml-2 text-[10px]">✓</span>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="px-4 pb-3">
            <p className="text-[11px] text-muted/60 font-mono">
              Hold mic · "पचास यूनिट कॉटन ऐड करो" · "remove 20 denim" · "50 cotton add karo"
            </p>
          </div>
          </motion.div>
          )}
          </AnimatePresence>
        </motion.div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-[11px] text-muted font-mono uppercase tracking-wider">or fill manually</span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* Type toggle */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="flex gap-2 p-1 rounded-xl border border-border"
          style={{ background: 'var(--card)' }}
        >
          {[
            { val: 'in',  label: 'Stock In',  Icon: Plus,
              active: { background: 'rgba(126,255,212,0.07)', color: '#7effd4', border: '1px solid rgba(126,255,212,0.18)' } },
            { val: 'out', label: 'Stock Out', Icon: Minus,
              active: { background: 'rgba(248,113,113,0.07)', color: '#f87171', border: '1px solid rgba(248,113,113,0.18)' } },
          ].map(t => (
            <button
              key={t.val}
              onClick={() => { setType(t.val); setReason('') }}
              className="relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={type === t.val ? t.active : { color: 'var(--muted)' }}
            >
              <t.Icon size={14} />
              <span>{t.label}</span>
            </button>
          ))}
        </motion.div>

        {/* Product search */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <label className="text-xs text-muted mb-1.5 block">Search Product</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              className="input-dark w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
              placeholder="Search by name or code..."
              value={search}
              onChange={e => { setSearch(e.target.value); setDropOpen(true); setSelected(null) }}
              onFocus={() => setDropOpen(true)}
            />
          </div>

          <AnimatePresence>
            {dropOpen && search && !selected && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="mt-1 rounded-xl overflow-hidden shadow-2xl z-20 relative"
                style={{ background: '#12131f', border: '1px solid var(--border)' }}
              >
                <div className="max-h-52 overflow-y-auto">
                  {filteredProducts.slice(0, 8).map(p => (
                    <button
                      key={p.id}
                      onMouseDown={() => { setSelected(p); setSearch(p.name); setDropOpen(false) }}
                      className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left border-b border-border/40 last:border-0 hover:bg-white/[0.05]"
                    >
                      <div>
                        <p className="text-sm text-white">{p.name}</p>
                        <p className="text-xs text-muted font-mono">{p.product_code} · {p.category}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-mono font-bold text-white">{p.quantity}</p>
                        <p className="text-xs text-muted">{p.unit}</p>
                      </div>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="text-center text-muted text-sm py-4">No products found</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Selected product card */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ duration: 0.2 }}
              className="p-4 rounded-xl relative"
              style={{ background: 'rgba(126,255,212,0.04)', border: '1px solid rgba(126,255,212,0.15)' }}
            >
              <button
                onClick={() => { setSelected(null); setSearch('') }}
                className="absolute top-3 right-3 text-muted hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package size={18} style={{ color: '#7effd4' }} />
                  <div>
                    <p className="text-sm text-white font-medium">{selected.name}</p>
                    <p className="text-xs text-muted font-mono">{selected.product_code} · {selected.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <motion.p
                    key={selected.quantity}
                    initial={{ scale: 1.15, color: '#7effd4' }}
                    animate={{ scale: 1, color: '#ffffff' }}
                    transition={{ duration: 0.3 }}
                    className="font-display font-bold text-2xl"
                  >
                    {selected.quantity}
                  </motion.p>
                  <p className="text-xs text-muted">{selected.unit} on hand</p>
                </div>
              </div>

              {(selected.quantity || 0) < selected.reorder_threshold && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2"
                  style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171' }}
                >
                  <AlertCircle size={12} />
                  Currently below reorder threshold ({selected.reorder_threshold} {selected.unit})
                </motion.div>
              )}

              <div className="mt-3">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ((selected.quantity || 0) / Math.max((selected.reorder_threshold || 1) * 2.5, 1)) * 100)}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{ background: (selected.quantity || 0) < selected.reorder_threshold ? '#f87171' : '#7effd4' }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quantity */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <label className="text-xs text-muted mb-1.5 block">Quantity *</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity(q => String(Math.max(0, parseInt(q || '0') - 1)))}
              className="w-9 h-9 rounded-xl flex items-center justify-center btn-ghost flex-shrink-0"
            >
              <Minus size={14} />
            </button>
            <input
              type="number" min="1"
              className="input-dark flex-1 rounded-xl px-4 py-2.5 text-sm text-center font-mono font-bold text-lg"
              placeholder="0"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
            />
            <button
              onClick={() => setQuantity(q => String((parseInt(q || '0') + 1)))}
              className="w-9 h-9 rounded-xl flex items-center justify-center btn-ghost flex-shrink-0"
            >
              <Plus size={14} />
            </button>
          </div>
          {selected && quantity && type === 'out' && (
            <p className="text-xs text-muted mt-1.5 font-mono">
              After: <span className={parseInt(quantity) > (selected.quantity || 0) ? 'text-red-400' : 'text-white'}>
                {Math.max(0, (selected.quantity || 0) - parseInt(quantity))} {selected.unit}
              </span>
            </p>
          )}
          {selected && quantity && type === 'in' && (
            <p className="text-xs text-muted mt-1.5 font-mono">
              After: <span className="text-green-400">{(selected.quantity || 0) + parseInt(quantity)} {selected.unit}</span>
            </p>
          )}
        </motion.div>

        {/* Reason */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <label className="text-xs text-muted mb-1.5 block">Reason *</label>
          <select
            className="input-dark w-full rounded-xl px-4 py-2.5 text-sm"
            value={reason}
            onChange={e => setReason(e.target.value)}
          >
            <option value="">Select reason...</option>
            {reasons.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </motion.div>

        {/* Notes */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
          <label className="text-xs text-muted mb-1.5 block">Notes <span className="opacity-50">(optional)</span></label>
          <textarea
            className="input-dark w-full rounded-xl px-4 py-2.5 text-sm resize-none"
            rows={2}
            placeholder="Additional context..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </motion.div>

        {/* Submit */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <button
            onClick={handleSubmit}
            disabled={saving || done}
            className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all disabled:cursor-not-allowed"
            style={
              done
                ? { background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }
                : type === 'in'
                ? { background: 'rgba(126,255,212,0.12)', border: '1px solid rgba(126,255,212,0.25)', color: '#7effd4' }
                : { background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.25)', color: '#f87171' }
            }
          >
            <AnimatePresence mode="wait">
              {done ? (
                <motion.span key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                  <CheckCircle size={16} /> Done!
                </motion.span>
              ) : saving ? (
                <motion.span key="saving" className="flex items-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}>
                    <Loader size={16} />
                  </motion.div>
                  Processing...
                </motion.span>
              ) : (
                <motion.span key="idle" className="flex items-center gap-2">
                  {type === 'in' ? <Plus size={16} /> : <Minus size={16} />}
                  Confirm {type === 'in' ? 'Stock In' : 'Stock Out'}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.div>
      </div>

      {/* ── RIGHT: History ── */}
      <div>
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between mb-4"
        >
          <h3 className="font-display font-bold text-white text-lg">Recent Adjustments</h3>
          <span className="text-xs text-muted font-mono">{history.length} entries</span>
        </motion.div>

        <div className="space-y-2.5">
          <AnimatePresence>
            {histLoading
              ? [...Array(6)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)
              : history.length === 0
                ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-14 text-muted">
                    <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No adjustments yet</p>
                  </motion.div>
                )
                : history.map((h, i) => (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ delay: i * 0.04 }}
                    className="glass-card rounded-xl p-4 flex items-center gap-4 cursor-default"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: h.type === 'in' ? 'rgba(126,255,212,0.07)' : 'rgba(248,113,113,0.07)',
                        border: h.type === 'in' ? '1px solid rgba(126,255,212,0.15)' : '1px solid rgba(248,113,113,0.15)',
                      }}
                    >
                      {h.type === 'in'
                        ? <Plus size={14} style={{ color: '#7effd4' }} />
                        : <Minus size={14} style={{ color: '#f87171' }} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{h.products?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted truncate">
                        {h.reason} · <span className="font-mono">{h.products?.product_code}</span>
                        {h.profiles?.full_name && ` · ${h.profiles.full_name.split(' ')[0]}`}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-sm font-bold"
                        style={{ color: h.type === 'in' ? '#7effd4' : '#f87171' }}>
                        {h.type === 'in' ? '+' : '-'}{h.quantity}
                      </p>
                      <p className="text-xs text-muted">
                        {new Date(h.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </motion.div>
                ))
            }
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
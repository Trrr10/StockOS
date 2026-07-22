// TrackingMap.jsx — voice-automated movement logging
// Voice flow: hold mic → Sarvam STT (primary) → Web Speech fallback → auto-fills & submits

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  MapPin, Clock, X, ChevronDown, Navigation,
  Mic, MicOff, Loader2, CheckCircle2, AlertCircle, Wand2,
  Package, Truck, Factory
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const LOCATION_PRESETS = [
  { label: 'Mumbai Warehouse',    lat: 19.0760,  lng: 72.8777 },
  { label: 'Surat Factory',       lat: 21.1702,  lng: 72.8311 },
  { label: 'Ahmedabad Hub',       lat: 23.0225,  lng: 72.5714 },
  { label: 'Delhi Distribution',  lat: 28.6139,  lng: 77.2090 },
  { label: 'Tirupur Cluster',     lat: 11.1085,  lng: 77.3411 },
  { label: 'Ludhiana Mill',       lat: 30.9010,  lng: 75.8573 },
  { label: 'Kolkata Port',        lat: 22.5726,  lng: 88.3639 },
  { label: 'Chennai Export Zone', lat: 13.0827,  lng: 80.2707 },
]

const STATUS_ICONS = {
  at_warehouse: '🏭', in_transit: '🚛', at_factory: '⚙️',
  dispatched: '📦',   delivered: '✅',  customs: '🛃', custom: '📍',
}
const STATUS_COLORS = {
  at_warehouse: '#60a5fa', in_transit: '#f59e0b', at_factory: '#a78bfa',
  dispatched: '#34d399',   delivered: '#10b981',  customs: '#fb923c', custom: '#e879f9',
}

const STATUS_KEYWORD_MAP = {
  'warehouse': 'at_warehouse', 'wharehouse': 'at_warehouse', 'godown': 'at_warehouse',
  'transit': 'in_transit',     'moving': 'in_transit',       'on the way': 'in_transit',
  'factory': 'at_factory',     'plant': 'at_factory',        'mill': 'at_factory',
  'dispatched': 'dispatched',  'shipped': 'dispatched',      'sent': 'dispatched',
  'delivered': 'delivered',    'received': 'delivered',      'arrived': 'delivered',
  'customs': 'customs',        'clearance': 'customs',
}

const MIME_MAP = {
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/opus': 'ogg',
  'audio/mp4': 'mp4',   'audio/mpeg': 'mp3','audio/mp3': 'mp3',
  'audio/wav': 'wav',   'audio/flac': 'flac','audio/aac': 'aac',
}

function parseVoiceMovement(transcript) {
  const t = transcript.toLowerCase()
  let status = 'in_transit'
  for (const [kw, s] of Object.entries(STATUS_KEYWORD_MAP)) {
    if (t.includes(kw)) { status = s; break }
  }
  let location = ''
  for (const p of LOCATION_PRESETS) {
    if (t.includes(p.label.toLowerCase())) { location = p.label; break }
    const firstWord = p.label.split(' ')[0].toLowerCase()
    if (t.includes(firstWord)) { location = p.label; break }
  }
  let note = transcript
    .replace(new RegExp(Object.keys(STATUS_KEYWORD_MAP).join('|'), 'gi'), '')
    .replace(location, '').replace(/\s{2,}/g, ' ').trim()
  if (note.length < 3) note = transcript
  return { status, location, note }
}

// ─── Sarvam STT — gets token from Supabase session directly ──────────────────
let lastSarvamCallTs = 0
const SARVAM_COOLDOWN_MS = 3000
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

async function sarvamSTT(blob, mimeType, language = 'en-IN') {
  const now = Date.now()
  if (now - lastSarvamCallTs < SARVAM_COOLDOWN_MS) throw new Error('cooldown')
  lastSarvamCallTs = now

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('no_auth')

  const cleanMime = mimeType.split(';')[0].trim().toLowerCase()
  const ext = MIME_MAP[cleanMime] || 'webm'

  const fd = new FormData()
  fd.append('file', new Blob([await blob.arrayBuffer()], { type: cleanMime }), `voice.${ext}`)
  fd.append('language_code', language)

  const res = await fetch(`${BACKEND_URL}/api/voice/stt`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `STT error ${res.status}`)
  }
  return (await res.json()).transcript || ''
}

// ─── Browser Web Speech (fallback) ───────────────────────────────────────────
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

// ─── Geocoding ────────────────────────────────────────────────────────────────
let geocodeTimer = null
async function geocodeLocation(name) {
  const preset = LOCATION_PRESETS.find(
    p => p.label.toLowerCase().includes(name.toLowerCase()) ||
         name.toLowerCase().includes(p.label.toLowerCase())
  )
  if (preset) return { lat: preset.lat, lng: preset.lng, source: 'preset' }
  try {
    const q = encodeURIComponent(`${name}, India`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'StockOS/1.0' } }
    )
    const data = await res.json()
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), source: 'geocoded' }
  } catch {}
  return null
}

// ─── Leaflet ──────────────────────────────────────────────────────────────────
function useLeaflet(onReady) {
  useEffect(() => {
    if (window.L) { onReady(window.L); return }
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
    document.head.appendChild(css)
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
    script.onload = () => onReady(window.L)
    document.head.appendChild(script)
  }, [])
}

function LeafletMap({ logs, onMapClick }) {
  const mapRef = useRef(null)
  const instance = useRef(null)
  const markersRef = useRef([])
  const polylineRef = useRef(null)
  const [ready, setReady] = useState(false)

  useLeaflet(L => {
    setReady(true)
    if (!mapRef.current || instance.current) return
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false })
      .setView([20.5937, 78.9629], 5)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 })
      .addTo(map)
    instance.current = map
    map.on('click', e => onMapClick?.(e.latlng.lat, e.latlng.lng))
  })

  useEffect(() => {
    const L = window.L; const map = instance.current
    if (!L || !map || !ready) return
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []
    if (polylineRef.current) map.removeLayer(polylineRef.current)
    if (!logs.length) return
    const pts = []
    logs.forEach((log, i) => {
      const isLatest = i === logs.length - 1
      const color = STATUS_COLORS[log.status] || '#e879f9'
      const icon = L.divIcon({
        html: `<div style="background:${color};width:${isLatest ? 18 : 12}px;height:${isLatest ? 18 : 12}px;border-radius:50%;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 ${isLatest ? '12px' : '4px'} ${color}"></div>`,
        iconSize: [isLatest ? 18 : 12, isLatest ? 18 : 12],
        iconAnchor: [isLatest ? 9 : 6, isLatest ? 9 : 6],
        className: '',
      })
      const marker = L.marker([log.lat, log.lng], { icon }).addTo(map)
        .bindPopup(`<div style="font-family:monospace;font-size:12px;min-width:160px"><b>${STATUS_ICONS[log.status] || '📍'} ${log.location}</b><br><span style="color:#555">${new Date(log.timestamp).toLocaleString()}</span>${log.note ? `<br><br>${log.note}` : ''}</div>`)
      markersRef.current.push(marker)
      pts.push([log.lat, log.lng])
    })
    if (pts.length > 1) {
      polylineRef.current = L.polyline(pts, { color: '#a78bfa', weight: 2, opacity: 0.6, dashArray: '6 4' }).addTo(map)
      map.fitBounds(pts, { padding: [30, 30] })
    } else {
      map.setView(pts[0], 8)
    }
  }, [logs, ready])

  return <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
}

// ─── Voice Movement Input ─────────────────────────────────────────────────────
function VoiceMovementInput({ onParsed, language }) {
  const [phase, setPhase] = useState('idle')
  const [waveLevel, setWaveLevel] = useState(0)
  const [heard, setHeard] = useState('')
  const [sarvamUsed, setSarvamUsed] = useState(false)

  const mrRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const analyserRef = useRef(null)
  const frameRef = useRef(null)
  const mimeRef = useRef(
    ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4']
      .find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || 'audio/webm'
  )
  const startTsRef = useRef(0)

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
    try {
      setPhase('recording'); setHeard(''); setSarvamUsed(false)
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
    } catch { setPhase('error') }
  }

  const stopRec = () => {
    if (mrRef.current?.state === 'recording') { mrRef.current.stop(); setPhase('processing') }
  }

  const runPipeline = async () => {
    try {
      let transcript = ''
      const blob = new Blob(chunksRef.current, { type: mimeRef.current })

      // ── Step 1: Sarvam STT (primary — gets its own auth token) ──
      if (blob.size > 1000) {
        try {
          transcript = await sarvamSTT(blob, mimeRef.current, language)
          if (transcript) setSarvamUsed(true)
        } catch (e) {
          console.warn('Sarvam STT failed, falling back to Web Speech:', e.message)
        }
      }

      // ── Step 2: Web Speech fallback ──
      if (!transcript) {
        await new Promise(r => setTimeout(r, 300))
        transcript = await webSpeechSTT(language)
      }

      if (!transcript) { setPhase('error'); return }

      setHeard(transcript)
      const parsed = parseVoiceMovement(transcript)
      setPhase('done')
      onParsed(parsed)
    } catch (err) {
      console.error(err); setPhase('error')
    }
  }

  if (phase === 'idle') return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:12, borderRadius:12, background:'rgba(30,31,50,0.5)', border:'1px solid rgba(75,77,107,0.3)' }}>
      <button
        onMouseDown={startRec} onTouchStart={e => { e.preventDefault(); startRec() }}
        style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#7c3aed,#5b21b6)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}
      >
        <Mic size={15} color="#fff" />
      </button>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:12, color:'#c4c6d0', margin:0, fontWeight:500 }}>Hold mic & speak your note</p>
        <p style={{ fontSize:11, color:'#6b6e89', margin:'3px 0 0' }}>e.g. "reached Mumbai warehouse, goods look fine"</p>
      </div>
      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', color:'#34d399', fontFamily:'monospace', flexShrink:0 }}>
        Sarvam primary
      </span>
    </div>
  )

  if (phase === 'recording') return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:12, borderRadius:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)' }}>
      <button
        onMouseUp={stopRec} onTouchEnd={e => { e.preventDefault(); stopRec() }}
        style={{ width:36, height:36, borderRadius:'50%', background:'#ef4444', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, animation:'pulse 1.5s infinite' }}
      >
        <MicOff size={15} color="#fff" />
      </button>
      <div style={{ display:'flex', gap:2, alignItems:'flex-end', height:28 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ width:3, borderRadius:2, background:'rgba(248,113,113,0.7)', height: Math.max(3, (waveLevel / 4) * Math.abs(Math.sin(i * 0.9)) + 4) }} />
        ))}
      </div>
      <p style={{ fontSize:12, color:'#fca5a5', margin:0 }}>Release to process…</p>
    </div>
  )

  if (phase === 'processing') return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:12, borderRadius:12, background:'rgba(30,31,50,0.5)', border:'1px solid rgba(75,77,107,0.3)' }}>
      <Loader2 size={18} color="#a78bfa" style={{ animation:'spin 1s linear infinite', flexShrink:0 }} />
      <p style={{ fontSize:12, color:'#c4c6d0', margin:0 }}>Transcribing via Sarvam…</p>
    </div>
  )

  if (phase === 'done') return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:12, borderRadius:12, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)' }}>
      <CheckCircle2 size={15} color="#34d399" style={{ flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:12, color:'#6ee7b7', margin:0, fontWeight:500 }}>Fields auto-filled ✓ {sarvamUsed ? '(Sarvam)' : '(Web Speech)'}</p>
        <p style={{ fontSize:11, color:'#6b6e89', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontStyle:'italic' }}>"{heard}"</p>
      </div>
      <button onClick={() => { setPhase('idle'); setHeard('') }} style={{ fontSize:11, color:'#6b6e89', background:'none', border:'none', cursor:'pointer' }}>↺</button>
    </div>
  )

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:12, borderRadius:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
      <AlertCircle size={15} color="#f87171" style={{ flexShrink:0 }} />
      <p style={{ fontSize:12, color:'#fca5a5', margin:0 }}>Couldn't hear clearly — try again or fill manually</p>
      <button onClick={() => setPhase('idle')} style={{ fontSize:11, color:'#6b6e89', background:'none', border:'none', cursor:'pointer' }}>↺</button>
    </div>
  )
}

// ─── Add Movement Modal ───────────────────────────────────────────────────────
function AddMovementModal({ onClose, onAdd, clickedCoords, language }) {
  const [form, setForm] = useState({
    location: '', status: 'in_transit', note: '',
    lat: clickedCoords?.lat?.toFixed(5) || '',
    lng: clickedCoords?.lng?.toFixed(5) || '',
  })
  const [geocoding, setGeocoding] = useState(false)
  const [geoSource, setGeoSource] = useState(null)

  useEffect(() => {
    if (!form.location || form.location.length < 3) return
    clearTimeout(geocodeTimer)
    geocodeTimer = setTimeout(async () => {
      setGeocoding(true)
      const result = await geocodeLocation(form.location)
      if (result) {
        setForm(f => ({ ...f, lat: result.lat.toFixed(5), lng: result.lng.toFixed(5) }))
        setGeoSource(result.source)
      }
      setGeocoding(false)
    }, 600)
  }, [form.location])

  const handleVoiceParsed = useCallback(async (parsed) => {
    const updates = { status: parsed.status, note: parsed.note }
    if (parsed.location) {
      updates.location = parsed.location
      const geo = await geocodeLocation(parsed.location)
      if (geo) { updates.lat = geo.lat.toFixed(5); updates.lng = geo.lng.toFixed(5); setGeoSource(geo.source) }
    }
    setForm(f => ({ ...f, ...updates }))
  }, [])

  const applyPreset = label => {
    if (!label) return
    const p = LOCATION_PRESETS.find(x => x.label === label)
    if (p) { setForm(f => ({ ...f, location: p.label, lat: p.lat.toFixed(5), lng: p.lng.toFixed(5) })); setGeoSource('preset') }
  }

  const inputStyle = { width:'100%', padding:'8px 12px', borderRadius:8, background:'rgba(20,21,35,0.8)', border:'1px solid rgba(75,77,107,0.5)', color:'#e2e3ed', fontSize:13, outline:'none', boxSizing:'border-box' }
  const labelStyle = { fontSize:11, color:'#6b6e89', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:500, display:'block', marginBottom:4 }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(10,11,20,0.8)', backdropFilter:'blur(4px)' }} onClick={onClose} />
      <div style={{ position:'relative', zIndex:10, width:'100%', maxWidth:440, background:'rgba(20,22,38,0.98)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:16, padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:600, color:'#e2e3ed' }}>📍 Log Movement</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b6e89', cursor:'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom:16 }}>
          <VoiceMovementInput onParsed={handleVoiceParsed} language={language} />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{ flex:1, height:1, background:'rgba(75,77,107,0.3)' }} />
          <span style={{ fontSize:10, color:'#6b6e89', textTransform:'uppercase', letterSpacing:'0.08em' }}>or fill manually</span>
          <div style={{ flex:1, height:1, background:'rgba(75,77,107,0.3)' }} />
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={labelStyle}>Quick Preset</label>
            <select style={inputStyle} onChange={e => applyPreset(e.target.value)} defaultValue="">
              <option value="">— pick a hub —</option>
              {LOCATION_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Location Name *</label>
            <div style={{ position:'relative' }}>
              <input style={inputStyle} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Surat Factory Gate 2" />
              {geocoding && <Loader2 size={13} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#a78bfa', animation:'spin 1s linear infinite' }} />}
              {!geocoding && geoSource && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'#34d399' }}>{geoSource === 'preset' ? '⚡' : '🌐'}</span>}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_ICONS).map(([k, v]) => (
                <option key={k} value={k}>{v} {k.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={labelStyle}>Latitude *</label>
              <input style={inputStyle} type="number" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="19.076" />
            </div>
            <div>
              <label style={labelStyle}>Longitude *</label>
              <input style={inputStyle} type="number" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="72.877" />
            </div>
          </div>
          {clickedCoords && <p style={{ fontSize:11, color:'#22d3ee', margin:0 }}>💡 Coordinates pre-filled from map click</p>}
          <div>
            <label style={labelStyle}>Note</label>
            <textarea style={{ ...inputStyle, resize:'none', height:60 }} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="e.g. Arrived at port, customs clearance pending…" />
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, padding:'9px 0', borderRadius:10, background:'transparent', border:'1px solid rgba(75,77,107,0.5)', color:'#9394a5', cursor:'pointer', fontSize:13 }}>Cancel</button>
          <button
            onClick={() => {
              if (!form.location || !form.lat || !form.lng) return
              onAdd({ location: form.location, status: form.status, note: form.note, lat: parseFloat(form.lat), lng: parseFloat(form.lng), timestamp: new Date().toISOString() })
              onClose()
            }}
            disabled={!form.location || !form.lat || !form.lng}
            style={{ flex:1, padding:'9px 0', borderRadius:10, background:'#7c3aed', border:'none', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:500, opacity: (!form.location || !form.lat || !form.lng) ? 0.4 : 1 }}
          >
            Log Movement
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main TrackingMap ─────────────────────────────────────────────────────────
export default function TrackingMap({
  entityId, entityType = 'order', entityLabel = '',
  initialLogs = [], language = 'en-IN', onLogsChange = null,
}) {
  const [logs, setLogs] = useState(initialLogs)
  const [showModal, setShowModal] = useState(false)
  const [clickCoords, setClickCoords] = useState(null)
  const [expanded, setExpanded] = useState(true)

  const typeIcon = entityType === 'order' ? <Truck size={14} /> : entityType === 'manufacturing' ? <Factory size={14} /> : <Package size={14} />

  const handleAdd = useCallback(log => {
    setLogs(prev => {
      const next = [...prev, log]
      onLogsChange?.(next)
      return next
    })
    setClickCoords(null)
  }, [onLogsChange])

  const latestLog = logs[logs.length - 1]

  return (
    <div style={{ borderRadius:16, overflow:'hidden', marginTop:16, border:'1px solid rgba(124,58,237,0.15)', background:'linear-gradient(135deg,rgba(20,21,35,0.95),rgba(26,27,46,0.95))' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(75,77,107,0.3)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#a78bfa' }}>
            <Navigation size={14} />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#e2e3ed', display:'flex', alignItems:'center', gap:6 }}>
              {typeIcon} Location Tracker
            </div>
            <div style={{ fontSize:10, color:'#6b6e89', fontFamily:'monospace' }}>{entityId} · {entityLabel}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {latestLog && (
            <span style={{ fontSize:11, padding:'4px 10px', borderRadius:20, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', color:'#34d399', fontFamily:'monospace' }}>
              {STATUS_ICONS[latestLog.status]} {latestLog.location}
            </span>
          )}
          <button
            onClick={() => { setClickCoords(null); setShowModal(true) }}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:10, background:'#7c3aed', border:'none', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:500 }}
          >
            <Wand2 size={12} /> Add Stop
          </button>
          <button onClick={() => setExpanded(e => !e)} style={{ background:'none', border:'none', color:'#6b6e89', cursor:'pointer' }}>
            <ChevronDown size={16} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition:'0.2s' }} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', minHeight:320 }}>
          <div style={{ position:'relative' }}>
            <LeafletMap logs={logs} onMapClick={(lat, lng) => { setClickCoords({ lat, lng }); setShowModal(true) }} />
            {logs.length === 0 && (
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:10 }}>
                <div style={{ background:'rgba(10,11,20,0.9)', borderRadius:12, padding:'16px 24px', textAlign:'center', border:'1px solid rgba(124,58,237,0.15)' }}>
                  <MapPin size={24} color="#a78bfa" style={{ display:'block', margin:'0 auto 8px' }} />
                  <p style={{ fontSize:12, color:'#6b6e89', margin:0 }}>Click the map or "Add Stop"<br/>to log the first location</p>
                </div>
              </div>
            )}
            <div style={{ position:'absolute', bottom:8, left:8, zIndex:500, fontSize:10, color:'#6b6e89', background:'rgba(10,11,20,0.8)', padding:'4px 8px', borderRadius:6 }}>
              Click map to pin · Voice fills details automatically
            </div>
          </div>

          <div style={{ borderLeft:'1px solid rgba(75,77,107,0.3)', padding:16, overflowY:'auto', maxHeight:380 }}>
            <p style={{ fontSize:10, color:'#6b6e89', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:500, margin:'0 0 12px' }}>Movement Journal</p>
            {logs.length === 0 ? (
              <div style={{ textAlign:'center', color:'#6b6e89', fontSize:12, paddingTop:40 }}>
                <Clock size={20} style={{ display:'block', margin:'0 auto 8px', opacity:0.4 }} />
                No movements yet
              </div>
            ) : (
              <div style={{ position:'relative' }}>
                <div style={{ position:'absolute', left:7, top:0, bottom:0, width:1, background:'rgba(75,77,107,0.4)' }} />
                {[...logs].reverse().map((log, i) => {
                  const color = STATUS_COLORS[log.status] || '#e879f9'
                  const isFirst = i === 0
                  return (
                    <div key={i} style={{ display:'flex', gap:12, marginBottom:12, position:'relative' }}>
                      <div style={{ width:15, height:15, borderRadius:'50%', flexShrink:0, marginTop:4, border:'2px solid', background: isFirst ? color : 'rgba(75,77,107,0.4)', borderColor: isFirst ? color : '#4b4d6b', boxShadow: isFirst ? `0 0 8px ${color}` : 'none' }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:12, fontWeight:600, color: isFirst ? '#e2e3ed' : '#6b6e89', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {STATUS_ICONS[log.status]} {log.location}
                        </p>
                        <p style={{ fontSize:10, color:'#6b6e89', fontFamily:'monospace', margin:'2px 0 0' }}>
                          {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                        </p>
                        {log.note && <p style={{ fontSize:11, color:'#9394a5', margin:'4px 0 0', background:'rgba(75,77,107,0.2)', borderRadius:6, padding:'4px 8px', lineHeight:1.4 }}>{log.note}</p>}
                        <p style={{ fontSize:10, color:'rgba(75,77,107,0.7)', fontFamily:'monospace', margin:'2px 0 0' }}>{log.lat?.toFixed(4)}, {log.lng?.toFixed(4)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <AddMovementModal
          onClose={() => { setShowModal(false); setClickCoords(null) }}
          onAdd={handleAdd}
          clickedCoords={clickCoords}
          language={language}
        />
      )}
    </div>
  )
}
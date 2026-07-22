import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScanLine, Camera, X, CheckCircle, AlertCircle,
  Plus, Minus, Package, Loader, Zap, Trash2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import axios from 'axios'
import toast from 'react-hot-toast'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const REASONS_IN  = ['Purchase Received', 'Return from Customer', 'Production Output', 'Correction']
const REASONS_OUT = ['Sales Order', 'Production Input', 'Wastage', 'Correction', 'Transfer Out']

async function getAuthHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function BarcodeScanner() {
  const [mode, setMode]                   = useState('single')
  const [scannerActive, setScannerActive] = useState(false)
  const [scannedProduct, setScannedProduct] = useState(null)
  const [manualBarcode, setManualBarcode] = useState('')
  const [type, setType]                   = useState('in')
  const [qty, setQty]                     = useState(1)
  const [reason, setReason]               = useState('Purchase Received')
  const [submitting, setSubmitting]       = useState(false)
  const [done, setDone]                   = useState(false)
  const [lookingUp, setLookingUp]         = useState(false)
  const scannerRef = useRef(null)

  // Batch mode
  const [batchItems, setBatchItems]   = useState([])
  const [batchInput, setBatchInput]   = useState('')
  const [processing, setProcessing]   = useState(false)

  useEffect(() => {
    return () => {
      try { scannerRef.current?.clear?.() } catch {}
    }
  }, [])

  // When type changes, reset reason to first valid option
  useEffect(() => {
    setReason(type === 'in' ? REASONS_IN[0] : REASONS_OUT[0])
  }, [type])

  async function lookupBarcode(barcode) {
    const b = barcode.trim()
    if (!b) return
    setLookingUp(true)

    // Try matching barcode column first, then product_code as fallback
    let { data } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', b)
      .maybeSingle()

    if (!data) {
      // Fallback: try product_code
      const res = await supabase
        .from('products')
        .select('*')
        .eq('product_code', b)
        .maybeSingle()
      data = res.data
    }

    setLookingUp(false)

    if (data) {
      setScannedProduct(data)
      toast.success(`Found: ${data.name}`)
    } else {
      toast.error(`No product found for: ${b}`)
    }
  }

  async function startCamera() {
    setScannerActive(true)
    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode')
      // Clear any existing instance
      try { scannerRef.current?.clear?.() } catch {}

      scannerRef.current = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
        },
        false
      )

      scannerRef.current.render(
        async (decoded) => {
          try { scannerRef.current?.clear?.() } catch {}
          setScannerActive(false)
          await lookupBarcode(decoded)
        },
        () => {} // ignore errors
      )
    } catch (err) {
      toast.error('Camera not available. Try manual entry instead.')
      setScannerActive(false)
    }
  }

  function stopCamera() {
    try { scannerRef.current?.clear?.() } catch {}
    setScannerActive(false)
  }

  async function submitAdjustment() {
    if (!scannedProduct) return
    if (type === 'out' && qty > scannedProduct.quantity) {
      return toast.error(`Only ${scannedProduct.quantity} ${scannedProduct.unit} available`)
    }

    setSubmitting(true)
    try {
      const headers = await getAuthHeader()
      await axios.post(`${BACKEND}/api/stock/adjust`, {
        product_id: scannedProduct.id,
        type,
        quantity: qty,
        reason,
        adjustment_type: 'barcode_scan',
      }, { headers })

      toast.success(`${type === 'in' ? '+' : '-'}${qty} ${scannedProduct.unit} — ${scannedProduct.name}`)
      setDone(true)
      setTimeout(() => {
        setDone(false)
        setScannedProduct(null)
        setQty(1)
      }, 2000)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Update failed')
    }
    setSubmitting(false)
  }

  async function addToBatch() {
    const barcode = batchInput.trim()
    if (!barcode) return

    let { data } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle()

    if (!data) {
      const res = await supabase
        .from('products')
        .select('*')
        .eq('product_code', barcode)
        .maybeSingle()
      data = res.data
    }

    setBatchItems(prev => [...prev, {
      barcode,
      product: data || null,
      qty: 1,
      status: data ? 'pending' : 'error',
    }])
    setBatchInput('')
  }

  async function processBatch() {
    setProcessing(true)
    const updated = [...batchItems]
    const headers = await getAuthHeader()

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status !== 'pending' || !updated[i].product) continue
      try {
        await axios.post(`${BACKEND}/api/stock/adjust`, {
          product_id: updated[i].product.id,
          type: 'in',
          quantity: updated[i].qty,
          reason: 'Batch scan update',
          adjustment_type: 'batch_update',
        }, { headers })
        updated[i] = { ...updated[i], status: 'done' }
      } catch {
        updated[i] = { ...updated[i], status: 'error' }
      }
      setBatchItems([...updated])
    }

    setProcessing(false)
    const doneCount = updated.filter(i => i.status === 'done').length
    toast.success(`Batch done: ${doneCount}/${updated.length} items processed`)
  }

  const reasons = type === 'in' ? REASONS_IN : REASONS_OUT

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}>
        <h2 className="font-display font-bold text-white text-xl">Barcode Scanner</h2>
        <p className="text-muted text-sm">
          Scan a product's barcode or QR code — or type the product code manually — to update stock instantly
        </p>
      </motion.div>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 rounded-xl border border-border w-fit" style={{ background:'var(--card)' }}>
        {[
          { id:'single', label:'Single Scan', icon:ScanLine },
          { id:'batch',  label:'Batch Mode',  icon:Package },
        ].map(({ id, label, icon:Icon }) => (
          <button key={id}
            onClick={() => setMode(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={mode === id
              ? { background:'rgba(126,255,212,0.1)', color:'#7effd4', border:'1px solid rgba(126,255,212,0.22)' }
              : { color:'var(--muted)' }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── SINGLE MODE ── */}
      {mode === 'single' && (
        <div className="grid lg:grid-cols-2 gap-5">

          {/* Scanner panel */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-semibold text-white text-sm">Scan or Enter Barcode</h3>

            {/* Camera activate button */}
            {!scannerActive && !scannedProduct && (
              <motion.button
                whileHover={{ borderColor:'rgba(126,255,212,0.4)' }}
                whileTap={{ scale:0.98 }}
                onClick={startCamera}
                className="w-full flex flex-col items-center gap-4 p-10 rounded-xl border-2 border-dashed transition-all"
                style={{ borderColor:'rgba(126,255,212,0.15)' }}
              >
                <motion.div
                  animate={{ y:[0,-4,0] }}
                  transition={{ duration:2, repeat:Infinity }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background:'rgba(126,255,212,0.08)', border:'1px solid rgba(126,255,212,0.18)' }}
                >
                  <Camera size={26} style={{ color:'#7effd4' }} />
                </motion.div>
                <div className="text-center">
                  <div className="text-white text-sm font-medium">Activate Camera</div>
                  <div className="text-muted text-xs mt-0.5">Point at any barcode or QR code</div>
                </div>
              </motion.button>
            )}

            {/* Active scanner */}
            {scannerActive && (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden"
                  style={{ border:'1px solid rgba(126,255,212,0.25)' }}>
                  <div id="qr-reader" className="w-full" />
                  {/* Scan line overlay */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                    <motion.div
                      animate={{ y:['0%','100%','0%'] }}
                      transition={{ duration:2.5, repeat:Infinity, ease:'easeInOut' }}
                      className="absolute left-0 right-0 h-0.5"
                      style={{ background:'linear-gradient(90deg, transparent, #7effd4, transparent)' }}
                    />
                  </div>
                </div>
                <button onClick={stopCamera}
                  className="btn-ghost w-full py-2 rounded-xl text-sm flex items-center justify-center gap-2">
                  <X size={14} /> Cancel
                </button>
              </div>
            )}

            {/* Manual entry — always visible */}
            <div>
              <label className="text-xs text-muted block mb-1.5">
                Enter product code or barcode manually
              </label>
              <div className="flex gap-2">
                <input
                  className="input-dark flex-1 rounded-xl px-4 py-2.5 text-sm font-mono"
                  placeholder="e.g. CTN001 or scan value..."
                  value={manualBarcode}
                  onChange={e => setManualBarcode(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && manualBarcode.trim()) {
                      lookupBarcode(manualBarcode)
                      setManualBarcode('')
                    }
                  }}
                />
                <button
                  onClick={() => { lookupBarcode(manualBarcode); setManualBarcode('') }}
                  disabled={!manualBarcode.trim() || lookingUp}
                  className="btn-primary px-4 rounded-xl text-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {lookingUp
                    ? <motion.div animate={{ rotate:360 }} transition={{ duration:0.6, repeat:Infinity, ease:'linear' }}><Loader size={13} /></motion.div>
                    : 'Lookup'
                  }
                </button>
              </div>
              <p className="text-xs text-muted mt-1.5">
                Tip: your product code (e.g. CTN001) works as the barcode
              </p>
            </div>
          </div>

          {/* Adjustment form */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-semibold text-white text-sm">Update Stock</h3>

            <AnimatePresence mode="wait">
              {!scannedProduct ? (
                <motion.div
                  key="empty"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  className="flex flex-col items-center gap-3 py-12 text-muted"
                >
                  <ScanLine size={36} className="opacity-20" />
                  <p className="text-sm">Scan or look up a product first</p>
                </motion.div>
              ) : (
                <motion.div
                  key="product"
                  initial={{ opacity:0, scale:0.97 }}
                  animate={{ opacity:1, scale:1 }}
                  exit={{ opacity:0, scale:0.97 }}
                  className="space-y-4"
                >
                  {/* Product card */}
                  <div className="p-4 rounded-xl"
                    style={{ background:'rgba(126,255,212,0.04)', border:'1px solid rgba(126,255,212,0.15)' }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-white text-sm">{scannedProduct.name}</p>
                        <p className="text-xs text-muted font-mono mt-0.5">
                          {scannedProduct.product_code} · {scannedProduct.category}
                        </p>
                        {scannedProduct.quantity <= scannedProduct.reorder_threshold && (
                          <p className="text-xs mt-1" style={{ color:'#f87171' }}>
                            ⚠ Below reorder threshold
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold text-2xl text-white">{scannedProduct.quantity}</p>
                        <p className="text-xs text-muted">{scannedProduct.unit} on hand</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setScannedProduct(null); setQty(1) }}
                      className="text-xs text-muted hover:text-white mt-2 transition-colors"
                    >
                      ← Scan different product
                    </button>
                  </div>

                  {/* Type toggle */}
                  <div className="flex gap-2">
                    {[
                      { v:'in',  l:'Stock In',  color:'#7effd4' },
                      { v:'out', l:'Stock Out', color:'#f87171' },
                    ].map(t => (
                      <button key={t.v}
                        onClick={() => setType(t.v)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={type === t.v
                          ? { background:`${t.color}12`, color:t.color, border:`1px solid ${t.color}28` }
                          : { border:'1px solid var(--border)', color:'var(--muted)' }}
                      >
                        {t.l}
                      </button>
                    ))}
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="text-xs text-muted block mb-1.5">Quantity</label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(q => Math.max(1, q-1))}
                        className="w-9 h-9 rounded-xl btn-ghost flex items-center justify-center">
                        <Minus size={14} />
                      </button>
                      <input type="number" min="1"
                        className="input-dark flex-1 rounded-xl px-4 py-2 text-sm text-center font-mono font-bold text-lg"
                        value={qty}
                        onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                      <button onClick={() => setQty(q => q+1)}
                        className="w-9 h-9 rounded-xl btn-ghost flex items-center justify-center">
                        <Plus size={14} />
                      </button>
                    </div>
                    {type === 'out' && (
                      <p className="text-xs text-muted mt-1.5 font-mono">
                        After:{' '}
                        <span className={qty > scannedProduct.quantity ? 'text-red-400' : 'text-white'}>
                          {Math.max(0, scannedProduct.quantity - qty)} {scannedProduct.unit}
                        </span>
                      </p>
                    )}
                    {type === 'in' && (
                      <p className="text-xs text-muted mt-1.5 font-mono">
                        After: <span className="text-green-400">{scannedProduct.quantity + qty} {scannedProduct.unit}</span>
                      </p>
                    )}
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="text-xs text-muted block mb-1.5">Reason</label>
                    <select className="input-dark w-full rounded-xl px-4 py-2.5 text-sm"
                      value={reason} onChange={e => setReason(e.target.value)}>
                      {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={submitAdjustment}
                    disabled={submitting || done}
                    className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed"
                    style={done
                      ? { background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.25)', color:'#4ade80' }
                      : { background:'rgba(126,255,212,0.12)', border:'1px solid rgba(126,255,212,0.25)', color:'#7effd4' }
                    }
                  >
                    {done ? (
                      <><CheckCircle size={15} /> Done!</>
                    ) : submitting ? (
                      <>
                        <motion.div animate={{ rotate:360 }} transition={{ duration:0.7, repeat:Infinity, ease:'linear' }}>
                          <Loader size={15} />
                        </motion.div>
                        Processing...
                      </>
                    ) : (
                      <><Zap size={15} /> Update Stock</>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── BATCH MODE ── */}
      {mode === 'batch' && (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-white text-sm">Batch Barcode Update</h3>
              <p className="text-muted text-xs mt-0.5">
                Add multiple product codes one by one — all processed as Stock In
              </p>
            </div>
            <span className="text-xs text-muted font-mono">{batchItems.length} items</span>
          </div>

          <div className="flex gap-2">
            <input
              className="input-dark flex-1 rounded-xl px-4 py-2.5 text-sm font-mono"
              placeholder="Type or scan barcode, press Enter..."
              value={batchInput}
              onChange={e => setBatchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addToBatch()}
              autoFocus
            />
            <button onClick={addToBatch}
              disabled={!batchInput.trim()}
              className="btn-primary px-4 rounded-xl text-sm disabled:opacity-50">
              Add
            </button>
          </div>

          {batchItems.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <ScanLine size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Add product codes above to build a batch</p>
              <p className="text-xs mt-1 opacity-60">Each item defaults to qty 1 — you can edit before processing</p>
            </div>
          ) : (
            <AnimatePresence>
              <div className="space-y-2">
                {batchItems.map((item, i) => (
                  <motion.div key={i}
                    initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-xl border"
                    style={
                      item.status === 'done'  ? { background:'rgba(74,222,128,0.06)', borderColor:'rgba(74,222,128,0.18)' } :
                      item.status === 'error' ? { background:'rgba(248,113,113,0.06)', borderColor:'rgba(248,113,113,0.18)' } :
                      { borderColor:'var(--border)', background:'rgba(255,255,255,0.02)' }
                    }
                  >
                    {item.status === 'done'
                      ? <CheckCircle size={14} style={{ color:'#4ade80', flexShrink:0 }} />
                      : item.status === 'error'
                      ? <AlertCircle size={14} style={{ color:'#f87171', flexShrink:0 }} />
                      : <div className="w-3.5 h-3.5 rounded-full border border-muted flex-shrink-0" />
                    }

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {item.product?.name || 'Product not found'}
                      </p>
                      <p className="text-xs text-muted font-mono">{item.barcode}</p>
                    </div>

                    <input type="number" min="1"
                      className="input-dark w-16 rounded-lg px-2 py-1.5 text-xs text-center font-mono"
                      value={item.qty}
                      onChange={e => setBatchItems(prev =>
                        prev.map((it, j) => j===i ? { ...it, qty: parseInt(e.target.value)||1 } : it)
                      )}
                      disabled={item.status !== 'pending'}
                    />

                    <button
                      onClick={() => setBatchItems(prev => prev.filter((_,j) => j!==i))}
                      className="text-muted hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}

          {batchItems.length > 0 && (
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted font-mono">
                {batchItems.filter(i=>i.status==='done').length} done ·{' '}
                {batchItems.filter(i=>i.status==='pending').length} pending ·{' '}
                {batchItems.filter(i=>i.status==='error').length} errors
              </span>
              <div className="flex gap-2">
                <button onClick={() => setBatchItems([])}
                  className="btn-ghost px-4 py-2 rounded-xl text-sm">
                  Clear
                </button>
                <button
                  onClick={processBatch}
                  disabled={processing || batchItems.every(i => i.status !== 'pending')}
                  className="btn-primary px-5 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <motion.div animate={{ rotate:360 }} transition={{ duration:0.7, repeat:Infinity, ease:'linear' }}>
                        <Loader size={13} />
                      </motion.div>
                      Processing...
                    </>
                  ) : (
                    <><CheckCircle size={13} /> Process All</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
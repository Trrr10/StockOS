import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Barcode, Printer, Download, Search, CheckCircle,
  Loader, RefreshCw, Package, ChevronDown, Grid, List,
  AlertCircle, X, SlidersHorizontal
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// ── Barcode formats supported by JsBarcode ──────────────────────────────────
const FORMATS = [
  { value: 'CODE128', label: 'Code 128 (recommended)' },
  { value: 'CODE39',  label: 'Code 39' },
  { value: 'EAN13',   label: 'EAN-13' },
  { value: 'EAN8',    label: 'EAN-8' },
  { value: 'UPC',     label: 'UPC-A' },
  { value: 'ITF14',   label: 'ITF-14' },
  { value: 'MSI',     label: 'MSI' },
  { value: 'pharmacode', label: 'Pharmacode' },
]

// ── Single barcode SVG rendered via JsBarcode ────────────────────────────────
function BarcodeDisplay({ value, format, showText, height, width }) {
  const ref = useRef(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!ref.current || !value) return
    setError(false)

    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        JsBarcode(ref.current, value, {
          format,
          lineColor: '#ffffff',
          background: 'transparent',
          width: width || 2,
          height: height || 60,
          displayValue: showText,
          fontOptions: 'bold',
          fontSize: 11,
          textMargin: 4,
          margin: 4,
        })
      } catch {
        setError(true)
      }
    }).catch(() => setError(true))
  }, [value, format, showText, height, width])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-1 py-4">
        <AlertCircle size={18} style={{ color: '#f87171' }} />
        <p className="text-xs" style={{ color: '#f87171' }}>
          Invalid value for {format}
        </p>
      </div>
    )
  }

  return <svg ref={ref} className="w-full" />
}

// ── Product row in the list ──────────────────────────────────────────────────
function ProductBarcodeCard({ product, selected, onToggle, format, showText, printing }) {
  const value = product.barcode || product.product_code
  const cardRef = useRef(null)

  function downloadBarcode() {
    // Always regenerate a fresh SVG with black-on-white for scanning compatibility.
    // DO NOT clone the screen SVG — it has white lines which become invisible on white bg.
    import('jsbarcode').then(({ default: JsBarcode }) => {
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      try {
        JsBarcode(tempSvg, value, {
          format,
          lineColor: '#000000',   // black bars — scannable
          background: '#ffffff',  // white background
          width: 3,
          height: 80,
          displayValue: showText,
          fontSize: 13,
          margin: 12,
        })
      } catch {
        toast.error('Could not generate barcode for this value')
        return
      }

      const svgString = new XMLSerializer().serializeToString(tempSvg)
      const canvas = document.createElement('canvas')
      const img = new Image()
      img.onload = () => {
        canvas.width  = img.naturalWidth  || 400
        canvas.height = img.naturalHeight || 150
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        const link = document.createElement('a')
        link.download = `barcode-${product.product_code}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        toast.success(`Downloaded barcode for ${product.name}`)
      }
      img.onerror = () => toast.error('Image render failed')
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString)
    })
  }

  return (
    <motion.div
      layout
      ref={cardRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="rounded-2xl border transition-all overflow-hidden"
      style={selected
        ? { borderColor: 'rgba(126,255,212,0.35)', background: 'rgba(126,255,212,0.05)' }
        : { borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }
      }
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(product.id)}
          className="w-5 h-5 rounded-md flex-shrink-0 border transition-all"
          style={selected
            ? { background: 'rgba(126,255,212,0.2)', borderColor: '#7effd4' }
            : { borderColor: 'var(--border)' }
          }
        >
          {selected && <CheckCircle size={14} style={{ color: '#7effd4' }} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{product.name}</p>
          <p className="text-xs text-muted font-mono">
            {product.product_code}
            {product.category ? ` · ${product.category}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={downloadBarcode}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5 text-muted hover:text-white"
            title="Download PNG"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Barcode */}
      <div className="px-4 pb-4">
        <div
          className="rounded-xl p-3 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)' }}
        >
          <BarcodeDisplay
            value={value}
            format={format}
            showText={showText}
          />
        </div>
        <p className="text-center text-xs text-muted font-mono mt-1.5">{value}</p>
      </div>
    </motion.div>
  )
}

// ── Print preview overlay ────────────────────────────────────────────────────
function PrintPreview({ products, format, showText, labelsPerRow, onClose }) {
  function handlePrint() {
    window.print()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        className="glass-card rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        style={{ border: '1px solid rgba(126,255,212,0.2)' }}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-display font-semibold text-white">Print Preview</h3>
            <p className="text-muted text-xs mt-0.5">{products.length} barcode(s) · {labelsPerRow} per row</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-primary px-5 py-2 rounded-xl text-sm flex items-center gap-2"
            >
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="btn-ghost p-2 rounded-xl">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {/* Print-only stylesheet injected inline */}
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #barcode-print-area, #barcode-print-area * { visibility: visible !important; }
              #barcode-print-area { position: fixed; inset: 0; padding: 16px; background: white; }
              .barcode-label { break-inside: avoid; }
            }
          `}</style>

          <div
            id="barcode-print-area"
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${labelsPerRow}, 1fr)` }}
          >
            {products.map(p => (
              <div
                key={p.id}
                className="barcode-label p-3 rounded-xl border text-center"
                style={{ borderColor: '#ddd', background: 'white' }}
              >
                <p className="text-xs font-bold text-black mb-1 truncate">{p.name}</p>
                {/* White-on-black won't print well; use dark barcode for print */}
                <div style={{ background: 'white', padding: '4px', borderRadius: '6px' }}>
                  <PrintBarcode value={p.barcode || p.product_code} format={format} showText={showText} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Dark barcode for print (black lines on white)
function PrintBarcode({ value, format, showText }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || !value) return
    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        JsBarcode(ref.current, value, {
          format,
          lineColor: '#000000',
          background: '#ffffff',
          width: 2,
          height: 50,
          displayValue: showText,
          fontSize: 10,
          margin: 2,
        })
      } catch {}
    })
  }, [value, format, showText])

  return <svg ref={ref} style={{ width: '100%' }} />
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BarcodeGenerator() {
  const [products, setProducts]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [category, setCategory]       = useState('all')
  const [categories, setCategories]   = useState([])
  const [selected, setSelected]       = useState(new Set())
  const [format, setFormat]           = useState('CODE128')
  const [showText, setShowText]       = useState(true)
  const [labelsPerRow, setLabelsPerRow] = useState(3)
  const [showPrint, setShowPrint]     = useState(false)
  const [viewMode, setViewMode]       = useState('grid') // grid | list
  const [showSettings, setShowSettings] = useState(false)
  const [savingBarcodes, setSavingBarcodes] = useState(false)

  // Load products from Supabase
  const loadProducts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, product_code, barcode, category, quantity, unit')
      .order('name')

    if (error) {
      toast.error('Failed to load products')
    } else {
      setProducts(data || [])
      const cats = [...new Set((data || []).map(p => p.category).filter(Boolean))]
      setCategories(cats)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  // Auto-assign barcodes for products that don't have one (use product_code)
  async function autoAssignBarcodes() {
    const missing = products.filter(p => !p.barcode)
    if (!missing.length) {
      toast('All products already have barcodes!', { icon: '✅' })
      return
    }

    setSavingBarcodes(true)
    let successCount = 0

    for (const p of missing) {
      const { error } = await supabase
        .from('products')
        .update({ barcode: p.product_code })
        .eq('id', p.id)

      if (!error) successCount++
    }

    setSavingBarcodes(false)
    toast.success(`Assigned barcodes to ${successCount} products`)
    loadProducts()
  }

  // Filtered products
  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q
      || p.name.toLowerCase().includes(q)
      || p.product_code.toLowerCase().includes(q)
      || (p.barcode || '').toLowerCase().includes(q)
    const matchCat = category === 'all' || p.category === category
    return matchSearch && matchCat
  })

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map(p => p.id)))
  }
  function clearSelection() {
    setSelected(new Set())
  }

  const selectedProducts = products.filter(p => selected.has(p.id))
  const missingBarcodeCount = products.filter(p => !p.barcode).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display font-bold text-white text-xl">Barcode Generator</h2>
        <p className="text-muted text-sm">
          Generate, preview, and print barcodes for all your products
        </p>
      </motion.div>

      {/* Auto-assign banner */}
      {missingBarcodeCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
            <div>
              <p className="text-sm font-medium text-white">
                {missingBarcodeCount} product{missingBarcodeCount > 1 ? 's' : ''} missing a barcode
              </p>
              <p className="text-xs text-muted mt-0.5">
                Auto-assign uses the product code as the barcode value
              </p>
            </div>
          </div>
          <button
            onClick={autoAssignBarcodes}
            disabled={savingBarcodes}
            className="btn-primary px-4 py-2 rounded-xl text-sm flex items-center gap-2 disabled:opacity-60 flex-shrink-0"
          >
            {savingBarcodes
              ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}><Loader size={13} /></motion.div> Saving...</>
              : <><Barcode size={13} /> Auto-Assign</>
            }
          </button>
        </motion.div>
      )}

      {/* Toolbar */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input-dark w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="relative">
              <select
                className="input-dark pl-4 pr-8 py-2.5 rounded-xl text-sm appearance-none"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>
          )}

          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(s => !s)}
            className="btn-ghost px-3 py-2 rounded-xl text-sm flex items-center gap-2"
            style={showSettings ? { color: '#7effd4' } : {}}
          >
            <SlidersHorizontal size={14} /> Settings
          </button>

          {/* View toggle */}
          <div className="flex gap-1 p-1 rounded-xl border border-border" style={{ background: 'var(--card)' }}>
            {[{ id: 'grid', Icon: Grid }, { id: 'list', Icon: List }].map(({ id, Icon }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className="p-2 rounded-lg transition-all"
                style={viewMode === id
                  ? { background: 'rgba(126,255,212,0.1)', color: '#7effd4' }
                  : { color: 'var(--muted)' }
                }
              >
                <Icon size={14} />
              </button>
            ))}
          </div>

          <button onClick={loadProducts} className="btn-ghost p-2.5 rounded-xl">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Barcode settings */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-border grid sm:grid-cols-3 gap-4">
                {/* Format */}
                <div>
                  <label className="text-xs text-muted block mb-1.5">Barcode Format</label>
                  <div className="relative">
                    <select
                      className="input-dark w-full pl-3 pr-8 py-2 rounded-xl text-sm appearance-none"
                      value={format}
                      onChange={e => setFormat(e.target.value)}
                    >
                      {FORMATS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                  </div>
                </div>

                {/* Show text */}
                <div>
                  <label className="text-xs text-muted block mb-1.5">Show Text Below</label>
                  <div className="flex gap-2">
                    {[{ v: true, l: 'Show' }, { v: false, l: 'Hide' }].map(opt => (
                      <button
                        key={String(opt.v)}
                        onClick={() => setShowText(opt.v)}
                        className="flex-1 py-2 rounded-xl text-sm transition-all"
                        style={showText === opt.v
                          ? { background: 'rgba(126,255,212,0.1)', color: '#7effd4', border: '1px solid rgba(126,255,212,0.25)' }
                          : { border: '1px solid var(--border)', color: 'var(--muted)' }
                        }
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Labels per row */}
                <div>
                  <label className="text-xs text-muted block mb-1.5">Labels Per Row (Print)</label>
                  <div className="flex gap-2">
                    {[2, 3, 4].map(n => (
                      <button
                        key={n}
                        onClick={() => setLabelsPerRow(n)}
                        className="flex-1 py-2 rounded-xl text-sm transition-all"
                        style={labelsPerRow === n
                          ? { background: 'rgba(126,255,212,0.1)', color: '#7effd4', border: '1px solid rgba(126,255,212,0.25)' }
                          : { border: '1px solid var(--border)', color: 'var(--muted)' }
                        }
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selection bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between p-3 px-5 rounded-xl"
            style={{ background: 'rgba(126,255,212,0.08)', border: '1px solid rgba(126,255,212,0.2)' }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle size={15} style={{ color: '#7effd4' }} />
              <span className="text-sm text-white font-medium">{selected.size} selected</span>
              <button onClick={clearSelection} className="text-xs text-muted hover:text-white transition-colors">
                Clear
              </button>
            </div>
            <button
              onClick={() => setShowPrint(true)}
              className="btn-primary px-5 py-2 rounded-xl text-sm flex items-center gap-2"
            >
              <Printer size={13} /> Print Selected
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Select all / count bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          {search || category !== 'all' ? ' (filtered)' : ''}
        </p>
        <div className="flex items-center gap-3">
          <button onClick={selectAll} className="text-xs text-muted hover:text-white transition-colors">
            Select all
          </button>
          <button
            onClick={() => { selectAll(); setTimeout(() => setShowPrint(true), 50) }}
            className="btn-ghost px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
          >
            <Printer size={12} /> Print All
          </button>
        </div>
      </div>

      {/* Product grid / list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <Loader size={20} />
          </motion.div>
          <span className="text-sm">Loading products...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <Package size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No products found</p>
          {(search || category !== 'all') && (
            <button
              onClick={() => { setSearch(''); setCategory('all') }}
              className="text-xs text-muted hover:text-white mt-2 transition-colors underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <motion.div
          layout
          className={viewMode === 'grid'
            ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-3'
          }
        >
          <AnimatePresence>
            {filtered.map(product => (
              <ProductBarcodeCard
                key={product.id}
                product={product}
                selected={selected.has(product.id)}
                onToggle={toggleSelect}
                format={format}
                showText={showText}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Print preview modal */}
      <AnimatePresence>
        {showPrint && (
          <PrintPreview
            products={selectedProducts}
            format={format}
            showText={showText}
            labelsPerRow={labelsPerRow}
            onClose={() => setShowPrint(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
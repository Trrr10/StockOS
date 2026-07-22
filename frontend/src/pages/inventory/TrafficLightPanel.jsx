
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, RefreshCw, TrendingDown, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STATUS_CONFIG = {
  red:   { label: 'Critical',  bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', dot: '#f87171', text: '#f87171' },
  amber: { label: 'Low',       bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)',  dot: '#fbbf24', text: '#fbbf24' },
  green: { label: 'Healthy',   bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)',  dot: '#4ade80', text: '#4ade80' },
}

function getStatus(qty, reserved, threshold) {
  const available = (qty || 0) - (reserved || 0)
  const ratio = threshold > 0 ? available / threshold : 2
  if (ratio <= 1)   return { status: 'red',   ratio: +ratio.toFixed(2), available }
  if (ratio <= 1.5) return { status: 'amber', ratio: +ratio.toFixed(2), available }
  return               { status: 'green', ratio: +ratio.toFixed(2), available }
}

function StockBar({ ratio }) {
  const pct   = Math.min((ratio / 1.5) * 100, 100)
  const color = ratio <= 1 ? '#f87171' : ratio <= 1.5 ? '#fbbf24' : '#4ade80'
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ height: '100%', background: color, borderRadius: 9999 }}
      />
    </div>
  )
}

export default function TrafficLightPanel() {
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [search, setSearch]     = useState('')
  const [sortBy, setSortBy]     = useState('ratio')
  const [sortAsc, setSortAsc]   = useState(true)
  const [expanded, setExpanded] = useState(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('id, name, product_code, category, quantity, quantity_reserved, reorder_threshold, unit_price, unit, barcode')
      .order('name')
    if (!error && data) {
      setProducts(data.map(p => ({
        ...p,
        ...getStatus(p.quantity, p.quantity_reserved, p.reorder_threshold),
      })))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const counts = {
    red:   products.filter(p => p.status === 'red').length,
    amber: products.filter(p => p.status === 'amber').length,
    green: products.filter(p => p.status === 'green').length,
  }

  const filtered = products
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.product_code || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const va = sortBy === 'name' ? a.name : sortBy === 'quantity' ? a.quantity : a.ratio
      const vb = sortBy === 'name' ? b.name : sortBy === 'quantity' ? b.quantity : b.ratio
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ?  1 : -1
      return 0
    })

  function toggleSort(col) {
    if (sortBy === col) setSortAsc(v => !v)
    else { setSortBy(col); setSortAsc(true) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-white text-xl">Stock Health</h2>
          <p className="text-muted text-sm">Real-time traffic light view across all products</p>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={load} className="btn-ghost p-2 rounded-xl">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </motion.button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'red',   label: 'Critical',    icon: TrendingDown,  val: counts.red },
          { key: 'amber', label: 'Approaching', icon: AlertTriangle, val: counts.amber },
          { key: 'green', label: 'Healthy',     icon: CheckCircle2,  val: counts.green },
        ].map(({ key, label, icon: Icon, val }) => {
          const cfg = STATUS_CONFIG[key]
          return (
            <motion.button key={key}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setFilter(f => f === key ? 'all' : key)}
              className="glass-card rounded-2xl p-4 text-left transition-all"
              style={filter === key ? { border: `1px solid ${cfg.border}`, background: cfg.bg } : {}}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                <Icon size={14} style={{ color: cfg.dot }} />
              </div>
              <p className="font-display font-bold text-2xl text-white">{val}</p>
              <p className="text-xs text-muted mt-0.5">{label}</p>
            </motion.button>
          )
        })}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input-dark w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 p-1 rounded-xl border border-border" style={{ background: 'var(--card)' }}>
          {['all', 'red', 'amber', 'green'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
              style={filter === f ? { background: 'rgba(126,255,212,0.12)', color: '#7effd4' } : { color: 'var(--muted)' }}>
              {f === 'all' ? 'All' : STATUS_CONFIG[f].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="grid px-4 py-3 border-b border-border text-xs text-muted font-medium"
          style={{ gridTemplateColumns: '16px 1fr 80px 80px 80px 90px 130px' }}>
          <div />
          <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-white transition-colors text-left">
            Product {sortBy === 'name' && (sortAsc ? '↑' : '↓')}
          </button>
          <button onClick={() => toggleSort('quantity')} className="hover:text-white transition-colors text-left">
            On hand {sortBy === 'quantity' && (sortAsc ? '↑' : '↓')}
          </button>
          <div>Reserved</div>
          <div>Available</div>
          <div>Threshold</div>
          <button onClick={() => toggleSort('ratio')} className="hover:text-white transition-colors text-left">
            Health {sortBy === 'ratio' && (sortAsc ? '↑' : '↓')}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: '#7effd4', borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted text-sm">No products match your filter</div>
        ) : (
          filtered.map((p, i) => {
            const cfg    = STATUS_CONFIG[p.status]
            const isOpen = expanded === p.id
            return (
              <div key={p.id}>
                <div
                  className="grid px-4 py-3 border-b border-border items-center cursor-pointer hover:bg-white/[0.02] transition-colors"
                  style={{ gridTemplateColumns: '16px 1fr 80px 80px 80px 90px 130px' }}
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                  <div>
                    <p className="text-sm font-medium text-white truncate">{p.name}</p>
                    <p className="text-xs text-muted font-mono">{p.product_code}</p>
                  </div>
                  <p className="text-sm text-white font-mono">{p.quantity}</p>
                  <p className="text-sm text-muted font-mono">{p.quantity_reserved || 0}</p>
                  <p className="text-sm font-mono" style={{ color: cfg.text }}>{p.available}</p>
                  <p className="text-sm text-muted font-mono">{p.reorder_threshold}</p>
                  <div className="space-y-1 pr-2">
                    <StockBar ratio={p.ratio} />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono" style={{ color: cfg.text }}>{p.ratio}x</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: cfg.bg, color: cfg.text }}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-b border-border"
                      style={{ background: 'rgba(255,255,255,0.01)' }}
                    >
                      <div className="px-8 py-4 grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted text-xs mb-0.5">Category</p>
                          <p className="text-white">{p.category}</p>
                        </div>
                        <div>
                          <p className="text-muted text-xs mb-0.5">Unit</p>
                          <p className="text-white">{p.unit}</p>
                        </div>
                        <div>
                          <p className="text-muted text-xs mb-0.5">Unit price</p>
                          <p className="text-white">₹{p.unit_price?.toLocaleString() ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted text-xs mb-0.5">Stock value</p>
                          <p className="text-white">₹{((p.quantity || 0) * (p.unit_price || 0)).toLocaleString()}</p>
                        </div>
                        {p.status !== 'green' && (
                          <div className="col-span-4 p-3 rounded-xl text-xs"
                            style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}>
                            {p.status === 'red'
                              ? `⚠ Stock is at or below reorder threshold (${p.reorder_threshold} ${p.unit}). Raise a purchase order immediately.`
                              : `Stock is within 1.5× of threshold. Consider reordering soon.`}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClipboardList, ArrowDown, ArrowUp, Minus, Search, Filter, RefreshCw, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDistanceToNow, format } from 'date-fns'

const TYPE_META = {
  in:               { label:'Stock In',       color:'#4ade80', bg:'rgba(74,222,128,0.08)',  Icon:ArrowUp },
  out:              { label:'Stock Out',      color:'#f87171', bg:'rgba(248,113,113,0.08)', Icon:ArrowDown },
  manual:           { label:'Manual',         color:'#60a5fa', bg:'rgba(96,165,250,0.08)',  Icon:Minus },
  purchase_received:{ label:'Purchase',       color:'#4ade80', bg:'rgba(74,222,128,0.08)',  Icon:ArrowUp },
  barcode_scan:     { label:'Barcode Scan',   color:'#7effd4', bg:'rgba(126,255,212,0.08)',Icon:ArrowUp },
  batch_update:     { label:'Batch',          color:'#a78bfa', bg:'rgba(167,139,250,0.08)',Icon:Minus },
  production_input: { label:'Production',     color:'#fbbf24', bg:'rgba(251,191,36,0.08)', Icon:ArrowDown },
  wastage:          { label:'Wastage',        color:'#f87171', bg:'rgba(248,113,113,0.08)',Icon:ArrowDown },
}

export default function AuditTrailPage() {
  const [movements, setMovements]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage]             = useState(0)
  const [total, setTotal]           = useState(0)
  const [newEntries, setNewEntries] = useState(0)
  const PAGE_SIZE = 30

  useEffect(() => { loadMovements() }, [page, typeFilter])

  // Real-time: highlight new entries
  useEffect(() => {
    const sub = supabase.channel('audit-rt')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'stock_movements' }, payload => {
        setNewEntries(n => n + 1)
        if (page === 0) {
          setMovements(prev => [{ ...payload.new, _new: true }, ...prev.slice(0, PAGE_SIZE - 1)])
        }
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [page])

  async function loadMovements() {
    setLoading(true)
    const query = supabase
      .from('stock_movements')
      .select('*, products(name, product_code), profiles(full_name)', { count:'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (typeFilter !== 'all') query.eq('type', typeFilter)

    const { data, count } = await query
    setMovements(data || [])
    setTotal(count || 0)
    setLoading(false)
    setNewEntries(0)
  }

  const filtered = movements.filter(m => {
    if (!search) return true
    return (
      m.products?.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.reason?.toLowerCase().includes(search.toLowerCase()) ||
      m.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
    )
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
        className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-white text-xl">Audit Trail</h2>
          <p className="text-muted text-sm">Every stock change — immutable record of who did what and when</p>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {newEntries > 0 && (
              <motion.div
                initial={{ scale:0, opacity:0 }}
                animate={{ scale:1, opacity:1 }}
                exit={{ scale:0, opacity:0 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background:'rgba(126,255,212,0.1)', color:'#7effd4', border:'1px solid rgba(126,255,212,0.25)' }}
              >
                <motion.div animate={{ scale:[1,1.3,1] }} transition={{ duration:1, repeat:Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-green-400" />
                {newEntries} new
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
            onClick={() => loadMovements()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl btn-ghost text-sm">
            <RefreshCw size={13} /> Refresh
          </motion.button>
          <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl btn-ghost text-sm">
            <Download size={13} /> Export
          </motion.button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.06 }}
        className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input className="input-dark w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
            placeholder="Search product, reason, user..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl border border-border" style={{ background:'var(--card)' }}>
          {['all','in','out'].map(f => (
            <motion.button key={f} whileTap={{ scale:0.95 }}
              onClick={() => { setTypeFilter(f); setPage(0) }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
              style={typeFilter === f
                ? { background:'rgba(126,255,212,0.12)', color:'#7effd4', border:'1px solid rgba(126,255,212,0.25)' }
                : { color:'var(--muted)' }}
            >
              {f === 'all' ? `All (${total})` : f === 'in' ? '↑ In' : '↓ Out'}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Timeline */}
      <motion.div
        initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
        className="glass-card rounded-2xl overflow-hidden"
      >
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_,i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            <AnimatePresence>
              {filtered.map((m, i) => {
                const meta = TYPE_META[m.adjustment_type] || TYPE_META[m.type] || TYPE_META.manual
                const IconComp = m.type === 'in' ? ArrowUp : ArrowDown
                const isNew = m._new

                return (
                  <motion.div
                    key={m.id}
                    initial={isNew ? { backgroundColor:'rgba(126,255,212,0.08)', x:0 } : { opacity:0, y:4 }}
                    animate={{ opacity:1, y:0, backgroundColor:'transparent', x:0 }}
                    transition={isNew ? { duration:2 } : { delay: Math.min(i * 0.025, 0.3) }}
                    whileHover={{ backgroundColor:'rgba(255,255,255,0.02)' }}
                    className="flex items-start gap-4 px-5 py-4 transition-colors cursor-default"
                  >
                    {/* Icon */}
                    <motion.div
                      whileHover={{ scale:1.08 }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: meta.bg, border:`1px solid ${meta.color}20` }}
                    >
                      <IconComp size={14} style={{ color: meta.color }} />
                    </motion.div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white text-sm">
                          {m.products?.name || 'Unknown Product'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md font-mono"
                          style={{ background: meta.bg, color: meta.color, border:`1px solid ${meta.color}20` }}>
                          {meta.label}
                        </span>
                        {isNew && (
                          <motion.span
                            initial={{ scale:0 }} animate={{ scale:1 }}
                            className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background:'rgba(126,255,212,0.15)', color:'#7effd4', border:'1px solid rgba(126,255,212,0.3)' }}
                          >
                            NEW
                          </motion.span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5 truncate">{m.reason}</p>
                      {m.notes && <p className="text-xs text-muted/60 mt-0.5 truncate italic">{m.notes}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted/60 font-mono">
                        {m.profiles?.full_name && <span>by {m.profiles.full_name}</span>}
                        <span>·</span>
                        <span title={format(new Date(m.created_at), 'PPpp')}>
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix:true })}
                        </span>
                        <span>·</span>
                        <span>{format(new Date(m.created_at), 'MMM d, HH:mm')}</span>
                        {m.products?.product_code && (
                          <><span>·</span><span style={{ color:'rgba(126,255,212,0.5)' }}>{m.products.product_code}</span></>
                        )}
                      </div>
                    </div>

                    {/* Delta */}
                    <div className="text-right flex-shrink-0">
                      <motion.div
                        initial={{ scale:1.2 }}
                        animate={{ scale:1 }}
                        className="font-mono font-bold text-sm"
                        style={{ color: m.type === 'in' ? '#4ade80' : '#f87171' }}
                      >
                        {m.type === 'in' ? '+' : '-'}{m.quantity}
                      </motion.div>
                      <div className="font-mono text-xs text-muted mt-0.5">
                        {m.quantity_before} → {m.quantity_after}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {filtered.length === 0 && !loading && (
              <div className="text-center py-16 text-muted">
                <ClipboardList size={36} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">No audit entries found</p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
          <span className="text-xs text-muted font-mono">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} entries
          </span>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg btn-ghost text-xs disabled:opacity-30"
            >
              ← Prev
            </motion.button>
            <span className="text-xs text-muted font-mono">{page + 1} / {Math.max(totalPages, 1)}</span>
            <motion.button
              whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }}
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg btn-ghost text-xs disabled:opacity-30"
            >
              Next →
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
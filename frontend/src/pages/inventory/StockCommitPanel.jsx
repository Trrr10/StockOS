// src/components/inventory/StockCommitPanel.jsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, CheckCircle, XCircle, AlertTriangle, RefreshCw, Package, ChevronDown, ChevronUp, Loader } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import api from '../../lib/supabase'
import toast from 'react-hot-toast'

const STATUS_LABELS = {
  pending:         { label: 'Pending',       color: '#94a3b8' },
  confirmed:       { label: 'Confirmed',     color: '#fbbf24' },
  stock_conflict:  { label: 'Conflict',      color: '#f87171' },
  stock_committed: { label: 'Committed',     color: '#4ade80' },
}

export default function StockCommitPanel() {
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState(null)
  const [committing, setCommitting] = useState(null)

  async function load() {
    setLoading(true)
    // Fetch orders that need inventory manager attention
    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        id, status, customer_name, created_at,
        sales_order_items (
          quantity,
          products ( id, name, product_code, quantity, quantity_reserved, unit )
        )
      `)
      .in('status', ['pending', 'confirmed', 'stock_conflict'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) setOrders(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function commit(orderId) {
    setCommitting(orderId)
    try {
      await api.post('/api/stock/commit', { order_id: orderId })
      toast.success('Stock committed and reserved')
      load()
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (detail?.conflicts) {
        toast.error(`Insufficient: ${detail.conflicts.map(c => c.product_name).join(', ')}`)
      } else {
        toast.error(err.message || 'Commit failed')
      }
      load()
    }
    setCommitting(null)
  }

  // Enrich items with availability check
  function enrichItems(items = []) {
    return items.map(item => {
      const p         = item.products || {}
      const available = (p.quantity || 0) - (p.quantity_reserved || 0)
      return { ...item, available, sufficient: available >= item.quantity }
    })
  }

  const pendingCount  = orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length
  const conflictCount = orders.filter(o => o.status === 'stock_conflict').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-white text-xl">Stock Commitment</h2>
          <p className="text-muted text-sm">Reserve stock for confirmed sales orders</p>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={load} className="btn-ghost p-2 rounded-xl">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </motion.button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Awaiting commit', val: pendingCount,  color: '#fbbf24' },
          { label: 'Conflicts',       val: conflictCount, color: '#f87171' },
          { label: 'Total open',      val: orders.length, color: '#7effd4' },
        ].map(({ label, val, color }) => (
          <div key={label} className="glass-card rounded-2xl p-4">
            <p className="text-2xl font-display font-bold" style={{ color }}>{val}</p>
            <p className="text-xs text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {conflictCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}
          >
            <AlertTriangle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-sm font-medium" style={{ color: '#f87171' }}>
                {conflictCount} order{conflictCount > 1 ? 's' : ''} with stock conflicts
              </p>
              <p className="text-xs text-muted mt-0.5">
                Hard-blocked from proceeding until stock is resolved
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: '#7effd4', borderTopColor: 'transparent' }} />
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-16 text-muted">
          <CheckCircle size={36} className="opacity-20 mb-3" style={{ color: '#4ade80' }} />
          <p className="text-sm font-medium text-white">No orders awaiting commit</p>
          <p className="text-xs mt-0.5">All orders are processed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => {
            const isOpen      = expanded === order.id
            const isConflict  = order.status === 'stock_conflict'
            const items       = enrichItems(order.sales_order_items)
            const allOk       = items.every(it => it.sufficient)
            const statusCfg   = STATUS_LABELS[order.status] || STATUS_LABELS.pending

            return (
              <motion.div key={order.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card rounded-2xl overflow-hidden"
                style={isConflict ? { border: '1px solid rgba(248,113,113,0.3)' } : {}}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(126,255,212,0.08)', border: '1px solid rgba(126,255,212,0.15)' }}>
                    <Package size={16} style={{ color: '#7effd4' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white font-mono">
                        #{order.id?.slice(0, 8).toUpperCase()}
                      </p>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${statusCfg.color}15`, color: statusCfg.color, border: `1px solid ${statusCfg.color}30` }}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {order.customer_name || 'Unknown customer'} · {items.length} item{items.length !== 1 ? 's' : ''} · {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={e => { e.stopPropagation(); commit(order.id) }}
                      disabled={committing === order.id || !allOk}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                      style={allOk
                        ? { background: '#7effd4', color: '#07080f' }
                        : { background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                    >
                      {committing === order.id
                        ? <><Loader size={11} className="animate-spin" /> Committing...</>
                        : allOk
                        ? <><Lock size={11} /> Commit Stock</>
                        : <><XCircle size={11} /> Insufficient</>}
                    </motion.button>
                    {isOpen ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-border"
                    >
                      <div className="p-4 space-y-2">
                        <p className="text-xs text-muted font-medium mb-3">Line items</p>
                        {items.map((item, j) => {
                          const p = item.products || {}
                          return (
                            <div key={j} className="flex items-center gap-3 p-3 rounded-xl"
                              style={{
                                background: item.sufficient ? 'rgba(74,222,128,0.04)' : 'rgba(248,113,113,0.06)',
                                border: `1px solid ${item.sufficient ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.2)'}`,
                              }}
                            >
                              {item.sufficient
                                ? <CheckCircle size={14} style={{ color: '#4ade80', flexShrink: 0 }} />
                                : <XCircle    size={14} style={{ color: '#f87171', flexShrink: 0 }} />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{p.name}</p>
                                <p className="text-xs text-muted font-mono">{p.product_code}</p>
                              </div>
                              <div className="text-right text-xs flex-shrink-0">
                                <p className="text-white font-mono">Need: {item.quantity} {p.unit}</p>
                                <p style={{ color: item.sufficient ? '#4ade80' : '#f87171' }}>
                                  Available: {item.available} {p.unit}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                        {!allOk && (
                          <div className="p-3 rounded-xl text-xs mt-2"
                            style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                            Hard-blocked — raise a purchase order or adjust quantities first.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
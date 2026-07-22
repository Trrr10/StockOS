// src/components/inventory/ReorderAlerts.jsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, RefreshCw, ShoppingCart, AlertTriangle, Loader, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import api from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ReorderAlerts() {
  const [alerts, setAlerts]           = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [aiLoading, setAiLoading]     = useState(false)

  async function loadAlerts() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('id, name, quantity, quantity_reserved, reorder_threshold, unit, preferred_supplier, unit_price')
      .order('name')
    if (data) {
      const enriched = data.map(p => {
        const available = (p.quantity || 0) - (p.quantity_reserved || 0)
        const ratio     = p.reorder_threshold > 0 ? available / p.reorder_threshold : 2
        return { ...p, available, ratio: +ratio.toFixed(2), status: ratio <= 1 ? 'red' : ratio <= 1.5 ? 'amber' : 'green' }
      }).filter(p => p.status !== 'green')
      setAlerts(enriched)
    }
    setLoading(false)
  }

  async function fetchSuggestions() {
    setAiLoading(true)
    try {
      const { data } = await api.post('/api/ai/reorder-suggestions', {})
      setSuggestions(data.suggestions || [])
    } catch {
      toast.error('Could not fetch AI suggestions')
    }
    setAiLoading(false)
  }

  useEffect(() => { loadAlerts(); fetchSuggestions() }, [])

  const criticalCount = alerts.filter(a => a.status === 'red').length
  const lowCount      = alerts.filter(a => a.status === 'amber').length

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <AlertTriangle size={15} style={{ color: '#f87171' }} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-white text-sm">Reorder Alerts</h3>
            <p className="text-xs text-muted">{criticalCount} critical · {lowCount} approaching</p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => { loadAlerts(); fetchSuggestions() }}
          className="btn-ghost p-2 rounded-xl">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </motion.button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: '#7effd4', borderTopColor: 'transparent' }} />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
            style={{ background: 'rgba(74,222,128,0.1)' }}>
            <ShoppingCart size={18} style={{ color: '#4ade80' }} />
          </div>
          <p className="text-sm text-white font-medium">All stock levels healthy</p>
          <p className="text-xs text-muted mt-0.5">No reorders needed right now</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {alerts.map((p, i) => {
            const isRed = p.status === 'red'
            return (
              <motion.div key={p.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{
                  background: isRed ? 'rgba(248,113,113,0.06)' : 'rgba(251,191,36,0.06)',
                  border: `1px solid ${isRed ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)'}`,
                }}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: isRed ? '#f87171' : '#fbbf24' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  <p className="text-xs text-muted">
                    {p.available} {p.unit} available · threshold {p.reorder_threshold}
                    {p.preferred_supplier ? ` · ${p.preferred_supplier}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-mono font-bold" style={{ color: isRed ? '#f87171' : '#fbbf24' }}>
                    {p.ratio}x
                  </p>
                  <p className="text-xs text-muted">{isRed ? 'critical' : 'low'}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* AI Suggestions */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} style={{ color: '#7effd4' }} />
          <p className="text-xs font-medium text-white">AI reorder suggestions</p>
          {aiLoading && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity }}>
              <Loader size={12} style={{ color: '#7effd4' }} />
            </motion.div>
          )}
        </div>
        {suggestions.length === 0 && !aiLoading
          ? <p className="text-xs text-muted">No suggestions yet</p>
          : suggestions.map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
              className="flex items-start gap-2 p-3 rounded-xl text-xs text-muted leading-relaxed mb-2"
              style={{ background: 'rgba(126,255,212,0.04)', border: '1px solid rgba(126,255,212,0.1)' }}
            >
              <ChevronRight size={12} style={{ color: '#7effd4', flexShrink: 0, marginTop: 1 }} />
              <span>{s}</span>
            </motion.div>
          ))}
      </div>
    </div>
  )
}
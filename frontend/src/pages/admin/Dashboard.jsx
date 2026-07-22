// Dashboard.jsx — Admin dashboard, styled to match ProductsPage design system

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, TrendingUp, ShoppingCart, Factory, AlertTriangle,
  CheckCircle2, RefreshCw, Megaphone, BarChart3, Zap,
  Circle, Info, Search, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import api from '../../lib/supabase'

// ─── Design tokens (mirrors ProductsPage) ────────────────────────────────────
const T = {
  bg:       '#12131f',
  surface:  'rgba(255,255,255,0.03)',
  border:   'rgba(255,255,255,0.07)',
  teal:     '#7effd4',
  tealDim:  'rgba(126,255,212,0.12)',
  tealBorder:'rgba(126,255,212,0.3)',
  muted:    'rgba(255,255,255,0.4)',
  blue:     '#60a5fa',
  blueDim:  'rgba(96,165,250,0.1)',
  blueBorder:'rgba(96,165,250,0.2)',
  amber:    '#fbbf24',
  amberDim: 'rgba(251,191,36,0.1)',
  amberBorder:'rgba(251,191,36,0.25)',
  rose:     '#f87171',
  roseDim:  'rgba(248,113,113,0.1)',
  roseBorder:'rgba(248,113,113,0.2)',
  emerald:  '#34d399',
  emeraldDim:'rgba(52,211,153,0.1)',
  emeraldBorder:'rgba(52,211,153,0.2)',
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent, accentDim, accentBorder, loading, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card rounded-2xl p-5 flex flex-col gap-3 group cursor-default"
      style={{ background: T.bg, border: `1px solid ${T.border}` }}
      whileHover={{ borderColor: accentBorder, transition: { duration: 0.15 } }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: T.muted }}>
          {label}
        </span>
        <motion.div
          whileHover={{ scale: 1.12, rotate: 5 }}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: accentDim, border: `1px solid ${accentBorder}` }}
        >
          <Icon size={15} style={{ color: accent }} />
        </motion.div>
      </div>
      {loading
        ? <div className="h-8 w-24 skeleton rounded-lg" />
        : <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-display font-bold text-2xl text-white"
          >
            {value}
          </motion.div>
      }
      {sub && <div className="text-xs" style={{ color: T.muted }}>{sub}</div>}
    </motion.div>
  )
}

// ─── Health badge ──────────────────────────────────────────────────────────
function HealthBadge({ status }) {
  const cfg = {
    green: { bg: T.emeraldDim, border: T.emeraldBorder, color: T.emerald, dot: T.emerald, pulse: false },
    amber: { bg: T.amberDim,   border: T.amberBorder,   color: T.amber,   dot: T.amber,   pulse: false },
    red:   { bg: T.roseDim,    border: T.roseBorder,    color: T.rose,    dot: T.rose,    pulse: true  },
  }
  const c = cfg[status] || cfg.green
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
    >
      <motion.span
        animate={c.pulse ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : {}}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{ background: c.dot }}
      />
      {status}
    </span>
  )
}

// ─── Anomaly Card ──────────────────────────────────────────────────────────
function AnomalyCard({ anomaly, index }) {
  const cfg = {
    critical: { bg: T.roseDim,   border: T.roseBorder,   icon: T.rose,    dot: T.rose    },
    warning:  { bg: T.amberDim,  border: T.amberBorder,  icon: T.amber,   dot: T.amber   },
    info:     { bg: T.blueDim,   border: T.blueBorder,   icon: T.blue,    dot: T.blue    },
  }
  const c = cfg[anomaly.type] || cfg.info
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="flex gap-3 p-3 rounded-xl"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
      whileHover={{ filter: 'brightness(1.1)' }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: c.bg, border: `1px solid ${c.border}` }}>
        <AlertTriangle size={14} style={{ color: c.icon }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <motion.span
            animate={{ scale: anomaly.type === 'critical' ? [1,1.3,1] : 1 }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: c.dot }}
          />
          <p className="text-xs font-display font-semibold text-white truncate">{anomaly.title}</p>
        </div>
        <p className="text-[11px] leading-snug" style={{ color: T.muted }}>{anomaly.description}</p>
        {anomaly.action && (
          <p className="text-[10px] font-mono mt-1" style={{ color: T.teal }}>→ {anomaly.action}</p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats,         setStats]         = useState(null)
  const [trafficLight,  setTrafficLight]  = useState([])
  const [anomalies,     setAnomalies]     = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [mfgBatches,    setMfgBatches]    = useState(0)
  const [loading,       setLoading]       = useState(true)
  const [anomalyLoad,   setAnomalyLoad]   = useState(true)
  const [tlSearch,      setTlSearch]      = useState('')
  const [tlFilter,      setTlFilter]      = useState('all')
  const [refreshing,    setRefreshing]    = useState(false)
  const [tlSortField,   setTlSortField]   = useState('name')
  const [tlSortAsc,     setTlSortAsc]     = useState(true)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [statsRes, tlRes, announcRes, batchRes] = await Promise.allSettled([
        api.get('/api/inventory/stats'),
        api.get('/api/inventory/traffic-light'),
        supabase.from('announcements').select('*').eq('is_pinned', true).order('created_at', { ascending: false }).limit(5),
        supabase.from('manufacturing_batches').select('id', { count: 'exact' }).eq('status', 'active'),
      ])
      if (statsRes.status   === 'fulfilled') setStats(statsRes.value.data)
      if (tlRes.status      === 'fulfilled') setTrafficLight(tlRes.value.data || [])
      if (announcRes.status === 'fulfilled') setAnnouncements(announcRes.value.data || [])
      if (batchRes.status   === 'fulfilled') setMfgBatches(batchRes.value.count || 0)
    } catch (e) {
      console.error('Dashboard load error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }

    setAnomalyLoad(true)
    try {
      const res = await api.get('/api/ai/anomalies')
      setAnomalies(res.data || [])
    } catch (e) {
      setAnomalies([])
    } finally {
      setAnomalyLoad(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleTlSort = (field) => {
    if (tlSortField === field) setTlSortAsc(a => !a)
    else { setTlSortField(field); setTlSortAsc(true) }
  }

  const tlFiltered = trafficLight
    .filter(p => {
      const matchSearch = !tlSearch || p.name.toLowerCase().includes(tlSearch.toLowerCase()) || (p.product_code || '').toLowerCase().includes(tlSearch.toLowerCase())
      const matchFilter = tlFilter === 'all' || p.health_status === tlFilter
      return matchSearch && matchFilter
    })
    .sort((a, b) => {
      const av = a[tlSortField] ?? ''
      const bv = b[tlSortField] ?? ''
      return tlSortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const tlCounts = {
    green: trafficLight.filter(p => p.health_status === 'green').length,
    amber: trafficLight.filter(p => p.health_status === 'amber').length,
    red:   trafficLight.filter(p => p.health_status === 'red').length,
  }

  const statCards = [
    { label: 'Total SKUs',     value: stats?.total_skus ?? '—',                               sub: 'products tracked',          icon: Package,     accent: T.teal,    accentDim: T.tealDim,    accentBorder: T.tealBorder    },
    { label: 'Stock Value',    value: stats ? `₹${(stats.total_value/1000).toFixed(1)}K` : '—', sub: 'current inventory value',   icon: TrendingUp,  accent: T.emerald, accentDim: T.emeraldDim, accentBorder: T.emeraldBorder },
    { label: 'Open Sales',     value: stats?.open_sales_orders ?? '—',                         sub: 'awaiting fulfilment',        icon: ShoppingCart,accent: T.blue,    accentDim: T.blueDim,    accentBorder: T.blueBorder    },
    { label: 'Open POs',       value: stats?.open_purchase_orders ?? '—',                      sub: 'in procurement',             icon: BarChart3,   accent: T.amber,   accentDim: T.amberDim,   accentBorder: T.amberBorder   },
    { label: 'Active Batches', value: mfgBatches,                                              sub: 'manufacturing in progress',  icon: Factory,     accent: T.rose,    accentDim: T.roseDim,    accentBorder: T.roseBorder    },
  ]

  const tlCols = [
    { label: 'Product', field: 'name' },
    { label: 'Code',    field: 'product_code' },
    { label: 'On Hand', field: 'quantity' },
    { label: 'Available', field: 'available' },
    { label: 'Threshold', field: 'reorder_threshold' },
    { label: 'Health', field: 'health_status' },
  ]

  const SortIcon = ({ field }) => tlSortField === field
    ? (tlSortAsc ? <ChevronUp size={11} style={{ color: T.teal }} /> : <ChevronDown size={11} style={{ color: T.teal }} />)
    : <ChevronUp size={11} style={{ opacity: 0.2 }} />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="font-display font-bold text-white text-2xl">Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: T.muted }}>
            System overview · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${T.tealDim}` }}
          whileTap={{ scale: 0.97 }}
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn-ghost flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
          style={{ border: `1px solid ${T.border}`, color: T.muted }}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} style={{ color: T.teal }} />
          Refresh
        </motion.button>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((card, i) => (
          <StatCard key={card.label} {...card} loading={loading} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Traffic Light Table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 glass-card rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${T.border}` }}
        >
          {/* Table header */}
          <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3"
            style={{ borderBottom: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-2">
              <Circle size={14} style={{ color: T.teal }} />
              <h2 className="font-display font-bold text-white text-sm">Stock Health</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                style={{ background: T.tealDim, border: `1px solid ${T.tealBorder}`, color: T.teal }}>
                {trafficLight.length} SKUs
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { k: 'all',   label: `All (${trafficLight.length})`, color: 'rgba(255,255,255,0.6)', bg: 'transparent',   border: T.border },
                { k: 'green', label: `✓ ${tlCounts.green}`,          color: T.emerald,               bg: T.emeraldDim,    border: T.emeraldBorder },
                { k: 'amber', label: `~ ${tlCounts.amber}`,          color: T.amber,                 bg: T.amberDim,      border: T.amberBorder },
                { k: 'red',   label: `! ${tlCounts.red}`,            color: T.rose,                  bg: T.roseDim,       border: T.roseBorder },
              ].map(({ k, label, color, bg, border }) => (
                <motion.button
                  key={k}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setTlFilter(k)}
                  className="text-[10px] px-2.5 py-1 rounded-lg font-mono transition-all"
                  style={{
                    color,
                    background: tlFilter === k ? bg : 'transparent',
                    border: `1px solid ${tlFilter === k ? border : 'rgba(255,255,255,0.05)'}`,
                    opacity: tlFilter === k ? 1 : 0.6,
                  }}
                >
                  {label}
                </motion.button>
              ))}
              {/* Search */}
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
                <input
                  value={tlSearch}
                  onChange={e => setTlSearch(e.target.value)}
                  placeholder="Search…"
                  className="input-dark rounded-lg pl-7 pr-3 py-1 text-xs w-28"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, color: 'white' }}
                />
              </div>
            </div>
          </div>

          <div className="overflow-auto" style={{ maxHeight: 380 }}>
            {loading ? (
              <div className="p-8">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-4 mb-3">
                    {[...Array(6)].map((_, j) => (
                      <div key={j} className="h-4 skeleton rounded flex-1" />
                    ))}
                  </div>
                ))}
              </div>
            ) : tlFiltered.length === 0 ? (
              <div className="py-14 text-center">
                <Package size={32} className="mx-auto mb-3 opacity-20" style={{ color: T.muted }} />
                <p className="text-sm" style={{ color: T.muted }}>No products found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {tlCols.map(col => (
                      <th
                        key={col.field}
                        onClick={() => toggleTlSort(col.field)}
                        className="text-left text-xs font-medium px-4 py-3 whitespace-nowrap cursor-pointer select-none transition-colors hover:text-white"
                        style={{ color: T.muted }}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          <SortIcon field={col.field} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {tlFiltered.map((p, i) => (
                      <motion.tr
                        key={p.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.15) }}
                        className="group transition-colors"
                        style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}
                        whileHover={{ background: 'rgba(255,255,255,0.025)' }}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-white text-sm">{p.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs" style={{ color: T.teal, opacity: 0.7 }}>{p.product_code}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-white">
                          {p.quantity} <span className="text-xs" style={{ color: T.muted }}>{p.unit}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm"
                          style={{ color: p.health_status === 'red' ? T.rose : p.health_status === 'amber' ? T.amber : T.emerald }}>
                          {p.available}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: T.muted }}>{p.reorder_threshold}</td>
                        <td className="px-4 py-3"><HealthBadge status={p.health_status} /></td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>

          <div className="px-5 py-2.5 flex gap-5 text-[10px] font-mono"
            style={{ borderTop: `1px solid ${T.border}`, color: T.muted }}>
            <span style={{ color: T.emerald }}>● {tlCounts.green} healthy</span>
            <span style={{ color: T.amber }}>● {tlCounts.amber} low</span>
            <span style={{ color: T.rose }}>● {tlCounts.red} critical</span>
            <span className="ml-auto">{tlFiltered.length} of {trafficLight.length} shown</span>
          </div>
        </motion.div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* AI Anomaly Feed */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="glass-card rounded-2xl p-5"
            style={{ border: `1px solid ${T.border}` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap size={14} style={{ color: T.teal }} />
              <h2 className="font-display font-bold text-white text-sm flex-1">AI Anomaly Feed</h2>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-mono"
                style={{ background: T.tealDim, border: `1px solid ${T.tealBorder}`, color: T.teal }}>
                Groq
              </span>
            </div>
            {anomalyLoad ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 skeleton rounded-xl" />
                ))}
              </div>
            ) : anomalies.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: T.emerald, opacity: 0.5 }} />
                <p className="text-xs" style={{ color: T.muted }}>No anomalies detected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {anomalies.map((a, i) => <AnomalyCard key={i} anomaly={a} index={i} />)}
              </div>
            )}
          </motion.div>

          {/* Pinned Announcements */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.42 }}
            className="glass-card rounded-2xl p-5 flex-1"
            style={{ border: `1px solid ${T.border}` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Megaphone size={14} style={{ color: T.amber }} />
              <h2 className="font-display font-bold text-white text-sm">Pinned Announcements</h2>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-14 skeleton rounded-xl" />)}
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-6">
                <Info size={20} className="mx-auto mb-2" style={{ color: T.muted, opacity: 0.4 }} />
                <p className="text-xs" style={{ color: T.muted }}>No pinned announcements</p>
              </div>
            ) : (
              <div className="space-y-2">
                {announcements.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3 rounded-xl transition-all"
                    style={{ background: T.amberDim, border: `1px solid ${T.amberBorder}` }}
                    whileHover={{ filter: 'brightness(1.1)' }}
                  >
                    <div className="flex items-start gap-2">
                      <span style={{ color: T.amber }} className="shrink-0 mt-0.5">📌</span>
                      <div className="min-w-0">
                        <p className="text-xs font-display font-semibold text-white truncate">{a.title}</p>
                        <p className="text-[11px] mt-0.5 leading-snug line-clamp-2" style={{ color: T.muted }}>{a.content}</p>
                        <p className="text-[10px] font-mono mt-1" style={{ color: T.muted, opacity: 0.6 }}>
                          {new Date(a.created_at).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

        </div>
      </div>
    </div>
  )
}
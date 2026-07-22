// AnonymousReports.jsx — styled to match ProductsPage design system

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, CheckCircle2, AlertTriangle, XCircle,
  ArrowUpCircle, RefreshCw, Eye, Clock, Filter,
  Loader, AlertCircle, ChevronDown, ChevronUp,
  MessageSquare, X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Design tokens ────────────────────────────────────────────────────────
const T = {
  bg:            '#12131f',
  surface:       'rgba(255,255,255,0.03)',
  border:        'rgba(255,255,255,0.07)',
  teal:          '#7effd4',
  tealDim:       'rgba(126,255,212,0.12)',
  tealBorder:    'rgba(126,255,212,0.3)',
  muted:         'rgba(255,255,255,0.4)',
  amber:         '#fbbf24',
  amberDim:      'rgba(251,191,36,0.1)',
  amberBorder:   'rgba(251,191,36,0.25)',
  rose:          '#f87171',
  roseDim:       'rgba(248,113,113,0.1)',
  roseBorder:    'rgba(248,113,113,0.2)',
  blue:          '#60a5fa',
  blueDim:       'rgba(96,165,250,0.1)',
  blueBorder:    'rgba(96,165,250,0.2)',
  emerald:       '#34d399',
  emeraldDim:    'rgba(52,211,153,0.1)',
  emeraldBorder: 'rgba(52,211,153,0.2)',
  violet:        '#a78bfa',
  violetDim:     'rgba(167,139,250,0.1)',
  violetBorder:  'rgba(167,139,250,0.25)',
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: T.amber,   bg: T.amberDim,   border: T.amberBorder,   icon: Clock         },
  reviewed:  { label: 'Reviewed',  color: T.blue,    bg: T.blueDim,    border: T.blueBorder,    icon: Eye           },
  escalated: { label: 'Escalated', color: T.rose,    bg: T.roseDim,    border: T.roseBorder,    icon: ArrowUpCircle },
  resolved:  { label: 'Resolved',  color: T.emerald, bg: T.emeraldDim, border: T.emeraldBorder, icon: CheckCircle2  },
  dismissed: { label: 'Dismissed', color: T.violet,  bg: T.violetDim,  border: T.violetBorder,  icon: XCircle       },
}

const SEVERITY_CONFIG = {
  low:      { color: T.emerald, bg: T.emeraldDim, border: T.emeraldBorder, pulse: false },
  medium:   { color: T.amber,   bg: T.amberDim,   border: T.amberBorder,   pulse: false },
  high:     { color: T.rose,    bg: T.roseDim,    border: T.roseBorder,    pulse: true  },
  critical: { color: '#fca5a5', bg: T.roseDim,    border: T.roseBorder,    pulse: true  },
}

const CATEGORY_ICONS = {
  theft: '🔒', safety: '⚠️', harassment: '🛡️', data_breach: '💾',
  financial_fraud: '💰', policy_violation: '📋', quality_issue: '🔍', other: '📝',
}

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-lg font-mono"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  )
}

function SeverityBadge({ severity }) {
  const s = severity || 'medium'
  const c = SEVERITY_CONFIG[s] || SEVERITY_CONFIG.medium
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-mono"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}>
      <motion.span
        animate={c.pulse ? { scale: [1, 1.4, 1], opacity: [1, 0.4, 1] } : {}}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{ background: c.color }}
      />
      {s}
    </span>
  )
}

// ─── Report Card ──────────────────────────────────────────────────────────
function ReportCard({ report, onAction, actionLoading, index }) {
  const [expanded, setExpanded] = useState(false)
  const [note,     setNote]     = useState('')
  const [showNote, setShowNote] = useState(false)

  const catIcon  = CATEGORY_ICONS[report.category] || '📝'
  const sevCfg   = SEVERITY_CONFIG[report.severity || 'medium'] || SEVERITY_CONFIG.medium

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs  = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (days > 0) return `${days}d ago`
    if (hrs  > 0) return `${hrs}h ago`
    if (mins > 0) return `${mins}m ago`
    return 'just now'
  }

  const actions = [
    { key: 'reviewed',  label: 'Mark Reviewed', icon: Eye,           color: T.blue,    bg: T.blueDim,    border: T.blueBorder   },
    { key: 'escalated', label: 'Escalate',       icon: ArrowUpCircle, color: T.rose,    bg: T.roseDim,    border: T.roseBorder   },
    { key: 'resolved',  label: 'Resolve',        icon: CheckCircle2,  color: T.emerald, bg: T.emeraldDim, border: T.emeraldBorder },
    { key: 'dismissed', label: 'Dismiss',        icon: XCircle,       color: T.violet,  bg: T.violetDim,  border: T.violetBorder },
  ].filter(a => a.key !== report.status)

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${T.border}`,
    color: 'white',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '12px',
    width: '100%',
    outline: 'none',
    resize: 'none',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ delay: Math.min(index * 0.04, 0.2), duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: T.bg,
        border: `1px solid ${report.severity === 'critical' || report.severity === 'high' ? sevCfg.border : T.border}`,
      }}
      whileHover={{ borderColor: sevCfg.border, transition: { duration: 0.15 } }}
    >
      {/* Card header */}
      <div className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          {catIcon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <SeverityBadge severity={report.severity} />
            <StatusBadge status={report.status} />
            <span className="text-[10px] font-mono ml-auto" style={{ color: T.muted }}>{timeAgo(report.created_at)}</span>
          </div>

          <p className="text-sm font-display font-semibold text-white capitalize mb-1">
            {(report.category || 'other').replace(/_/g, ' ')}
          </p>

          <p className={`text-xs leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`} style={{ color: T.muted }}>
            {report.description}
          </p>

          {report.location_detail && (
            <p className="text-[10px] font-mono mt-1" style={{ color: T.muted, opacity: 0.7 }}>
              📍 {report.location_detail}
            </p>
          )}

          {report.admin_notes && (
            <div className="mt-2 p-2 rounded-lg" style={{ background: T.violetDim, border: `1px solid ${T.violetBorder}` }}>
              <p className="text-[10px] font-mono mb-0.5" style={{ color: T.violet }}>Admin note:</p>
              <p className="text-[11px]" style={{ color: T.muted }}>{report.admin_notes}</p>
            </div>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: T.surface, border: `1px solid ${T.border}` }}
        >
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={13} style={{ color: T.muted }} />
          </motion.div>
        </motion.button>
      </div>

      {/* Expanded actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ borderTop: `1px solid ${T.border}`, overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-3 space-y-3">
              {/* Report metadata */}
              <div className="flex gap-4 text-[10px] font-mono" style={{ color: T.muted }}>
                <span>ID: {report.id.slice(0, 8)}…</span>
                <span>Filed: {new Date(report.created_at).toLocaleString('en-IN')}</span>
              </div>

              {/* Add note */}
              <div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setShowNote(v => !v)}
                  className="flex items-center gap-1.5 text-[11px] transition-colors"
                  style={{ color: showNote ? T.teal : T.muted }}
                >
                  <MessageSquare size={12} />
                  {showNote ? 'Hide note' : 'Add admin note'}
                </motion.button>
                <AnimatePresence>
                  {showNote && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2"
                    >
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Internal note for this report…"
                        style={{ ...inputStyle, height: 64 }}
                        onFocus={e => e.target.style.borderColor = T.tealBorder}
                        onBlur={e => e.target.style.borderColor = T.border}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {actions.map(({ key, label, icon: Icon, color, bg, border }) => (
                  <motion.button
                    key={key}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    disabled={actionLoading === report.id}
                    onClick={() => onAction(report.id, key, note)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{ color, background: bg, border: `1px solid ${border}` }}
                  >
                    {actionLoading === report.id
                      ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }}><Loader size={12} /></motion.div>
                      : <Icon size={12} />
                    }
                    {label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Summary Chip ──────────────────────────────────────────────────────────
function SummaryChip({ label, value, color, bg, border }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="rounded-xl px-4 py-3 flex items-center justify-between"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span className="text-xs" style={{ color: T.muted }}>{label}</span>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="font-display font-bold text-xl"
        style={{ color }}
      >
        {value}
      </motion.span>
    </motion.div>
  )
}

// ─── Main AnonymousReports ─────────────────────────────────────────────────
export default function AnonymousReports() {
  const [reports,        setReports]        = useState([])
  const [loading,        setLoading]        = useState(true)
  const [actionLoading,  setActionLoading]  = useState(null)
  const [statusFilter,   setStatusFilter]   = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [toast,          setToast]          = useState(null)

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('anonymous_reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setReports(data || [])
    } catch (e) {
      console.error(e)
      showToast('error', 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAction = async (id, newStatus, adminNote) => {
    setActionLoading(id)
    try {
      const updates = { status: newStatus, updated_at: new Date().toISOString() }
      if (adminNote?.trim()) updates.admin_notes = adminNote.trim()
      const { error } = await supabase.from('anonymous_reports').update(updates).eq('id', id)
      if (error) throw error
      setReports(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
      showToast('success', `Report marked as ${newStatus}`)
    } catch (e) {
      showToast('error', e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = reports.filter(r => {
    const matchStatus   = statusFilter   === 'all' || r.status                  === statusFilter
    const matchSeverity = severityFilter === 'all' || (r.severity || 'medium')  === severityFilter
    return matchStatus && matchSeverity
  })

  const counts = {
    total:     reports.length,
    pending:   reports.filter(r => r.status === 'pending').length,
    escalated: reports.filter(r => r.status === 'escalated').length,
    resolved:  reports.filter(r => r.status === 'resolved').length,
  }

  const filterBtnStyle = (active, color, bg, border) => ({
    color:      active ? color    : T.muted,
    background: active ? bg      : 'transparent',
    border:     `1px solid ${active ? border : 'transparent'}`,
    borderRadius: '10px',
    padding: '5px 12px',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    transition: 'all 0.15s',
  })

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="font-display font-bold text-white text-2xl">Anonymous Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: T.muted }}>
            {counts.pending} pending · {counts.escalated} escalated · {counts.resolved} resolved
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={load}
          className="btn-ghost flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
          style={{ border: `1px solid ${T.border}`, color: T.muted }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ color: T.teal }} />
          Refresh
        </motion.button>
      </motion.div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: counts.total,     color: 'white',    bg: T.surface,   border: T.border        },
          { label: 'Pending',   value: counts.pending,   color: T.amber,    bg: T.amberDim,  border: T.amberBorder   },
          { label: 'Escalated', value: counts.escalated, color: T.rose,     bg: T.roseDim,   border: T.roseBorder    },
          { label: 'Resolved',  value: counts.resolved,  color: T.emerald,  bg: T.emeraldDim,border: T.emeraldBorder },
        ].map(({ label, value, color, bg, border }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <SummaryChip label={label} value={value} color={color} bg={bg} border={border} />
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 flex-wrap"
      >
        <div className="flex items-center gap-1.5" style={{ color: T.muted }}>
          <Filter size={12} />
          <span className="text-xs">Status:</span>
        </div>
        {['all', ...Object.keys(STATUS_CONFIG)].map(s => {
          const cfg = STATUS_CONFIG[s]
          return (
            <motion.button
              key={s}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setStatusFilter(s)}
              style={filterBtnStyle(
                statusFilter === s,
                s === 'all' ? 'white' : cfg?.color,
                s === 'all' ? T.surface : cfg?.bg,
                s === 'all' ? T.border  : cfg?.border,
              )}
            >
              {s === 'all' ? 'All' : cfg?.label}
            </motion.button>
          )
        })}

        <div className="w-px h-4 mx-1" style={{ background: T.border }} />

        <span className="text-xs" style={{ color: T.muted }}>Severity:</span>
        {['all', 'low', 'medium', 'high', 'critical'].map(s => {
          const cfg = SEVERITY_CONFIG[s]
          return (
            <motion.button
              key={s}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSeverityFilter(s)}
              style={filterBtnStyle(
                severityFilter === s,
                s === 'all' ? 'white' : cfg?.color,
                s === 'all' ? T.surface : cfg?.bg,
                s === 'all' ? T.border  : cfg?.border,
              )}
              className="capitalize"
            >
              {s}
            </motion.button>
          )
        })}

        {(statusFilter !== 'all' || severityFilter !== 'all') && (
          <span className="text-xs font-mono ml-1" style={{ color: T.muted }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </motion.div>

      {/* Report list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 skeleton rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl p-14 text-center"
          style={{ background: T.bg, border: `1px solid ${T.border}` }}
        >
          <Shield size={32} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
          <p className="text-sm" style={{ color: T.muted }}>No reports found</p>
          <p className="text-xs mt-1" style={{ color: T.muted, opacity: 0.6 }}>
            {statusFilter !== 'all' || severityFilter !== 'all'
              ? 'Try adjusting the filters above'
              : 'No anonymous reports have been submitted'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((r, i) => (
              <ReportCard
                key={r.id}
                report={r}
                onAction={handleAction}
                actionLoading={actionLoading}
                index={i}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
            style={{
              background: T.bg,
              border: `1px solid ${toast.type === 'error' ? T.roseBorder : T.emeraldBorder}`,
              color: toast.type === 'error' ? T.rose : T.emerald,
            }}
          >
            {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <p className="text-sm font-display font-medium">{toast.msg}</p>
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={() => setToast(null)}
              style={{ color: T.muted, marginLeft: 4 }}
            >
              <X size={13} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
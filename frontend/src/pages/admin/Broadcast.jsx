// Broadcast.jsx — Post pinned announcements, styled to match ProductsPage design system

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Megaphone, Plus, X, Trash2, Pin, PinOff,
  Loader, CheckCircle2, AlertCircle, Users,
  Clock, RefreshCw, Send
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Design tokens ─────────────────────────────────────────────────────────
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

const ROLE_OPTIONS = [
  { value: 'all',             label: 'All Users',       color: T.violet, bg: T.violetDim, border: T.violetBorder },
  { value: 'admin',           label: 'Admins',          color: T.rose,   bg: T.roseDim,   border: T.roseBorder   },
  { value: 'sales_manager',   label: 'Sales Managers',  color: T.blue,   bg: T.blueDim,   border: T.blueBorder   },
  { value: 'warehouse_staff', label: 'Warehouse Staff', color: T.amber,  bg: T.amberDim,  border: T.amberBorder  },
  { value: 'manufacturer',    label: 'Manufacturers',   color: T.teal,   bg: T.tealDim,   border: T.tealBorder   },
  { value: 'accountant',      label: 'Accountants',     color: T.emerald,bg: T.emeraldDim,border: T.emeraldBorder},
]

const PRIORITY_OPTIONS = [
  { value: 'normal',   label: 'Normal',   color: T.muted,  bg: T.surface,   border: T.border     },
  { value: 'high',     label: 'High',     color: T.amber,  bg: T.amberDim,  border: T.amberBorder },
  { value: 'critical', label: 'Critical', color: T.rose,   bg: T.roseDim,   border: T.roseBorder  },
]

function RoleBadge({ role }) {
  const r = ROLE_OPTIONS.find(o => o.value === role) || ROLE_OPTIONS[0]
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
      style={{ color: r.color, background: r.bg, border: `1px solid ${r.border}` }}>
      {r.label}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const p = PRIORITY_OPTIONS.find(o => o.value === priority) || PRIORITY_OPTIONS[0]
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
      style={{ color: p.color, background: p.bg, border: `1px solid ${p.border}` }}>
      {p.label}
    </span>
  )
}

// ─── Announcement Card ──────────────────────────────────────────────────────
function AnnouncementCard({ ann, onTogglePin, onDelete, index }) {
  const [deleting, setDeleting] = useState(false)
  const [pinning,  setPinning]  = useState(false)

  const pCfg = PRIORITY_OPTIONS.find(p => p.value === (ann.priority || 'normal')) || PRIORITY_OPTIONS[0]

  const handleDelete = async () => { setDeleting(true); await onDelete(ann.id); setDeleting(false) }
  const handlePin    = async () => { setPinning(true);  await onTogglePin(ann.id, !ann.is_pinned); setPinning(false) }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
      transition={{ delay: index * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl p-4 group"
      style={{
        background: T.bg,
        border: `1px solid ${ann.priority === 'critical' ? T.roseBorder : ann.priority === 'high' ? T.amberBorder : T.border}`,
      }}
      whileHover={{ borderColor: pCfg.border, transition: { duration: 0.15 } }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: ann.priority === 'critical' ? T.roseDim : ann.priority === 'high' ? T.amberDim : T.violetDim,
            border: `1px solid ${ann.priority === 'critical' ? T.roseBorder : ann.priority === 'high' ? T.amberBorder : T.violetBorder}`,
          }}>
          <Megaphone size={14} style={{ color: ann.priority === 'critical' ? T.rose : ann.priority === 'high' ? T.amber : T.violet }} />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="text-sm font-display font-bold text-white truncate">{ann.title}</h3>
            {ann.is_pinned && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
                style={{ color: T.amber, background: T.amberDim, border: `1px solid ${T.amberBorder}` }}>
                📌 pinned
              </span>
            )}
            <PriorityBadge priority={ann.priority} />
          </div>

          <p className="text-xs leading-relaxed mb-2" style={{ color: T.muted }}>{ann.content}</p>

          <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: T.muted }}>
            <span className="flex items-center gap-1">
              <Users size={10} />
              <RoleBadge role={ann.target_role || 'all'} />
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {new Date(ann.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={handlePin}
            disabled={pinning}
            title={ann.is_pinned ? 'Unpin' : 'Pin'}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: ann.is_pinned ? T.amberDim : T.surface,
              border: `1px solid ${ann.is_pinned ? T.amberBorder : T.border}`,
            }}
          >
            {pinning
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }}><Loader size={12} style={{ color: T.amber }} /></motion.div>
              : ann.is_pinned
                ? <PinOff size={12} style={{ color: T.amber }} />
                : <Pin size={12} style={{ color: T.muted }} />
            }
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleDelete}
            disabled={deleting}
            title="Delete"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ background: T.roseDim, border: `1px solid ${T.roseBorder}` }}
          >
            {deleting
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }}><Loader size={12} style={{ color: T.rose }} /></motion.div>
              : <Trash2 size={12} style={{ color: T.rose }} />
            }
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Toggle Switch ──────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group select-none">
      <motion.div
        onClick={() => onChange(!checked)}
        className="w-10 h-5 rounded-full relative cursor-pointer transition-colors"
        style={{ background: checked ? T.teal : 'rgba(255,255,255,0.1)', border: `1px solid ${checked ? T.tealBorder : T.border}` }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
        />
      </motion.div>
      <span className="text-xs transition-colors" style={{ color: checked ? 'white' : T.muted }}>{label}</span>
    </label>
  )
}

// ─── Main Broadcast ─────────────────────────────────────────────────────────
export default function Broadcast() {
  const [announcements, setAnnouncements] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [toast,         setToast]         = useState(null)
  const [form, setForm] = useState({
    title: '', content: '', target_role: 'all', priority: 'normal', is_pinned: false,
  })

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
      setAnnouncements(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) { showToast('error', 'Title and content are required'); return }
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('announcements').insert({
        title:       form.title.trim(),
        content:     form.content.trim(),
        target_role: form.target_role,
        priority:    form.priority,
        is_pinned:   form.is_pinned,
        author_id:   user?.id,
      })
      if (error) throw error
      showToast('success', 'Announcement posted successfully')
      setShowForm(false)
      setForm({ title: '', content: '', target_role: 'all', priority: 'normal', is_pinned: false })
      load()
    } catch (e) {
      showToast('error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTogglePin = async (id, pinned) => {
    try {
      const { error } = await supabase.from('announcements').update({ is_pinned: pinned }).eq('id', id)
      if (error) throw error
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, is_pinned: pinned } : a))
      showToast('success', pinned ? 'Announcement pinned' : 'Announcement unpinned')
    } catch (e) { showToast('error', e.message) }
  }

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id)
      if (error) throw error
      setAnnouncements(prev => prev.filter(a => a.id !== id))
      showToast('success', 'Announcement deleted')
    } catch (e) { showToast('error', e.message) }
  }

  const pinnedList   = announcements.filter(a => a.is_pinned)
  const unpinnedList = announcements.filter(a => !a.is_pinned)
  const criticalCount = announcements.filter(a => a.priority === 'critical').length

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${T.border}`,
    color: 'white',
    borderRadius: '12px',
    padding: '10px 12px',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="font-display font-bold text-white text-2xl">Broadcast</h1>
          <p className="text-sm mt-0.5" style={{ color: T.muted }}>
            {announcements.length} announcements · {pinnedList.length} pinned · {criticalCount} critical
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={load}
            className="w-9 h-9 rounded-xl flex items-center justify-center btn-ghost"
            style={{ border: `1px solid ${T.border}` }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ color: T.teal }} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: `0 0 28px ${T.tealDim}` }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(v => !v)}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
          >
            <motion.div animate={{ rotate: showForm ? 45 : 0 }} transition={{ duration: 0.2 }}>
              <Plus size={14} />
            </motion.div>
            {showForm ? 'Cancel' : 'New Announcement'}
          </motion.button>
        </div>
      </motion.div>

      {/* Compose Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl p-6"
            style={{ background: T.bg, border: `1px solid ${T.tealBorder}` }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Send size={14} style={{ color: T.teal }} />
              <h2 className="font-display font-bold text-white text-sm">Compose Announcement</h2>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: T.muted }}>Title *</label>
                <input
                  style={inputStyle}
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. System maintenance scheduled"
                  onFocus={e => e.target.style.borderColor = T.tealBorder}
                  onBlur={e => e.target.style.borderColor = T.border}
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: T.muted }}>Content *</label>
                <textarea
                  style={{ ...inputStyle, height: 96, resize: 'none' }}
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  placeholder="Full announcement message…"
                  onFocus={e => e.target.style.borderColor = T.tealBorder}
                  onBlur={e => e.target.style.borderColor = T.border}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Target */}
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: T.muted }}>Target Audience</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    value={form.target_role}
                    onChange={e => setForm({ ...form, target_role: e.target.value })}
                  >
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: T.muted }}>Priority</label>
                  <select
                    style={{ ...inputStyle, cursor: 'pointer' }}
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                  >
                    {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>

                {/* Pin toggle */}
                <div className="flex flex-col justify-end pb-1">
                  <Toggle
                    checked={form.is_pinned}
                    onChange={v => setForm({ ...form, is_pinned: v })}
                    label="Pin to dashboard"
                  />
                </div>
              </div>

              {/* Live Preview */}
              <AnimatePresence>
                {(form.title || form.content) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-xl p-3"
                    style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${T.border}` }}
                  >
                    <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: T.muted }}>Preview</p>
                    <div className="flex items-start gap-2">
                      <span>📢</span>
                      <div>
                        <p className="text-xs font-bold text-white">{form.title || 'Untitled'}</p>
                        <p className="text-[11px] mt-0.5 leading-snug" style={{ color: T.muted }}>{form.content || 'No content'}</p>
                        <div className="flex gap-2 mt-1.5">
                          <RoleBadge role={form.target_role} />
                          {form.is_pinned && (
                            <span className="text-[9px] font-mono" style={{ color: T.amber }}>📌 pinned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowForm(false)}
                className="btn-ghost px-4 py-2 rounded-xl text-sm"
                style={{ border: `1px solid ${T.border}`, color: T.muted }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: `0 0 24px ${T.tealDim}` }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary flex items-center gap-2 px-5 py-2 rounded-xl text-sm"
              >
                {submitting
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }}><Loader size={13} /></motion.div>
                  : <Send size={13} />
                }
                Post Announcement
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl p-14 text-center"
          style={{ background: T.bg, border: `1px solid ${T.border}` }}
        >
          <Megaphone size={32} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
          <p className="text-sm" style={{ color: T.muted }}>No announcements yet</p>
          <p className="text-xs mt-1" style={{ color: T.muted, opacity: 0.6 }}>Click "New Announcement" to post one</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {/* Pinned */}
          {pinnedList.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-widest font-mono px-1" style={{ color: T.muted }}>📌 Pinned</p>
              <AnimatePresence>
                {pinnedList.map((a, i) => (
                  <AnnouncementCard key={a.id} ann={a} onTogglePin={handleTogglePin} onDelete={handleDelete} index={i} />
                ))}
              </AnimatePresence>
              <div style={{ height: 1, background: T.border, margin: '4px 0' }} />
              <p className="text-[10px] uppercase tracking-widest font-mono px-1" style={{ color: T.muted }}>Recent</p>
            </>
          )}
          <AnimatePresence>
            {unpinnedList.map((a, i) => (
              <AnnouncementCard key={a.id} ann={a} onTogglePin={handleTogglePin} onDelete={handleDelete} index={i} />
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
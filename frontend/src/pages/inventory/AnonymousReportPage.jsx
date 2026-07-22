import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flag, Send, CheckCircle, Loader, Shield,
  AlertTriangle, Package, TrendingDown, Users, Lock
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { id:'stock_discrepancy', label:'Stock Discrepancy',   icon:Package,       desc:'Counts don\'t match records' },
  { id:'theft_suspicion',   label:'Suspected Theft',     icon:AlertTriangle, desc:'Missing items or theft concern' },
  { id:'process_violation', label:'Process Violation',   icon:Users,         desc:'Procedures not being followed' },
  { id:'data_manipulation', label:'Data Manipulation',   icon:TrendingDown,  desc:'Records appear altered' },
  { id:'safety_concern',    label:'Safety Concern',      icon:Shield,        desc:'Unsafe working conditions' },
  { id:'other',             label:'Other',               icon:Flag,          desc:'Something else entirely' },
]

const SEVERITY = [
  { id:'low',      label:'Low',      color:'#4ade80', bg:'rgba(74,222,128,0.08)',   border:'rgba(74,222,128,0.2)'  },
  { id:'medium',   label:'Medium',   color:'#fbbf24', bg:'rgba(251,191,36,0.08)',   border:'rgba(251,191,36,0.2)'  },
  { id:'high',     label:'High',     color:'#f87171', bg:'rgba(248,113,113,0.08)',  border:'rgba(248,113,113,0.2)' },
  { id:'critical', label:'Critical', color:'#ff4d6d', bg:'rgba(255,77,109,0.08)',   border:'rgba(255,77,109,0.2)'  },
]

export default function AnonymousReportPage() {
  const [category, setCategory]   = useState('')
  const [severity, setSeverity]   = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reportId, setReportId]   = useState('')

  async function handleSubmit() {
    if (!category)              return toast.error('Select a category')
    if (!severity)              return toast.error('Select a severity level')
    if (description.length < 20) return toast.error('Please provide more detail (min 20 characters)')

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('anonymous_reports')
        .insert({
          category,
          severity,
          description,
          location_detail: location || null,
          // No user_id — fully anonymous
        })
        .select('id')
        .single()

      if (error) throw error

      const shortId = (data?.id || '').slice(0, 8).toUpperCase()
      setReportId(shortId)
      setSubmitted(true)
      toast.success('Report submitted anonymously')
    } catch (err) {
      toast.error(err.message || 'Submission failed')
    }
    setSubmitting(false)
  }

  function resetForm() {
    setCategory('')
    setSeverity('')
    setDescription('')
    setLocation('')
    setSubmitted(false)
    setReportId('')
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity:0, scale:0.95 }}
          animate={{ opacity:1, scale:1 }}
          transition={{ duration:0.4, ease:[0.16,1,0.3,1] }}
          className="glass-card rounded-2xl p-10 text-center"
        >
          <motion.div
            initial={{ scale:0 }}
            animate={{ scale:1 }}
            transition={{ delay:0.2, type:'spring', stiffness:200 }}
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.25)' }}
          >
            <CheckCircle size={28} style={{ color:'#4ade80' }} />
          </motion.div>

          <h2 className="font-display font-bold text-white text-2xl mb-2">Report Submitted</h2>
          <p className="text-muted text-sm mb-6">
            Your report has been submitted completely anonymously. No identifying information was recorded.
          </p>

          {reportId && (
            <div className="px-4 py-3 rounded-xl mb-6"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)' }}>
              <p className="text-xs text-muted mb-1">Reference ID (optional, for follow-up)</p>
              <p className="font-mono font-bold text-white tracking-widest text-lg">{reportId}</p>
            </div>
          )}

          <div className="flex items-center gap-2 justify-center text-xs text-muted mb-8">
            <Lock size={11} />
            Your identity is fully protected. No logs were stored.
          </div>

          <button
            onClick={resetForm}
            className="btn-ghost px-6 py-2.5 rounded-xl text-sm"
          >
            Submit another report
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background:'rgba(255,77,109,0.08)', border:'1px solid rgba(255,77,109,0.2)' }}>
            <Flag size={15} style={{ color:'#f87171' }} />
          </div>
          <div>
            <h2 className="font-display font-bold text-white text-xl">Anonymous Report</h2>
            <p className="text-muted text-sm">Your identity is never recorded</p>
          </div>
        </div>
      </motion.div>

      {/* Privacy notice */}
      <motion.div
        initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
        className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background:'rgba(126,255,212,0.04)', border:'1px solid rgba(126,255,212,0.12)' }}
      >
        <Lock size={14} style={{ color:'#7effd4', flexShrink:0, marginTop:1 }} />
        <p className="text-xs leading-relaxed" style={{ color:'rgba(255,255,255,0.5)' }}>
          This report is fully anonymous. Your user ID, IP address, and session data are <strong className="text-white">not stored</strong> with this submission. Reports go directly to management for review.
        </p>
      </motion.div>

      {/* Category */}
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}>
        <label className="text-xs text-muted mb-3 block">What are you reporting? *</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const active = category === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className="p-3 rounded-xl text-left transition-all duration-200"
                style={{
                  background: active ? 'rgba(126,255,212,0.07)' : 'rgba(255,255,255,0.03)',
                  border: active ? '1px solid rgba(126,255,212,0.25)' : '1px solid var(--border)',
                }}
              >
                <Icon size={14} style={{ color: active ? '#7effd4' : 'var(--muted)', marginBottom:6 }} />
                <p className="text-xs font-medium" style={{ color: active ? '#7effd4' : 'rgba(255,255,255,0.7)' }}>
                  {cat.label}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color:'rgba(255,255,255,0.3)' }}>
                  {cat.desc}
                </p>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Severity */}
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}>
        <label className="text-xs text-muted mb-3 block">Severity *</label>
        <div className="flex gap-2.5">
          {SEVERITY.map(s => {
            const active = severity === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSeverity(s.id)}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-200"
                style={{
                  background: active ? s.bg : 'rgba(255,255,255,0.03)',
                  border: active ? `1px solid ${s.border}` : '1px solid var(--border)',
                  color: active ? s.color : 'var(--muted)',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Description */}
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}>
        <label className="text-xs text-muted mb-1.5 block">
          Description * <span className="opacity-50">({description.length}/1000)</span>
        </label>
        <textarea
          className="input-dark w-full rounded-xl px-4 py-3 text-sm resize-none"
          rows={5}
          maxLength={1000}
          placeholder="Describe what you observed. Include dates, times, product names, or any other relevant details. The more specific, the more actionable."
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        {description.length > 0 && description.length < 20 && (
          <p className="text-xs mt-1" style={{ color:'#f87171' }}>
            Please provide at least 20 characters
          </p>
        )}
      </motion.div>

      {/* Location (optional) */}
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.25 }}>
        <label className="text-xs text-muted mb-1.5 block">
          Location / Area <span className="opacity-50">(optional)</span>
        </label>
        <input
          type="text"
          className="input-dark w-full rounded-xl px-4 py-2.5 text-sm"
          placeholder="e.g. Warehouse A, Shelf 3, Loading bay..."
          value={location}
          onChange={e => setLocation(e.target.value)}
        />
      </motion.div>

      {/* Submit */}
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background:'rgba(255,77,109,0.1)',
            border:'1px solid rgba(255,77,109,0.25)',
            color:'#f87171',
          }}
        >
          {submitting ? (
            <>
              <motion.div animate={{ rotate:360 }} transition={{ duration:0.7, repeat:Infinity, ease:'linear' }}>
                <Loader size={15} />
              </motion.div>
              Submitting anonymously...
            </>
          ) : (
            <>
              <Send size={15} />
              Submit Anonymous Report
            </>
          )}
        </button>
        <p className="text-center text-xs mt-3" style={{ color:'rgba(255,255,255,0.2)' }}>
          <Lock size={9} style={{ display:'inline', marginRight:4 }} />
          No identifying data is transmitted with this report
        </p>
      </motion.div>
    </div>
  )
}
// Manufacturing.jsx — dark audit-page aesthetic with framer-motion

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, BarChart3, MapPin, RefreshCw, Factory, Layers, Recycle, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import TrackingMap from './TrackingMap'

const MOCK_BATCHES = [
  { id: 'MFG-101', product: 'Cotton Yarn Batch A', input_material: 'Cotton Grade A', input_qty: 500, output_qty: 460, waste_qty: 40, status: 'active', start_date: '2025-01-20', end_date: null, operator: 'Ramesh Kumar',
    trackingLogs: [{ location: 'Surat Factory Floor A', status: 'at_factory', lat: 21.1702, lng: 72.8311, timestamp: '2025-01-20T08:00:00', note: 'Batch started. Raw cotton loaded into spinning machines.' }]
  },
  { id: 'MFG-100', product: 'Denim Roll', input_material: 'Denim Cloth', input_qty: 200, output_qty: 188, waste_qty: 12, status: 'completed', start_date: '2025-01-15', end_date: '2025-01-19', operator: 'Suresh Patel',
    trackingLogs: [
      { location: 'Ahmedabad Warehouse', status: 'at_warehouse', lat: 23.0225, lng: 72.5714, timestamp: '2025-01-15T07:30:00', note: 'Raw denim received from supplier.' },
      { location: 'Surat Factory Floor B', status: 'at_factory', lat: 21.175, lng: 72.835, timestamp: '2025-01-15T11:00:00', note: 'Processing started.' },
      { location: 'Mumbai Dispatch Hub', status: 'dispatched', lat: 19.076, lng: 72.8777, timestamp: '2025-01-19T14:00:00', note: 'Batch completed. 188 rolls dispatched to customer.' },
    ]
  },
  { id: 'MFG-099', product: 'Poly Blend Fabric', input_material: 'Polyester Mix', input_qty: 350, output_qty: 330, waste_qty: 20, status: 'completed', start_date: '2025-01-10', end_date: '2025-01-14', operator: 'Anita Singh', trackingLogs: [] },
  { id: 'MFG-098', product: 'Button Sets', input_material: 'Metal Buttons', input_qty: 5000, output_qty: 4950, waste_qty: 50, status: 'completed', start_date: '2025-01-08', end_date: '2025-01-09', operator: 'Priya Verma', trackingLogs: [] },
  { id: 'MFG-102', product: 'Zipper Assembly', input_material: 'Zippers #5', input_qty: 300, output_qty: 0, waste_qty: 0, status: 'active', start_date: '2025-01-22', end_date: null, operator: 'Deepak Sharma', trackingLogs: [] },
  { id: 'MFG-103', product: 'Elastic Rolls', input_material: 'Elastic Band', input_qty: 400, output_qty: 0, waste_qty: 0, status: 'planned', start_date: '2025-01-25', end_date: null, operator: 'Kavita Nair', trackingLogs: [] },
]

const YIELD_DATA = [
  { batch: 'MFG-098', yield: 99, waste: 1 },
  { batch: 'MFG-099', yield: 94.3, waste: 5.7 },
  { batch: 'MFG-100', yield: 94, waste: 6 },
  { batch: 'MFG-101', yield: 92, waste: 8 },
]

const STATUS_STYLE = {
  active:    { bg: 'rgba(34,211,238,0.1)',  border: 'rgba(34,211,238,0.25)',  color: '#22d3ee' },
  completed: { bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  color: '#34d399' },
  planned:   { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  color: '#fbbf24' },
  paused:    { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', color: '#f87171' },
}

function MiniBar({ pct, color }) {
  return (
    <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(75,77,107,0.3)', overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{ height: '100%', borderRadius: 2, background: color }}
      />
    </div>
  )
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.planned
  return (
    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontFamily: 'monospace', fontWeight: 500, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

export default function Manufacturing() {
  const [batches, setBatches] = useState(MOCK_BATCHES)
  const [showModal, setShowModal] = useState(false)
  const [expandedTracker, setExpandedTracker] = useState(null)
  const [form, setForm] = useState({
    product: '', input_material: '', input_qty: '', operator: '',
    start_date: new Date().toISOString().split('T')[0]
  })

  const stats = {
    active:     batches.filter(b => b.status === 'active').length,
    completed:  batches.filter(b => b.status === 'completed').length,
    avgYield:   YIELD_DATA.reduce((s, d) => s + d.yield, 0) / YIELD_DATA.length,
    totalWaste: batches.filter(b => b.status === 'completed').reduce((s, b) => s + b.waste_qty, 0),
  }

  const handleCreate = () => {
    setBatches(prev => [{
      ...form,
      id: `MFG-${104 + prev.length}`,
      input_qty: parseInt(form.input_qty) || 0,
      output_qty: 0, waste_qty: 0, status: 'planned', end_date: null, trackingLogs: [],
    }, ...prev])
    setShowModal(false)
    setForm({ product: '', input_material: '', input_qty: '', operator: '', start_date: new Date().toISOString().split('T')[0] })
  }

  const updateStatus = (id, status) => {
    setBatches(prev => prev.map(b => b.id === id
      ? { ...b, status, end_date: status === 'completed' ? new Date().toISOString().split('T')[0] : b.end_date }
      : b
    ))
  }

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    background: 'rgba(20,21,35,0.8)', border: '1px solid rgba(75,77,107,0.5)',
    color: '#e2e3ed', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = {
    fontSize: 11, color: '#6b6e89', textTransform: 'uppercase',
    letterSpacing: '0.05em', fontWeight: 500, display: 'block', marginBottom: 4,
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#e2e3ed' }}>Manufacturing</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b6e89' }}>
            Production batches & yield tracking · {batches.length} batches
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#7c3aed', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <Plus size={14} /> New Batch
        </motion.button>
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Active Batches', value: stats.active,                    color: '#22d3ee', icon: Factory   },
          { label: 'Completed',      value: stats.completed,                 color: '#34d399', icon: Layers    },
          { label: 'Avg Yield',      value: `${stats.avgYield.toFixed(1)}%`, color: '#a78bfa', icon: TrendingUp },
          { label: 'Total Waste',    value: `${stats.totalWaste} units`,     color: '#f87171', icon: Recycle   },
        ].map(({ label, value, color, icon: Icon }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + i * 0.04 }}
            whileHover={{ y: -2 }}
            style={{ background: 'rgba(20,22,38,0.8)', border: '1px solid rgba(75,77,107,0.4)', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#6b6e89', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={13} color={color} />
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Yield Chart ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ background: 'rgba(20,22,38,0.8)', border: '1px solid rgba(75,77,107,0.4)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <BarChart3 size={15} color="#a78bfa" />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#9394a5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Yield & waste per batch
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
            {[['#a78bfa', 'Yield %'], ['#fb7185', 'Waste %']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                <span style={{ fontSize: 11, color: '#6b6e89' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={YIELD_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(75,77,107,0.25)" vertical={false} />
              <XAxis dataKey="batch" tick={{ fill: '#6b6e89', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b6e89', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: 'rgba(20,22,38,0.98)', border: '1px solid rgba(75,77,107,0.5)', borderRadius: 10, fontSize: 12, color: '#e2e3ed' }}
                cursor={{ fill: 'rgba(124,58,237,0.06)' }}
              />
              <Bar dataKey="yield" name="Yield %" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="waste" name="Waste %" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Batches Table ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
        style={{ background: 'rgba(20,22,38,0.8)', border: '1px solid rgba(75,77,107,0.4)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(75,77,107,0.4)' }}>
                {['Batch ID','Product','Input Material','Input','Output','Waste','Yield %','Operator','Status','Track'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', fontSize: 11, fontWeight: 500, color: '#6b6e89', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: ['Input','Output','Waste','Yield %'].includes(h) ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.map((batch, idx) => {
                const yieldPct = batch.input_qty > 0 && batch.output_qty > 0
                  ? ((batch.output_qty / batch.input_qty) * 100).toFixed(1)
                  : null
                const isOpen = expandedTracker === batch.id
                const ss = STATUS_STYLE[batch.status] || STATUS_STYLE.planned

                return (
                  <React.Fragment key={batch.id}>
                    <motion.tr
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.4) }}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                      style={{ borderBottom: '1px solid rgba(75,77,107,0.15)', cursor: 'default' }}
                    >
                      {/* Batch ID */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', whiteSpace: 'nowrap' }}>
                        {batch.id}
                      </td>
                      {/* Product */}
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#e2e3ed', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {batch.product}
                      </td>
                      {/* Input Material */}
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#9394a5', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {batch.input_material}
                      </td>
                      {/* Input Qty */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#c4c6d0' }}>
                        {batch.input_qty.toLocaleString()}
                      </td>
                      {/* Output Qty */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: batch.output_qty ? '#34d399' : '#6b6e89' }}>
                        {batch.output_qty ? batch.output_qty.toLocaleString() : '—'}
                      </td>
                      {/* Waste */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: batch.waste_qty ? '#f87171' : '#6b6e89' }}>
                        {batch.waste_qty ? batch.waste_qty.toLocaleString() : '—'}
                      </td>
                      {/* Yield */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                        {yieldPct ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 64 }}>
                            <span style={{ color: parseFloat(yieldPct) >= 95 ? '#34d399' : parseFloat(yieldPct) >= 88 ? '#fbbf24' : '#f87171', fontWeight: 600 }}>
                              {yieldPct}%
                            </span>
                            <MiniBar pct={parseFloat(yieldPct)} color={parseFloat(yieldPct) >= 95 ? '#34d399' : parseFloat(yieldPct) >= 88 ? '#f59e0b' : '#ef4444'} />
                          </div>
                        ) : <span style={{ color: '#6b6e89' }}>—</span>}
                      </td>
                      {/* Operator */}
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#9394a5', whiteSpace: 'nowrap' }}>
                        {batch.operator}
                      </td>
                      {/* Status dropdown */}
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={batch.status}
                          onChange={e => updateStatus(batch.id, e.target.value)}
                          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, fontFamily: 'monospace', cursor: 'pointer', outline: 'none', background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}
                        >
                          {['planned','active','paused','completed'].map(s => (
                            <option key={s} value={s} style={{ background: '#1a1b2e', color: '#e2e3ed' }}>{s}</option>
                          ))}
                        </select>
                      </td>
                      {/* Track button */}
                      <td style={{ padding: '12px 14px' }}>
                        <motion.button
                          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                          onClick={() => setExpandedTracker(isOpen ? null : batch.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 500, background: isOpen ? 'rgba(124,58,237,0.2)' : 'rgba(75,77,107,0.15)', border: isOpen ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(75,77,107,0.3)', color: isOpen ? '#a78bfa' : '#9394a5', whiteSpace: 'nowrap' }}
                        >
                          <MapPin size={11} />
                          {batch.trackingLogs.length > 0 ? batch.trackingLogs.length : 'Track'}
                        </motion.button>
                      </td>
                    </motion.tr>

                    {/* ── Inline TrackingMap ── */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <td colSpan={10} style={{ padding: '0 16px 16px' }}>
                            <TrackingMap
                              entityId={batch.id}
                              entityType="manufacturing"
                              entityLabel={`${batch.product} · ${batch.operator}`}
                              initialLogs={batch.trackingLogs}
                            />
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(75,77,107,0.3)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b6e89', fontFamily: 'monospace' }}>
          <span>{batches.length} batches total</span>
          <span>{stats.active} active · {stats.completed} completed</span>
        </div>
      </motion.div>

      {/* ── Create Modal ── */}
      <AnimatePresence>
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(10,11,20,0.82)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 460, background: 'rgba(20,22,38,0.98)', border: '1px solid rgba(75,77,107,0.45)', borderRadius: 20, padding: 24 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#e2e3ed' }}>New Manufacturing Batch</h3>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#6b6e89', cursor: 'pointer', padding: 4 }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Product / Output</label>
                  <input style={inputStyle} value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="e.g. Cotton Yarn Batch" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Input Material</label>
                    <input style={inputStyle} value={form.input_material} onChange={e => setForm({ ...form, input_material: e.target.value })} placeholder="e.g. Cotton Grade A" />
                  </div>
                  <div>
                    <label style={labelStyle}>Input Quantity</label>
                    <input type="number" style={inputStyle} value={form.input_qty} onChange={e => setForm({ ...form, input_qty: e.target.value })} placeholder="500" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Operator</label>
                    <input style={inputStyle} value={form.operator} onChange={e => setForm({ ...form, operator: e.target.value })} placeholder="Operator name" />
                  </div>
                  <div>
                    <label style={labelStyle}>Start Date</label>
                    <input type="date" style={inputStyle} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'transparent', border: '1px solid rgba(75,77,107,0.5)', color: '#9394a5', cursor: 'pointer', fontSize: 13 }}>
                  Cancel
                </button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={handleCreate}
                  disabled={!form.product || !form.input_material || !form.input_qty}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: '#7c3aed', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, opacity: (!form.product || !form.input_material || !form.input_qty) ? 0.45 : 1 }}>
                  Create Batch
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
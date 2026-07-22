import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

const STAGE_ORDER = ['draft', 'sent_to_supplier', 'goods_in_transit', 'received', 'closed']
const STAGE_LABELS = {
  draft: 'Draft',
  sent_to_supplier: 'Sent to Supplier',
  goods_in_transit: 'In Transit',
  received: 'Received',
  closed: 'Closed',
}
const STAGE_COLORS = {
  draft:            { bg: 'rgba(139,148,158,0.15)', color: '#8b949e', glow: '#8b949e' },
  sent_to_supplier: { bg: 'rgba(77,166,255,0.12)',  color: '#4da6ff', glow: '#4da6ff' },
  goods_in_transit: { bg: 'rgba(245,166,35,0.12)',  color: '#f5a623', glow: '#f5a623' },
  received:         { bg: 'rgba(0,200,150,0.12)',   color: '#00c896', glow: '#00c896' },
  closed:           { bg: 'rgba(183,148,244,0.12)', color: '#b794f4', glow: '#b794f4' },
}

function AnimatedCounter({ value, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const target = typeof value === 'number' ? value : 0
    let start = 0
    const duration = 900
    const startTime = performance.now()
    const tick = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (target - start) * ease))
      if (progress < 1) ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(ref.current)
  }, [value])
  return <>{prefix}{display.toLocaleString('en-IN')}{suffix}</>
}

export default function ProcurementDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ totalPOs: 0, pendingValue: 0, activeSuppliers: 0, belowThreshold: 0 })
  const [recentPOs, setRecentPOs] = useState([])
  const [stageBreakdown, setStageBreakdown] = useState([])
  const [belowThresholdItems, setBelowThresholdItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [hoveredRow, setHoveredRow] = useState(null)

  useEffect(() => {
    fetchAll()
    setTimeout(() => setVisible(true), 50)
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [posRes, suppRes, productsRes] = await Promise.all([
      supabase.from('purchase_orders').select('*, suppliers(name), purchase_order_items(quantity_ordered, unit_price)'),
      supabase.from('suppliers').select('id').eq('is_active', true),
      supabase.from('products').select('id, name, quantity, reorder_threshold, reorder_point, unit'),
    ])
    const pos = posRes.data || []
    const suppliers = suppRes.data || []
    const products = productsRes.data || []
    const activePOs = pos.filter(p => p.status !== 'closed')
    const pendingValue = activePOs.reduce((sum, po) => {
      return sum + (po.purchase_order_items || []).reduce((s, i) => s + ((i.quantity_ordered ?? 0) * (i.unit_price ?? 0)), 0)
    }, 0)
    const breakdown = STAGE_ORDER.map(stage => ({ stage, count: pos.filter(p => p.status === stage).length }))
    const below = products.filter(p => p.quantity <= (p.reorder_threshold ?? p.reorder_point ?? 0))
    setStats({ totalPOs: pos.length, pendingValue, activeSuppliers: suppliers.length, belowThreshold: below.length })
    setRecentPOs(pos.slice(0, 8))
    setStageBreakdown(breakdown)
    setBelowThresholdItems(below.slice(0, 5))
    setLoading(false)
  }

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const statCards = [
    { label: 'Total POs',        raw: stats.totalPOs,        display: stats.totalPOs,       icon: '📋', color: '#4da6ff', prefix: '',  suffix: '' },
    { label: 'Pending Value',    raw: stats.pendingValue,     display: stats.pendingValue,   icon: '💰', color: '#00c896', prefix: '₹', suffix: '' },
    { label: 'Active Suppliers', raw: stats.activeSuppliers,  display: stats.activeSuppliers,icon: '🏭', color: '#b794f4', prefix: '',  suffix: '' },
    { label: 'Below Threshold',  raw: stats.belowThreshold,   display: stats.belowThreshold, icon: '⚠',  color: '#f5a623', prefix: '',  suffix: '', alert: stats.belowThreshold > 0 },
  ]

  return (
    <div style={{ padding: '28px 32px', background: '#0d1117', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: '#e6edf3', position: 'relative', overflow: 'hidden' }}>
      {/* Animated background orbs */}
      <div style={{ position: 'fixed', top: -200, right: -200, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,150,0.04) 0%, transparent 70%)', pointerEvents: 'none', animation: 'float 8s ease-in-out infinite' }} />
      <div style={{ position: 'fixed', bottom: -150, left: -150, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(77,166,255,0.04) 0%, transparent 70%)', pointerEvents: 'none', animation: 'float 10s ease-in-out infinite reverse' }} />

      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes barGrow { from{width:0} to{width:var(--bar-w)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes popIn { 0%{transform:scale(0.85);opacity:0} 70%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
        .stat-card { transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease, border-color 0.25s ease !important; }
        .stat-card:hover { transform: translateY(-6px) scale(1.02) !important; }
        .po-row { transition: background 0.15s ease, transform 0.15s ease !important; }
        .po-row:hover { background: #1c2230 !important; transform: translateX(3px) !important; }
        .action-btn { transition: all 0.2s cubic-bezier(.34,1.56,.64,1) !important; }
        .action-btn:hover { transform: scale(1.06) translateY(-1px) !important; }
        .nav-btn { transition: all 0.2s ease !important; }
        .nav-btn:hover { filter: brightness(1.15) !important; transform: translateY(-1px) !important; }
        .pipeline-bar { transition: width 0.8s cubic-bezier(.22,1,.36,1) !important; }
        .threshold-item { transition: background 0.15s ease, padding-left 0.15s ease !important; }
        .threshold-item:hover { background: rgba(245,166,35,0.06) !important; padding-left: 8px !important; }
        .badge-pulse { animation: pulse 2s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(-12px)', transition: 'all 0.5s ease' }}>
        <div>
          <div style={{ fontSize: 11, color: '#00c896', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 6, opacity: 0.8 }}>StockOS</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #e6edf3 0%, #8b949e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Procurement</h1>
          <p style={{ fontSize: 13, color: '#8b949e', marginTop: 5 }}>Purchase orders · Suppliers · Auto-reorder</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="nav-btn action-btn" onClick={() => navigate('/procurement/auto-generate')}
            style={{ background: 'rgba(0,200,150,0.12)', color: '#00c896', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚡</span> Auto-generate POs
          </button>
          <button className="nav-btn action-btn" onClick={() => navigate('/procurement/purchase-orders/new')}
            style={{ background: 'rgba(77,166,255,0.12)', color: '#4da6ff', border: '1px solid rgba(77,166,255,0.3)', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + New PO
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {statCards.map((s, i) => (
          <div key={s.label} className="stat-card"
            style={{ background: '#161b22', border: `1px solid ${s.alert ? 'rgba(245,166,35,0.35)' : '#2a3441'}`, borderRadius: 14, padding: '20px 22px', cursor: 'default', boxShadow: s.alert ? '0 0 24px rgba(245,166,35,0.08)' : 'none', opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: `all 0.5s ease ${i * 0.08}s`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`, opacity: 0.4 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 20, filter: 'grayscale(0.2)' }}>{s.icon}</div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "'Space Mono', monospace", color: s.alert ? '#f5a623' : s.color, lineHeight: 1 }}>
              {loading ? <span style={{ display: 'inline-block', width: 60, height: 28, background: 'linear-gradient(90deg, #2a3441 25%, #3a4451 50%, #2a3441 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 6 }} /> : (
                s.prefix === '₹'
                  ? fmt(s.raw)
                  : <AnimatedCounter value={s.raw} prefix={s.prefix} suffix={s.suffix} />
              )}
            </div>
            {s.alert && <div className="badge-pulse" style={{ position: 'absolute', top: 14, right: 14, width: 7, height: 7, borderRadius: '50%', background: '#f5a623', boxShadow: '0 0 8px #f5a623' }} />}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 }}>
        {/* Recent POs */}
        <div style={{ background: '#161b22', border: '1px solid #2a3441', borderRadius: 14, overflow: 'hidden', opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease 0.35s' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a3441', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.2px' }}>Recent Purchase Orders</span>
            <button onClick={() => navigate('/procurement/purchase-orders')}
              style={{ fontSize: 12, color: '#00c896', background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,200,150,0.16)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,200,150,0.08)'}>
              View all →
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a3441' }}>
                {['PO #', 'Supplier', 'Items', 'Value', 'Status', 'Delivery'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#8b949e', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1c2230' }}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} style={{ padding: '13px 16px' }}>
                        <div style={{ height: 12, width: j === 0 ? 80 : j === 1 ? 100 : 50, background: 'linear-gradient(90deg, #2a3441 25%, #3a4451 50%, #2a3441 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 4, animationDelay: `${i * 0.1}s` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : recentPOs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>No purchase orders yet</td></tr>
              ) : recentPOs.map((po, idx) => {
                const total = (po.purchase_order_items || []).reduce((s, i) => s + ((i.quantity_ordered ?? 0) * (i.unit_price ?? 0)), 0)
                const sc = STAGE_COLORS[po.status] || STAGE_COLORS.draft
                return (
                  <tr key={po.id} className="po-row"
                    onClick={() => navigate(`/procurement/purchase-orders/${po.id}`)}
                    style={{ borderBottom: '1px solid #1c2230', cursor: 'pointer', animation: `fadeSlideIn 0.4s ease ${idx * 0.06}s both` }}>
                    <td style={{ padding: '12px 16px', fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#4da6ff', fontWeight: 600 }}>{po.po_number || `PO-${po.id?.slice(0,6)}`}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{po.suppliers?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#8b949e' }}>{(po.purchase_order_items || []).length}</td>
                    <td style={{ padding: '12px 16px', fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600 }}>{fmt(total)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: sc.bg, color: sc.color, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1px solid ${sc.color}30`, boxShadow: `0 0 8px ${sc.color}15`, whiteSpace: 'nowrap' }}>
                        {STAGE_LABELS[po.status] || po.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#8b949e', fontSize: 12 }}>
                      {po.expected_delivery ? new Date(po.expected_delivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* PO Pipeline */}
          <div style={{ background: '#161b22', border: '1px solid #2a3441', borderRadius: 14, padding: '18px 20px', opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease 0.45s' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18, letterSpacing: '0.2px' }}>PO Pipeline</div>
            {stageBreakdown.map((s, i) => {
              const sc = STAGE_COLORS[s.stage]
              const max = Math.max(...stageBreakdown.map(x => x.count), 1)
              const pct = (s.count / max) * 100
              return (
                <div key={s.stage} style={{ marginBottom: 14 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: '#8b949e' }}>{STAGE_LABELS[s.stage]}</span>
                    <span style={{ fontFamily: "'Space Mono', monospace", color: sc.color, fontWeight: 700 }}>{s.count}</span>
                  </div>
                  <div style={{ height: 5, background: '#2a3441', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: 5, borderRadius: 4, background: `linear-gradient(90deg, ${sc.color}99, ${sc.color})`, width: `${pct}%`, transition: 'width 0.9s cubic-bezier(.22,1,.36,1)', boxShadow: `0 0 6px ${sc.color}60`, transitionDelay: `${i * 0.1}s` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Below threshold */}
          <div style={{ background: '#161b22', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 14, padding: '18px 20px', opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease 0.55s', boxShadow: '0 0 30px rgba(245,166,35,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Below Threshold</div>
              {belowThresholdItems.length > 0 && (
                <button onClick={() => navigate('/procurement/auto-generate')}
                  style={{ fontSize: 11, color: '#f5a623', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,166,35,0.2)'; e.currentTarget.style.transform = 'scale(1.04)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,166,35,0.1)'; e.currentTarget.style.transform = 'scale(1)' }}>
                  ⚡ Auto-generate
                </button>
              )}
            </div>
            {belowThresholdItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                <p style={{ fontSize: 13, color: '#00c896', margin: 0 }}>All items well stocked</p>
              </div>
            ) : belowThresholdItems.map((p, i) => (
              <div key={p.id} className="threshold-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #1c2230', borderRadius: 6, cursor: 'default', animation: `fadeSlideIn 0.4s ease ${i * 0.08}s both` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>Reorder at {p.reorder_threshold ?? p.reorder_point} {p.unit}</div>
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '3px 10px', borderRadius: 8, border: '1px solid rgba(255,107,107,0.2)' }}>{p.quantity}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
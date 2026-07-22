import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const emptyForm = { name: '', contact_email: '', phone: '', lead_time_days: '', product_categories: '', address: '', notes: '' }

const STAGE_COLORS = { draft: '#8b949e', sent_to_supplier: '#4da6ff', goods_in_transit: '#f5a623', received: '#00c896', closed: '#b794f4' }

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [selected, setSelected] = useState(null)
  const [poHistory, setPoHistory] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null)
  const [toast, setToast] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => { fetchSuppliers(); setTimeout(() => setVisible(true), 50) }, [])
  useEffect(() => { if (selected) fetchPOHistory(selected.id) }, [selected])

  async function fetchSuppliers() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data || [])
    setLoading(false)
  }

  async function fetchPOHistory(suppId) {
    const { data } = await supabase.from('purchase_orders')
      .select('*, purchase_order_items(quantity_ordered, unit_price)')
      .eq('supplier_id', suppId).order('created_at', { ascending: false }).limit(10)
    setPoHistory(data || [])
  }

  async function handleSave() {
    if (!form.name) return showToast('Supplier name is required', 'error')
    setSaving(true)
    const payload = { name: form.name, contact_email: form.contact_email || null, phone: form.phone || null, contact_phone: form.phone || null, lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null, product_categories: form.product_categories || null, address: form.address || null, notes: form.notes || null, is_active: true }
    if (editId) {
      await supabase.from('suppliers').update(payload).eq('id', editId)
      showToast('Supplier updated', 'success')
    } else {
      await supabase.from('suppliers').insert({ ...payload, credibility_score: 100 })
      showToast('Supplier added', 'success')
    }
    setSaving(false)
    setShowForm(false)
    setEditId(null)
    setForm(emptyForm)
    fetchSuppliers()
  }

  async function toggleActive(sup) {
    await supabase.from('suppliers').update({ is_active: !sup.is_active }).eq('id', sup.id)
    fetchSuppliers()
    if (selected?.id === sup.id) setSelected(s => ({ ...s, is_active: !s.is_active }))
  }

  function openEdit(sup) {
    setForm({ name: sup.name || '', contact_email: sup.contact_email || '', phone: sup.phone || sup.contact_phone || '', lead_time_days: sup.lead_time_days || '', product_categories: Array.isArray(sup.product_categories) ? sup.product_categories.join(', ') : (sup.product_categories || ''), address: sup.address || '', notes: sup.notes || '' })
    setEditId(sup.id)
    setShowForm(true)
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
  const filtered = suppliers.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || (Array.isArray(s.product_categories) ? s.product_categories.join(' ') : s.product_categories || '').toLowerCase().includes(search.toLowerCase()))
  const scoreColor = (score) => score >= 80 ? '#00c896' : score >= 50 ? '#f5a623' : '#ff6b6b'

  return (
    <div style={{ padding: '28px 32px', background: '#0d1117', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: '#e6edf3' }}>
      <style>{`
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn { 0%{transform:scale(0.9);opacity:0} 70%{transform:scale(1.03)} 100%{transform:scale(1);opacity:1} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .supp-row { transition: background 0.15s ease, transform 0.15s ease !important; }
        .supp-row:hover { background: #1a1f29 !important; transform: translateX(2px) !important; }
        .supp-row-selected { background: #1c2230 !important; border-left: 3px solid #00c896 !important; }
        .action-btn { transition: all 0.2s cubic-bezier(.34,1.56,.64,1) !important; }
        .action-btn:hover { transform: scale(1.06) !important; }
        .detail-panel { animation: fadeSlideIn 0.4s ease both !important; }
        .score-bar-fill { transition: width 1s cubic-bezier(.22,1,.36,1) !important; }
        .toggle-btn { transition: all 0.2s ease !important; }
        .toggle-btn:hover { opacity: 0.85 !important; transform: scale(1.03) !important; }
        .input-focus { transition: border-color 0.2s ease, box-shadow 0.2s ease !important; }
        .input-focus:focus { border-color: rgba(0,200,150,0.45) !important; box-shadow: 0 0 0 3px rgba(0,200,150,0.1) !important; outline: none !important; }
        .add-btn-main { transition: all 0.25s cubic-bezier(.34,1.56,.64,1) !important; }
        .add-btn-main:hover { transform: translateY(-2px) scale(1.03) !important; box-shadow: 0 6px 20px rgba(0,200,150,0.25) !important; }
        .po-hist-row { transition: background 0.15s ease !important; }
        .po-hist-row:hover { background: rgba(255,255,255,0.02) !important; }
        .avatar-badge { transition: transform 0.2s ease !important; }
        .supp-row:hover .avatar-badge { transform: scale(1.08) !important; }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(-10px)', transition: 'all 0.4s ease' }}>
        <div>
          <div style={{ fontSize: 11, color: '#00c896', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: 4, opacity: 0.8 }}>StockOS</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #e6edf3, #8b949e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Suppliers</h1>
          <p style={{ fontSize: 13, color: '#8b949e', marginTop: 4 }}>{suppliers.filter(s => s.is_active).length} active · {suppliers.filter(s => !s.is_active).length} inactive</p>
        </div>
        <button className="add-btn-main" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm) }}
          style={{ background: 'rgba(0,200,150,0.15)', color: '#00c896', border: '1px solid rgba(0,200,150,0.4)', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Add Supplier
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div style={{ background: '#161b22', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 16, padding: '22px 26px', marginBottom: 20, animation: 'slideDown 0.35s ease both', boxShadow: '0 8px 32px rgba(0,200,150,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editId ? 'Edit Supplier' : 'New Supplier'}</h3>
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              style={{ background: 'rgba(139,148,158,0.1)', border: '1px solid #2a3441', color: '#8b949e', cursor: 'pointer', width: 32, height: 32, borderRadius: 8, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,148,158,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,148,158,0.1)'}>
              ×
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { key: 'name', label: 'Supplier Name *', placeholder: 'e.g. Rajesh Textiles' },
              { key: 'contact_email', label: 'Email', placeholder: 'contact@supplier.com' },
              { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
              { key: 'lead_time_days', label: 'Lead Time (days)', placeholder: '7', type: 'number' },
              { key: 'product_categories', label: 'Product Categories', placeholder: 'Cotton, Denim, Linen' },
              { key: 'address', label: 'Address', placeholder: 'City, State' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{f.label}</div>
                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} className="input-focus"
                  style={{ background: '#1c2230', border: '1px solid #2a3441', borderRadius: 8, padding: '9px 12px', color: '#e6edf3', fontSize: 13, width: '100%', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</div>
            <textarea value={form.notes} onChange={e => setForm(fm => ({ ...fm, notes: e.target.value }))} rows={2} placeholder="Optional notes..." className="input-focus"
              style={{ background: '#1c2230', border: '1px solid #2a3441', borderRadius: 8, padding: '9px 12px', color: '#e6edf3', fontSize: 13, width: '100%', resize: 'vertical', height: 60, fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              style={{ background: 'rgba(139,148,158,0.1)', color: '#8b949e', border: '1px solid #2a3441', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,148,158,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,148,158,0.1)'}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="add-btn-main"
              style={{ background: 'rgba(0,200,150,0.15)', color: '#00c896', border: '1px solid rgba(0,200,150,0.4)', borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : editId ? 'Update Supplier' : 'Add Supplier'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 18, opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease 0.15s' }}>
        {/* Supplier list */}
        <div style={{ background: '#161b22', border: '1px solid #2a3441', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #2a3441', background: 'rgba(255,255,255,0.01)' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers or categories..." className="input-focus"
              style={{ background: '#1c2230', border: '1px solid #2a3441', borderRadius: 9, padding: '8px 14px', color: '#e6edf3', fontSize: 13, width: 300, fontFamily: "'DM Sans', sans-serif" }} />
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
              <div style={{ width: 30, height: 30, border: '3px solid #2a3441', borderTopColor: '#00c896', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
              Loading suppliers...
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a3441', background: 'rgba(255,255,255,0.01)' }}>
                  {['Supplier', 'Categories', 'Lead Time', 'Credibility', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#8b949e', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#8b949e' }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>🏭</div>
                    No suppliers found
                  </td></tr>
                ) : filtered.map((sup, i) => {
                  const score = sup.credibility_score ?? 100
                  const isSelected = selected?.id === sup.id
                  const cats = Array.isArray(sup.product_categories) ? sup.product_categories.join(', ') : (sup.product_categories || '—')
                  return (
                    <tr key={sup.id} className={`supp-row ${isSelected ? 'supp-row-selected' : ''}`}
                      onClick={() => setSelected(isSelected ? null : sup)}
                      style={{ borderBottom: '1px solid #1c2230', cursor: 'pointer', background: isSelected ? '#1c2230' : 'transparent', animation: `fadeSlideIn 0.35s ease ${i * 0.05}s both`, borderLeft: isSelected ? '3px solid #00c896' : '3px solid transparent' }}>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <div className="avatar-badge" style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, rgba(0,200,150,0.2), rgba(0,200,150,0.08))`, border: '1px solid rgba(0,200,150,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#00c896', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,200,150,0.15)' }}>
                            {sup.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{sup.name}</div>
                            {sup.contact_email && <div style={{ fontSize: 11, color: '#8b949e', marginTop: 1 }}>{sup.contact_email}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px', color: '#8b949e', fontSize: 12 }}>{cats}</td>
                      <td style={{ padding: '13px 16px', fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600 }}>
                        {sup.lead_time_days ? `${sup.lead_time_days}d` : '—'}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: '#2a3441', borderRadius: 4, maxWidth: 72, overflow: 'hidden' }}>
                            <div className="score-bar-fill" style={{ height: 5, borderRadius: 4, background: `linear-gradient(90deg, ${scoreColor(score)}80, ${scoreColor(score)})`, width: `${score}%`, boxShadow: `0 0 6px ${scoreColor(score)}60` }} />
                          </div>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: scoreColor(score), fontWeight: 700, minWidth: 38 }}>{score}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ background: sup.is_active ? 'rgba(0,200,150,0.1)' : 'rgba(139,148,158,0.1)', color: sup.is_active ? '#00c896' : '#8b949e', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1px solid ${sup.is_active ? 'rgba(0,200,150,0.25)' : '#2a3441'}` }}>
                          {sup.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '13px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="action-btn" onClick={() => openEdit(sup)}
                            style={{ fontSize: 11, color: '#4da6ff', background: 'rgba(77,166,255,0.08)', border: '1px solid rgba(77,166,255,0.2)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
                            Edit
                          </button>
                          <button className="toggle-btn" onClick={() => toggleActive(sup)}
                            style={{ fontSize: 11, color: '#8b949e', background: 'rgba(139,148,158,0.08)', border: '1px solid rgba(139,148,158,0.2)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
                            {sup.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Supplier detail panel */}
        {selected && (
          <div className="detail-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Score card */}
            <div style={{ background: '#161b22', border: '1px solid #2a3441', borderRadius: 14, padding: '22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${scoreColor(selected.credibility_score ?? 100)}, transparent)` }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,200,150,0.2), rgba(0,200,150,0.06))', border: '1px solid rgba(0,200,150,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#00c896', marginBottom: 10 }}>
                    {selected.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: '#8b949e', marginTop: 3 }}>
                    {Array.isArray(selected.product_categories) ? selected.product_categories.join(', ') : (selected.product_categories || 'No categories')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Space Mono', monospace", color: scoreColor(selected.credibility_score ?? 100), lineHeight: 1 }}>
                    {selected.credibility_score ?? 100}%
                  </div>
                  <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>credibility score</div>
                  <div style={{ width: 80, height: 4, background: '#2a3441', borderRadius: 4, overflow: 'hidden', marginTop: 8, marginLeft: 'auto' }}>
                    <div style={{ height: 4, borderRadius: 4, background: scoreColor(selected.credibility_score ?? 100), width: `${selected.credibility_score ?? 100}%`, transition: 'width 1s ease', boxShadow: `0 0 6px ${scoreColor(selected.credibility_score ?? 100)}80` }} />
                  </div>
                </div>
              </div>

              {[
                { label: 'Email', value: selected.contact_email || '—' },
                { label: 'Phone', value: selected.phone || selected.contact_phone || '—' },
                { label: 'Lead Time', value: selected.lead_time_days ? `${selected.lead_time_days} days` : '—' },
                { label: 'Address', value: selected.address || '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1c2230', fontSize: 13 }}>
                  <span style={{ color: '#8b949e' }}>{r.label}</span>
                  <span style={{ fontWeight: 500 }}>{r.value}</span>
                </div>
              ))}
              {selected.notes && <p style={{ marginTop: 14, fontSize: 12, color: '#8b949e', lineHeight: 1.7, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid #2a3441' }}>{selected.notes}</p>}
            </div>

            {/* PO History */}
            <div style={{ background: '#161b22', border: '1px solid #2a3441', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #2a3441', fontWeight: 700, fontSize: 14, background: 'rgba(255,255,255,0.01)' }}>PO History</div>
              {poHistory.length === 0 ? (
                <div style={{ padding: 24, color: '#8b949e', fontSize: 13, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>📦</div>
                  No orders yet
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #2a3441' }}>
                      {['PO #', 'Value', 'Status', 'Date'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: '#8b949e', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {poHistory.map((po, i) => {
                      const total = (po.purchase_order_items || []).reduce((s, item) => s + ((item.quantity_ordered ?? 0) * (item.unit_price ?? 0)), 0)
                      return (
                        <tr key={po.id} className="po-hist-row" style={{ borderBottom: '1px solid #1c2230', animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both` }}>
                          <td style={{ padding: '9px 14px', fontFamily: "'Space Mono', monospace", color: '#4da6ff', fontWeight: 600 }}>{po.po_number || po.id?.slice(0, 8)}</td>
                          <td style={{ padding: '9px 14px', fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>{fmt(total)}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <span style={{ color: STAGE_COLORS[po.status] || '#8b949e', fontSize: 11, fontWeight: 600, background: `${STAGE_COLORS[po.status] || '#8b949e'}15`, padding: '2px 8px', borderRadius: 8 }}>
                              {po.status?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '9px 14px', color: '#8b949e' }}>{new Date(po.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Toast({ msg, type }) {
  const color = type === 'error' ? '#ff6b6b' : '#00c896'
  return (
    <div style={{ position: 'fixed', top: 24, right: 28, background: '#161b22', border: `1px solid ${color}50`, borderRadius: 12, padding: '13px 20px', color, fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: `0 8px 32px ${color}20`, animation: 'popIn 0.3s ease both', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>{type === 'error' ? '⚠' : '✓'}</span> {msg}
    </div>
  )
}
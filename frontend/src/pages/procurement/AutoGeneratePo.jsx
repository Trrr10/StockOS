import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function AutoGeneratePO() {
  const navigate = useNavigate()
  const [belowThreshold, setBelowThreshold] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(null)
  const [toast, setToast] = useState(null)
  const [generated, setGenerated] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => { fetchData(); setTimeout(() => setVisible(true), 50) }, [])

  async function fetchData() {
    setLoading(true)
    const [prodRes, suppRes] = await Promise.all([
      supabase.from('products').select('*, suppliers(id, name, lead_time_days)'),
      supabase.from('suppliers').select('id, name, lead_time_days, credibility_score, product_categories').eq('is_active', true),
    ])
    const prods = (prodRes.data || []).filter(p => p.quantity <= (p.reorder_threshold ?? p.reorder_point ?? 0))
    setBelowThreshold(prods)
    setSuppliers(suppRes.data || [])
    setLoading(false)
  }

  async function generateWithGroq() {
    if (belowThreshold.length === 0) return showToast('No items below threshold', 'error')
    setGenerating(true)

    const itemsSummary = belowThreshold.map(p => ({
      name: p.name, sku: p.product_code, current_stock: p.quantity,
      reorder_point: p.reorder_threshold ?? p.reorder_point,
      reorder_quantity: p.reorder_quantity || ((p.reorder_threshold ?? p.reorder_point ?? 10) * 2),
      unit: p.unit, preferred_supplier_id: p.preferred_supplier_id || p.supplier_id || null,
    }))

    const suppliersSummary = suppliers.map(s => ({
      id: s.id, name: s.name, lead_time_days: s.lead_time_days,
      credibility_score: s.credibility_score,
      product_categories: Array.isArray(s.product_categories) ? s.product_categories.join(', ') : (s.product_categories || ''),
    }))

    const prompt = `You are a procurement assistant for an inventory management system. Generate purchase order drafts for the following items that are below their reorder threshold.

Items below threshold:
${JSON.stringify(itemsSummary, null, 2)}

Available suppliers:
${JSON.stringify(suppliersSummary, null, 2)}

Rules:
1. Group items by supplier where sensible
2. Suggested quantity = reorder_quantity or 2x reorder_point if not set
3. Pick the best supplier based on credibility score and matching product categories
4. If preferred_supplier_id is set, prefer that supplier
5. Return ONLY valid JSON — no markdown, no explanation.

Return this exact JSON format:
{
  "purchase_orders": [
    {
      "supplier_id": "<uuid>",
      "supplier_name": "<name>",
      "suggested_delivery_days": <number>,
      "reasoning": "<1 sentence>",
      "items": [
        { "product_name": "<name>", "sku": "<sku>", "suggested_quantity": <number>, "estimated_unit_price": <number> }
      ]
    }
  ]
}`

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}` },
        body: JSON.stringify({ model: 'llama3-8b-8192', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 1500 }),
      })
      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content || ''
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      const draftsWithProducts = parsed.purchase_orders.map(po => ({
        ...po,
        items: po.items.map(item => {
          const match = belowThreshold.find(p => p.name === item.product_name || p.product_code === item.sku)
          return { ...item, product_id: match?.id }
        }),
      }))
      setDrafts(draftsWithProducts)
      setGenerated(true)
      showToast(`${draftsWithProducts.length} PO draft(s) generated`, 'success')
    } catch (err) {
      console.error(err)
      showToast('Groq error — using fallback suggestions', 'error')
      setDrafts(buildFallbackDrafts())
      setGenerated(true)
    }
    setGenerating(false)
  }

  function buildFallbackDrafts() {
    const bySupplier = {}
    belowThreshold.forEach(p => {
      const suppId = p.preferred_supplier_id || p.supplier_id || suppliers[0]?.id
      const supp = suppliers.find(s => s.id === suppId) || suppliers[0]
      if (!suppId || !supp) return
      if (!bySupplier[suppId]) bySupplier[suppId] = { supplier_id: suppId, supplier_name: supp.name, suggested_delivery_days: supp.lead_time_days || 7, reasoning: 'Auto-grouped by preferred supplier', items: [] }
      bySupplier[suppId].items.push({ product_name: p.name, sku: p.product_code, product_id: p.id, suggested_quantity: p.reorder_quantity || Math.max((p.reorder_threshold ?? p.reorder_point ?? 10) * 2, 10), estimated_unit_price: p.unit_price || 0 })
    })
    return Object.values(bySupplier)
  }

  async function approveDraft(draft, idx) {
    setApproving(idx)
    const poNum = `PO-${Date.now().toString().slice(-6)}`
    const deliveryDate = new Date()
    deliveryDate.setDate(deliveryDate.getDate() + (draft.suggested_delivery_days || 7))
    const { data: po, error } = await supabase.from('purchase_orders').insert({
      po_number: poNum, supplier_id: draft.supplier_id, status: 'draft',
      expected_delivery: deliveryDate.toISOString().split('T')[0],
      notes: `Auto-generated: ${draft.reasoning}`,
    }).select().single()
    if (error) { showToast('Failed to create PO', 'error'); setApproving(null); return }
    const itemRows = draft.items.filter(i => i.product_id).map(i => ({
      po_id: po.id,
      product_id: i.product_id,
      quantity_ordered: i.suggested_quantity,   // ← fixed: was quantity_ordered missing
      unit_price: i.estimated_unit_price || 0,
      received_quantity: 0,
    }))
    await supabase.from('purchase_order_items').insert(itemRows)
    showToast(`${poNum} created & sent to pipeline`, 'success')
    setDrafts(d => d.filter((_, i) => i !== idx))
    setApproving(null)
    if (drafts.length === 1) setTimeout(() => navigate('/procurement/purchase-orders'), 1200)
  }

  function updateDraftQty(draftIdx, itemIdx, qty) {
    setDrafts(ds => ds.map((d, di) => di !== draftIdx ? d : { ...d, items: d.items.map((it, ii) => ii !== itemIdx ? it : { ...it, suggested_quantity: Number(qty) }) }))
  }
  function updateDraftPrice(draftIdx, itemIdx, price) {
    setDrafts(ds => ds.map((d, di) => di !== draftIdx ? d : { ...d, items: d.items.map((it, ii) => ii !== itemIdx ? it : { ...it, estimated_unit_price: Number(price) }) }))
  }
  function updateDraftSupplier(draftIdx, suppId) {
    const supp = suppliers.find(s => s.id === suppId)
    setDrafts(ds => ds.map((d, di) => di !== draftIdx ? d : { ...d, supplier_id: suppId, supplier_name: supp?.name || '' }))
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
  const scoreColor = (s) => s >= 80 ? '#00c896' : s >= 50 ? '#f5a623' : '#ff6b6b'

  return (
    <div style={{ padding: '28px 32px', background: '#0d1117', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: '#e6edf3', position: 'relative' }}>
      <style>{`
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes popIn { 0%{transform:scale(0.9);opacity:0} 70%{transform:scale(1.03)} 100%{transform:scale(1);opacity:1} }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(0.97)} }
        .threshold-row:hover { background: rgba(245,166,35,0.04) !important; }
        .draft-card { transition: box-shadow 0.3s ease, border-color 0.3s ease !important; }
        .draft-card:hover { box-shadow: 0 8px 32px rgba(0,200,150,0.08) !important; border-color: rgba(0,200,150,0.35) !important; }
        .approve-btn { transition: all 0.25s cubic-bezier(.34,1.56,.64,1) !important; }
        .approve-btn:hover:not(:disabled) { transform: scale(1.05) translateY(-1px) !important; box-shadow: 0 4px 16px rgba(0,200,150,0.25) !important; }
        .gen-btn { transition: all 0.25s cubic-bezier(.34,1.56,.64,1) !important; }
        .gen-btn:hover:not(:disabled) { transform: scale(1.04) translateY(-1px) !important; box-shadow: 0 4px 20px rgba(0,200,150,0.3) !important; }
        .draft-item-row { transition: background 0.15s ease !important; }
        .draft-item-row:hover { background: rgba(0,200,150,0.03) !important; }
        .num-input { transition: border-color 0.2s ease, box-shadow 0.2s ease !important; }
        .num-input:focus { border-color: rgba(0,200,150,0.5) !important; box-shadow: 0 0 0 3px rgba(0,200,150,0.1) !important; outline: none !important; }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}>
        <button onClick={() => navigate('/procurement')}
          style={{ background: 'rgba(139,148,158,0.1)', border: '1px solid #2a3441', color: '#8b949e', cursor: 'pointer', fontSize: 18, width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,148,158,0.2)'; e.currentTarget.style.color = '#e6edf3' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,148,158,0.1)'; e.currentTarget.style.color = '#8b949e' }}>
          ←
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #e6edf3, #8b949e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Auto-Generate Purchase Orders
          </h1>
          <p style={{ fontSize: 13, color: '#8b949e', marginTop: 4 }}>AI-suggested POs for items below reorder threshold</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#8b949e' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #2a3441', borderTopColor: '#00c896', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          Loading inventory data...
        </div>
      ) : belowThreshold.length === 0 ? (
        <div style={{ background: '#161b22', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 16, padding: 60, textAlign: 'center', animation: 'popIn 0.5s ease both' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#00c896', marginBottom: 8 }}>All items well stocked</div>
          <div style={{ fontSize: 13, color: '#8b949e' }}>No products are currently below their reorder threshold</div>
        </div>
      ) : (
        <>
          {/* Below threshold table */}
          <div style={{ background: '#161b22', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 16, overflow: 'hidden', marginBottom: 24, animation: 'fadeSlideUp 0.5s ease both', boxShadow: '0 4px 24px rgba(245,166,35,0.04)' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #2a3441', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(245,166,35,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: 'rgba(245,166,35,0.15)', color: '#f5a623', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: '1px solid rgba(245,166,35,0.25)' }}>
                  {belowThreshold.length} items
                </span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Below Reorder Threshold</span>
              </div>
              {!generated && (
                <button className="gen-btn" onClick={generateWithGroq} disabled={generating}
                  style={{ background: generating ? 'rgba(0,200,150,0.08)' : 'rgba(0,200,150,0.15)', color: '#00c896', border: '1px solid rgba(0,200,150,0.4)', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {generating ? (
                    <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(0,200,150,0.3)', borderTopColor: '#00c896', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Generating...</>
                  ) : <><span style={{ fontSize: 16 }}>⚡</span> Generate POs with AI</>}
                </button>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a3441' }}>
                  {['Product', 'Current Stock', 'Reorder At', 'Deficit', 'Suggested Reorder Qty'].map(h => (
                    <th key={h} style={{ padding: '10px 18px', textAlign: 'left', color: '#8b949e', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {belowThreshold.map((p, i) => {
                  const threshold = p.reorder_threshold ?? p.reorder_point ?? 0
                  const deficit = threshold - p.quantity
                  return (
                    <tr key={p.id} className="threshold-row" style={{ borderBottom: '1px solid #1c2230', transition: 'background 0.15s ease', animation: `fadeSlideIn 0.4s ease ${i * 0.06}s both` }}>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {p.product_code && <div style={{ fontSize: 11, color: '#8b949e', fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{p.product_code}</div>}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ fontFamily: "'Space Mono', monospace", color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '3px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,107,107,0.2)' }}>
                          {p.quantity} {p.unit}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', fontFamily: "'Space Mono', monospace", color: '#f5a623', fontSize: 13 }}>{threshold} {p.unit}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ fontFamily: "'Space Mono', monospace", color: '#ff6b6b', fontWeight: 700, fontSize: 13 }}>-{deficit} {p.unit}</span>
                      </td>
                      <td style={{ padding: '12px 18px', fontFamily: "'Space Mono', monospace", color: '#8b949e', fontSize: 13 }}>
                        {p.reorder_quantity || Math.max(threshold * 2, 10)} {p.unit}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Generated drafts */}
          {drafts.length > 0 && (
            <div style={{ animation: 'fadeSlideUp 0.5s ease both' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#00c896', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(0,200,150,0.15)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 20, padding: '2px 12px', fontSize: 12 }}>
                  {drafts.length} PO Draft{drafts.length > 1 ? 's' : ''}
                </span>
                Ready for Approval
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {drafts.map((draft, di) => {
                  const supp = suppliers.find(s => s.id === draft.supplier_id)
                  const total = draft.items.reduce((s, i) => s + (i.suggested_quantity * (i.estimated_unit_price || 0)), 0)
                  return (
                    <div key={di} className="draft-card"
                      style={{ background: '#161b22', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 16, overflow: 'hidden', animation: `popIn 0.4s ease ${di * 0.12}s both` }}>
                      <div style={{ padding: '18px 22px', borderBottom: '1px solid #2a3441', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'rgba(0,200,150,0.02)' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{draft.supplier_name}</div>
                            {supp?.credibility_score && (
                              <span style={{ fontSize: 11, color: scoreColor(supp.credibility_score), background: `${scoreColor(supp.credibility_score)}15`, padding: '3px 10px', borderRadius: 12, border: `1px solid ${scoreColor(supp.credibility_score)}30`, fontWeight: 600 }}>
                                {supp.credibility_score}% credibility
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 10 }}>
                            {draft.reasoning} · Est. delivery in <strong style={{ color: '#e6edf3' }}>{draft.suggested_delivery_days} days</strong>
                          </div>
                          <select value={draft.supplier_id} onChange={e => updateDraftSupplier(di, e.target.value)}
                            style={{ background: '#1c2230', border: '1px solid #2a3441', borderRadius: 8, padding: '7px 12px', color: '#e6edf3', fontSize: 12, width: 230, fontFamily: "'DM Sans', sans-serif", outline: 'none', cursor: 'pointer', transition: 'border-color 0.2s ease' }}
                            onFocus={e => e.target.style.borderColor = 'rgba(0,200,150,0.4)'}
                            onBlur={e => e.target.style.borderColor = '#2a3441'}>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Space Mono', monospace", color: '#00c896' }}>{fmt(total)}</div>
                          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 10 }}>{draft.items.length} item{draft.items.length > 1 ? 's' : ''}</div>
                          <button className="approve-btn" onClick={() => approveDraft(draft, di)} disabled={approving === di}
                            style={{ background: 'rgba(0,200,150,0.15)', color: '#00c896', border: '1px solid rgba(0,200,150,0.4)', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: approving === di ? 'not-allowed' : 'pointer', opacity: approving === di ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {approving === di ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(0,200,150,0.3)', borderTopColor: '#00c896', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Creating...</> : <>✓ Approve & Create</>}
                          </button>
                        </div>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #2a3441' }}>
                            {['Product', 'Quantity', 'Unit Price', 'Subtotal'].map(h => (
                              <th key={h} style={{ padding: '9px 18px', textAlign: 'left', color: '#8b949e', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {draft.items.map((item, ii) => (
                            <tr key={ii} className="draft-item-row" style={{ borderBottom: '1px solid #1c2230' }}>
                              <td style={{ padding: '10px 18px', fontWeight: 500 }}>
                                {item.product_name}
                                {!item.product_id && <span style={{ fontSize: 10, color: '#ff6b6b', marginLeft: 8, background: 'rgba(255,107,107,0.1)', padding: '1px 6px', borderRadius: 4 }}>⚠ not matched</span>}
                              </td>
                              <td style={{ padding: '10px 18px' }}>
                                <input type="number" min="1" value={item.suggested_quantity} onChange={e => updateDraftQty(di, ii, e.target.value)} className="num-input"
                                  style={{ background: '#1c2230', border: '1px solid #2a3441', borderRadius: 8, padding: '6px 10px', color: '#e6edf3', fontSize: 13, width: 80, fontFamily: "'Space Mono', monospace" }} />
                              </td>
                              <td style={{ padding: '10px 18px' }}>
                                <input type="number" min="0" value={item.estimated_unit_price || ''} onChange={e => updateDraftPrice(di, ii, e.target.value)} placeholder="0" className="num-input"
                                  style={{ background: '#1c2230', border: '1px solid #2a3441', borderRadius: 8, padding: '6px 10px', color: '#e6edf3', fontSize: 13, width: 100, fontFamily: "'Space Mono', monospace" }} />
                              </td>
                              <td style={{ padding: '10px 18px', fontFamily: "'Space Mono', monospace", color: '#00c896', fontWeight: 700 }}>
                                {fmt(item.suggested_quantity * (item.estimated_unit_price || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Toast({ msg, type }) {
  const color = type === 'error' ? '#ff6b6b' : '#00c896'
  return (
    <div style={{ position: 'fixed', top: 24, right: 28, background: '#161b22', border: `1px solid ${color}50`, borderRadius: 12, padding: '13px 20px', color, fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: `0 8px 32px ${color}20`, animation: 'popIn 0.3s ease both', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16 }}>{type === 'error' ? '⚠' : '✓'}</span>
      {msg}
    </div>
  )
}
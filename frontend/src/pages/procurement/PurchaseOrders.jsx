import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, useParams } from 'react-router-dom'

const STAGES = ['draft', 'sent_to_supplier', 'goods_in_transit', 'received', 'closed']
const STAGE_LABELS = {
  draft: 'Draft', sent_to_supplier: 'Sent to Supplier',
  goods_in_transit: 'In Transit', received: 'Received', closed: 'Closed',
}
const STAGE_COLORS = {
  draft:            { bg: 'rgba(139,148,158,0.15)', color: '#8b949e', border: 'rgba(139,148,158,0.3)' },
  sent_to_supplier: { bg: 'rgba(77,166,255,0.12)',  color: '#4da6ff', border: 'rgba(77,166,255,0.3)' },
  goods_in_transit: { bg: 'rgba(245,166,35,0.12)',  color: '#f5a623', border: 'rgba(245,166,35,0.3)' },
  received:         { bg: 'rgba(0,200,150,0.12)',   color: '#00c896', border: 'rgba(0,200,150,0.3)' },
  closed:           { bg: 'rgba(183,148,244,0.12)', color: '#b794f4', border: 'rgba(183,148,244,0.3)' },
}

const emptyForm = {
  supplier_id: '', expected_delivery: '', notes: '',
  items: [{ product_id: '', quantity: '', unit_price: '', received_qty: '' }],
}

const GLOBAL_STYLES = `
  @keyframes fadeSlideUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeSlideIn { from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:translateX(0)} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes popIn { 0%{transform:scale(0.9);opacity:0} 70%{transform:scale(1.03)} 100%{transform:scale(1);opacity:1} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
  .po-row-hover { transition: background 0.15s ease, transform 0.15s ease !important; }
  .po-row-hover:hover { background: #1c2230 !important; transform: translateX(3px) !important; }
  .stage-btn { transition: all 0.2s cubic-bezier(.34,1.56,.64,1) !important; }
  .stage-btn:hover { transform: scale(1.06) translateY(-1px) !important; }
  .filter-btn { transition: all 0.2s ease !important; }
  .filter-btn:hover { filter: brightness(1.2) !important; }
  .action-btn-main { transition: all 0.25s cubic-bezier(.34,1.56,.64,1) !important; }
  .action-btn-main:hover { transform: translateY(-2px) scale(1.03) !important; box-shadow: 0 6px 20px rgba(0,200,150,0.25) !important; }
  .input-anim { transition: border-color 0.2s ease, box-shadow 0.2s ease !important; }
  .input-anim:focus { border-color: rgba(0,200,150,0.45) !important; box-shadow: 0 0 0 3px rgba(0,200,150,0.1) !important; outline: none !important; }
  .stage-node { transition: all 0.4s cubic-bezier(.34,1.56,.64,1) !important; }
  .stage-connector { transition: background 0.6s ease !important; }
  .back-btn { transition: all 0.2s ease !important; }
  .back-btn:hover { background: rgba(139,148,158,0.2) !important; color: #e6edf3 !important; }
`

export default function PurchaseOrders() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isNew = id === 'new'
  const isDetail = !!id && !isNew

  const [pos, setPOs] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(emptyForm)
  const [detail, setDetail] = useState(null)
  const [partialMode, setPartialMode] = useState(false)
  const [partialQtys, setPartialQtys] = useState({})
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => { fetchMeta(); setTimeout(() => setVisible(true), 50) }, [])
  useEffect(() => { fetchPOs() }, [filter])
  useEffect(() => { if (isDetail) fetchDetail(id) }, [id])

  async function fetchMeta() {
    const [s, p] = await Promise.all([
      supabase.from('suppliers').select('id, name').eq('is_active', true),
      supabase.from('products').select('id, name, unit, unit_price'),
    ])
    setSuppliers(s.data || [])
    setProducts(p.data || [])
  }

  async function fetchPOs() {
    setLoading(true)
    let q = supabase.from('purchase_orders')
      .select('*, suppliers(name), purchase_order_items(id, quantity_ordered, unit_price, received_quantity, products(name))')
      .order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setPOs(data || [])
    setLoading(false)
  }

  async function fetchDetail(poId) {
    const { data } = await supabase.from('purchase_orders')
      .select('*, suppliers(*), purchase_order_items(*, products(name, unit))')
      .eq('id', poId).single()
    setDetail(data)
    if (data) {
      const initQtys = {}
      data.purchase_order_items?.forEach(i => { initQtys[i.id] = i.received_quantity || 0 })
      setPartialQtys(initQtys)
    }
  }

  async function handleSave() {
    if (!form.supplier_id) return showToast('Select a supplier', 'error')
    const validItems = form.items.filter(i => i.product_id && i.quantity && i.unit_price)
    if (validItems.length === 0) return showToast('Add at least one item', 'error')
    setSaving(true)
    const poNum = `PO-${Date.now().toString().slice(-6)}`
    const { data: po, error } = await supabase.from('purchase_orders').insert({
      po_number: poNum, supplier_id: form.supplier_id, status: 'draft',
      expected_delivery: form.expected_delivery || null, notes: form.notes || null,
    }).select().single()
    if (error) { showToast('Failed to create PO', 'error'); setSaving(false); return }
    await supabase.from('purchase_order_items').insert(
      validItems.map(i => ({ po_id: po.id, product_id: i.product_id, quantity_ordered: Number(i.quantity), unit_price: Number(i.unit_price), received_quantity: 0 }))
    )
    showToast(`${poNum} created`, 'success')
    setSaving(false)
    setForm(emptyForm)
    navigate('/procurement/purchase-orders')
    fetchPOs()
  }

  async function advanceStage(po) {
    const idx = STAGES.indexOf(po.status)
    if (idx >= STAGES.length - 1) return
    const next = STAGES[idx + 1]
    await supabase.from('purchase_orders').update({ status: next }).eq('id', po.id)
    if (next === 'received') await handleFullReceive(po)
    showToast(`Moved to ${STAGE_LABELS[next]}`, 'success')
    fetchPOs()
    if (isDetail) fetchDetail(po.id)
  }

  async function handleFullReceive(po) {
    const items = po.purchase_order_items || detail?.purchase_order_items || []
    for (const item of items) {
      await supabase.from('purchase_order_items').update({ received_quantity: item.quantity_ordered }).eq('id', item.id)
      await supabase.from('stock_movements').insert({ product_id: item.product_id, movement_type: 'purchase_received', quantity: item.quantity_ordered, reference_id: po.id, notes: `PO ${po.po_number} fully received` })
      await supabase.rpc('increment_stock', { p_product_id: item.product_id, p_qty: item.quantity_ordered }).catch(() => null)
    }
    await updateSupplierScore(po.supplier_id)
  }

  async function handlePartialReceive() {
    if (!detail) return
    setSaving(true)
    for (const [itemId, qty] of Object.entries(partialQtys)) {
      const item = detail.purchase_order_items?.find(i => i.id === itemId)
      if (!item || qty <= 0) continue
      await supabase.from('purchase_order_items').update({ received_quantity: Number(qty) }).eq('id', itemId)
      await supabase.from('stock_movements').insert({ product_id: item.product_id, movement_type: 'purchase_received', quantity: Number(qty), reference_id: detail.id, notes: `PO ${detail.po_number} partial delivery` })
      await supabase.rpc('increment_stock', { p_product_id: item.product_id, p_qty: Number(qty) }).catch(() => null)
    }
    const allReceived = detail.purchase_order_items?.every(i => (partialQtys[i.id] || 0) >= i.quantity_ordered)
    if (allReceived) {
      await supabase.from('purchase_orders').update({ status: 'received' }).eq('id', detail.id)
      await updateSupplierScore(detail.supplier_id)
    }
    showToast('Partial delivery recorded', 'success')
    setPartialMode(false)
    setSaving(false)
    fetchDetail(detail.id)
    fetchPOs()
  }

  async function updateSupplierScore(supplierId) {
    const { data: allPos } = await supabase.from('purchase_orders').select('expected_delivery, created_at, status').eq('supplier_id', supplierId).eq('status', 'received')
    if (!allPos?.length) return
    const onTime = allPos.filter(p => p.expected_delivery && new Date(p.created_at) <= new Date(p.expected_delivery)).length
    await supabase.from('suppliers').update({ credibility_score: Math.round((onTime / allPos.length) * 100) }).eq('id', supplierId)
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_id: '', quantity: '', unit_price: '', received_qty: '' }] }))
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i, field, val) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [field]: val } : it) }))
  const filtered = pos.filter(p => !search || p.po_number?.toLowerCase().includes(search.toLowerCase()) || p.suppliers?.name?.toLowerCase().includes(search.toLowerCase()))
  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  if (isNew) return <POForm form={form} setForm={setForm} suppliers={suppliers} products={products} saving={saving} onSave={handleSave} onCancel={() => navigate('/procurement/purchase-orders')} updateItem={updateItem} addItem={addItem} removeItem={removeItem} fmt={fmt} toast={toast} showToast={showToast} />
  if (isDetail && detail) return <PODetail detail={detail} onBack={() => navigate('/procurement/purchase-orders')} onAdvance={() => advanceStage(detail)} partialMode={partialMode} setPartialMode={setPartialMode} partialQtys={partialQtys} setPartialQtys={setPartialQtys} onPartialSave={handlePartialReceive} saving={saving} fmt={fmt} toast={toast} />

  return (
    <div style={{ padding: '28px 32px', background: '#0d1117', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: '#e6edf3' }}>
      <style>{GLOBAL_STYLES}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(-10px)', transition: 'all 0.4s ease' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #e6edf3, #8b949e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Purchase Orders</h1>
          <p style={{ fontSize: 13, color: '#8b949e', marginTop: 4 }}>{pos.length} total orders</p>
        </div>
        <button className="action-btn-main" onClick={() => navigate('/procurement/purchase-orders/new')}
          style={{ background: 'rgba(0,200,150,0.15)', color: '#00c896', border: '1px solid rgba(0,200,150,0.4)', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + New PO
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease 0.1s' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by PO # or supplier..." className="input-anim"
          style={{ background: '#161b22', border: '1px solid #2a3441', borderRadius: 10, padding: '9px 14px', color: '#e6edf3', fontSize: 13, width: 280, fontFamily: "'DM Sans', sans-serif" }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...STAGES].map(s => {
            const sc = STAGE_COLORS[s]
            const active = filter === s
            return (
              <button key={s} className="filter-btn" onClick={() => setFilter(s)}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${active ? (sc?.border || 'rgba(0,200,150,0.3)') : '#2a3441'}`, background: active ? (sc?.bg || 'rgba(0,200,150,0.1)') : 'transparent', color: active ? (sc?.color || '#00c896') : '#8b949e', cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 400 }}>
                {s === 'all' ? 'All' : STAGE_LABELS[s]}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ background: '#161b22', border: '1px solid #2a3441', borderRadius: 14, overflow: 'hidden', opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease 0.2s' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a3441', background: 'rgba(255,255,255,0.01)' }}>
              {['PO #', 'Supplier', 'Items', 'Total Value', 'Expected Delivery', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#8b949e', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1c2230' }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <div style={{ height: 12, width: j === 0 ? 70 : j === 1 ? 110 : j === 5 ? 80 : 50, background: 'linear-gradient(90deg, #2a3441 25%, #3a4451 50%, #2a3441 75%)', backgroundSize: '200% 100%', animation: `shimmer 1.5s infinite`, animationDelay: `${i * 0.1}s`, borderRadius: 4 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#8b949e' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                No purchase orders found
              </td></tr>
            ) : filtered.map((po, idx) => {
              const total = (po.purchase_order_items || []).reduce((s, i) => s + ((i.quantity_ordered ?? 0) * (i.unit_price ?? 0)), 0)
              const sc = STAGE_COLORS[po.status] || STAGE_COLORS.draft
              const stageIdx = STAGES.indexOf(po.status)
              return (
                <tr key={po.id} className="po-row-hover"
                  style={{ borderBottom: '1px solid #1c2230', cursor: 'pointer', animation: `fadeSlideIn 0.35s ease ${idx * 0.05}s both` }}
                  onClick={() => navigate(`/procurement/purchase-orders/${po.id}`)}>
                  <td style={{ padding: '13px 16px', fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#4da6ff', fontWeight: 700 }}>{po.po_number || `PO-${po.id?.slice(0,6)}`}</td>
                  <td style={{ padding: '13px 16px', fontWeight: 500 }}>{po.suppliers?.name || '—'}</td>
                  <td style={{ padding: '13px 16px', color: '#8b949e' }}>{(po.purchase_order_items || []).length} items</td>
                  <td style={{ padding: '13px 16px', fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600 }}>{fmt(total)}</td>
                  <td style={{ padding: '13px 16px', color: '#8b949e', fontSize: 12 }}>
                    {po.expected_delivery ? new Date(po.expected_delivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ background: sc.bg, color: sc.color, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1px solid ${sc.border}`, boxShadow: `0 0 8px ${sc.color}15`, whiteSpace: 'nowrap' }}>
                      {STAGE_LABELS[po.status] || po.status}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px' }} onClick={e => { e.stopPropagation(); advanceStage(po) }}>
                    {stageIdx < STAGES.length - 1 && (
                      <button className="stage-btn"
                        style={{ fontSize: 11, color: STAGE_COLORS[STAGES[stageIdx + 1]]?.color || '#00c896', background: STAGE_COLORS[STAGES[stageIdx + 1]]?.bg || 'rgba(0,200,150,0.1)', border: `1px solid ${STAGE_COLORS[STAGES[stageIdx + 1]]?.border || 'rgba(0,200,150,0.25)'}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        → {STAGE_LABELS[STAGES[stageIdx + 1]]}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function POForm({ form, setForm, suppliers, products, saving, onSave, onCancel, updateItem, addItem, removeItem, fmt, toast }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => setTimeout(() => setVisible(true), 50), [])
  const total = form.items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unit_price)), 0)

  return (
    <div style={{ padding: '28px 32px', background: '#0d1117', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: '#e6edf3' }}>
      <style>{GLOBAL_STYLES}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, opacity: visible ? 1 : 0, transition: 'all 0.4s ease' }}>
        <button className="back-btn" onClick={onCancel}
          style={{ background: 'rgba(139,148,158,0.1)', border: '1px solid #2a3441', color: '#8b949e', cursor: 'pointer', fontSize: 18, width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ←
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #e6edf3, #8b949e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>New Purchase Order</h1>
          <p style={{ fontSize: 13, color: '#8b949e', marginTop: 3 }}>Create a draft PO to send to a supplier</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease 0.1s' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Order Details">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <Label>Supplier</Label>
                <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className="input-anim"
                  style={selectSt}>
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Expected Delivery</Label>
                <input type="date" value={form.expected_delivery} onChange={e => setForm(f => ({ ...f, expected_delivery: e.target.value }))} className="input-anim" style={inputSt} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <Label>Notes</Label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes..." className="input-anim"
                style={{ ...inputSt, resize: 'vertical', height: 64 }} />
            </div>
          </Card>

          <Card title={`Items (${form.items.filter(i => i.product_id).length} added)`}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a3441' }}>
                  {['Product', 'Qty', 'Unit Price', 'Subtotal', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#8b949e', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1c2230', animation: `fadeSlideIn 0.3s ease both` }}>
                    <td style={{ padding: '8px 6px' }}>
                      <select value={item.product_id} className="input-anim" onChange={e => {
                        const prod = products.find(p => p.id === e.target.value)
                        updateItem(i, 'product_id', e.target.value)
                        if (prod?.unit_price) updateItem(i, 'unit_price', prod.unit_price)
                      }} style={{ ...selectSt, minWidth: 160 }}>
                        <option value="">Select...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" className="input-anim" style={{ ...inputSt, width: 80 }} />
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <input type="number" min="0" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} placeholder="Price" className="input-anim" style={{ ...inputSt, width: 100 }} />
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#00c896', fontWeight: 600 }}>
                      {item.quantity && item.unit_price ? fmt(Number(item.quantity) * Number(item.unit_price)) : '—'}
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <button onClick={() => removeItem(i)}
                        style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', color: '#ff6b6b', cursor: 'pointer', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 0.2s ease' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,107,107,0.18)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,107,107,0.08)'}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addItem}
              style={{ marginTop: 12, fontSize: 13, color: '#4da6ff', background: 'rgba(77,166,255,0.06)', border: '1px dashed rgba(77,166,255,0.3)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', width: '100%', fontWeight: 500, transition: 'all 0.2s ease' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(77,166,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(77,166,255,0.06)'}>
              + Add item
            </button>
          </Card>
        </div>

        <div>
          <Card title="Summary">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid #2a3441' }}>
              <span style={{ color: '#8b949e' }}>Items</span>
              <span style={{ fontWeight: 600 }}>{form.items.filter(i => i.product_id).length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, padding: '12px 0', fontFamily: "'Space Mono', monospace" }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, color: '#8b949e', fontSize: 13 }}>Total</span>
              <span style={{ color: '#00c896' }}>{fmt(total)}</span>
            </div>
            <button onClick={onSave} disabled={saving} className="action-btn-main"
              style={{ background: 'rgba(0,200,150,0.15)', color: '#00c896', border: '1px solid rgba(0,200,150,0.4)', borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', width: '100%', marginTop: 4, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating...' : 'Create PO as Draft'}
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PODetail({ detail, onBack, onAdvance, partialMode, setPartialMode, partialQtys, setPartialQtys, onPartialSave, saving, fmt, toast }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => setTimeout(() => setVisible(true), 50), [])
  const sc = STAGE_COLORS[detail.status] || STAGE_COLORS.draft
  const idx = STAGES.indexOf(detail.status)
  const total = (detail.purchase_order_items || []).reduce((s, i) => s + ((i.quantity_ordered ?? 0) * (i.unit_price ?? 0)), 0)

  return (
    <div style={{ padding: '28px 32px', background: '#0d1117', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", color: '#e6edf3' }}>
      <style>{GLOBAL_STYLES}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26, opacity: visible ? 1 : 0, transition: 'all 0.4s ease' }}>
        <button className="back-btn" onClick={onBack}
          style={{ background: 'rgba(139,148,158,0.1)', border: '1px solid #2a3441', color: '#8b949e', cursor: 'pointer', fontSize: 18, width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ←
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, fontFamily: "'Space Mono', monospace", color: '#e6edf3' }}>{detail.po_number}</h1>
            <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, boxShadow: `0 0 12px ${sc.color}20` }}>
              {STAGE_LABELS[detail.status]}
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#8b949e', marginTop: 3 }}>{detail.suppliers?.name}</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          {!['received', 'closed'].includes(detail.status) && (
            <button className="stage-btn" onClick={() => setPartialMode(!partialMode)}
              style={{ background: 'rgba(245,166,35,0.1)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {partialMode ? 'Cancel' : '📦 Partial Delivery'}
            </button>
          )}
          {idx < STAGES.length - 1 && !partialMode && (
            <button className="stage-btn action-btn-main" onClick={onAdvance}
              style={{ background: 'rgba(0,200,150,0.15)', color: '#00c896', border: '1px solid rgba(0,200,150,0.4)', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              → {STAGE_LABELS[STAGES[idx + 1]]}
            </button>
          )}
          {partialMode && (
            <button className="action-btn-main" onClick={onPartialSave} disabled={saving}
              style={{ background: 'rgba(0,200,150,0.15)', color: '#00c896', border: '1px solid rgba(0,200,150,0.4)', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : '✓ Confirm Receipt'}
            </button>
          )}
        </div>
      </div>

      {/* Stage pipeline */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, background: '#161b22', borderRadius: 14, border: '1px solid #2a3441', padding: '20px 24px', alignItems: 'center', opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease 0.15s' }}>
        {STAGES.map((s, i) => {
          const done = STAGES.indexOf(detail.status) >= i
          const active = detail.status === s
          const sc2 = STAGE_COLORS[s]
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div className="stage-node" style={{ width: 32, height: 32, borderRadius: '50%', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: done ? sc2.bg : '#1c2230', border: `2px solid ${done ? sc2.color : '#2a3441'}`, color: done ? sc2.color : '#3a4555', boxShadow: active ? `0 0 16px ${sc2.color}40` : 'none', transform: active ? 'scale(1.15)' : 'scale(1)' }}>
                  {done && !active ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 11, color: active ? sc2.color : done ? '#8b949e' : '#3a4555', fontWeight: active ? 700 : 400, transition: 'color 0.4s ease' }}>{STAGE_LABELS[s]}</div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="stage-connector" style={{ height: 2, flex: 0.3, background: STAGES.indexOf(detail.status) > i ? '#00c896' : '#2a3441', borderRadius: 2, boxShadow: STAGES.indexOf(detail.status) > i ? '0 0 4px rgba(0,200,150,0.5)' : 'none' }} />
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 18, opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease 0.25s' }}>
        <Card title="Items">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a3441' }}>
                {['Product', 'Ordered', partialMode ? 'Received (enter)' : 'Received', 'Unit Price', 'Subtotal'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#8b949e', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(detail.purchase_order_items || []).map((item, i) => {
                const recv = partialQtys[item.id] || item.received_quantity || 0
                const pct = Math.round((recv / (item.quantity_ordered ?? 1)) * 100)
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #1c2230', transition: 'background 0.15s ease', animation: `fadeSlideIn 0.35s ease ${i * 0.06}s both` }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontWeight: 500 }}>{item.products?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{item.products?.unit}</div>
                    </td>
                    <td style={{ padding: '11px 12px', fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600 }}>{item.quantity_ordered}</td>
                    <td style={{ padding: '11px 12px' }}>
                      {partialMode ? (
                        <input type="number" min="0" max={item.quantity_ordered} value={partialQtys[item.id] ?? item.received_quantity ?? 0}
                          onChange={e => setPartialQtys(q => ({ ...q, [item.id]: e.target.value }))} className="input-anim"
                          style={{ background: '#1c2230', border: '1px solid #2a3441', borderRadius: 8, padding: '6px 10px', color: '#e6edf3', fontSize: 12, width: 80, fontFamily: "'Space Mono', monospace" }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: pct >= 100 ? '#00c896' : pct > 0 ? '#f5a623' : '#8b949e' }}>{recv}</span>
                          {pct > 0 && <span style={{ fontSize: 10, background: pct >= 100 ? 'rgba(0,200,150,0.1)' : 'rgba(245,166,35,0.1)', color: pct >= 100 ? '#00c896' : '#f5a623', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{pct}%</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '11px 12px', color: '#8b949e', fontSize: 12, fontFamily: "'Space Mono', monospace" }}>{fmt(item.unit_price)}</td>
                    <td style={{ padding: '11px 12px', fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#00c896', fontWeight: 600 }}>{fmt((item.quantity_ordered ?? 0) * (item.unit_price ?? 0))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Details">
            {[
              { label: 'Supplier', value: detail.suppliers?.name },
              { label: 'Contact', value: detail.suppliers?.contact_email || detail.suppliers?.phone || '—' },
              { label: 'Expected Delivery', value: detail.expected_delivery ? new Date(detail.expected_delivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
              { label: 'Created', value: new Date(detail.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1c2230', fontSize: 13 }}>
                <span style={{ color: '#8b949e' }}>{r.label}</span>
                <span style={{ fontWeight: 500 }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 18, fontWeight: 800, fontFamily: "'Space Mono', monospace" }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 400, color: '#8b949e', fontSize: 13 }}>Total</span>
              <span style={{ color: '#00c896' }}>{fmt(total)}</span>
            </div>
          </Card>
          {detail.notes && (
            <Card title="Notes">
              <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.7, margin: 0 }}>{detail.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background: '#161b22', border: '1px solid #2a3441', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #2a3441', fontWeight: 700, fontSize: 14, background: 'rgba(255,255,255,0.01)' }}>{title}</div>
      <div style={{ padding: '18px 20px' }}>{children}</div>
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{children}</div>
}

function Toast({ msg, type }) {
  const color = type === 'error' ? '#ff6b6b' : '#00c896'
  return (
    <div style={{ position: 'fixed', top: 24, right: 28, background: '#161b22', border: `1px solid ${color}50`, borderRadius: 12, padding: '13px 20px', color, fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: `0 8px 32px ${color}20`, animation: 'popIn 0.3s ease both', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>{type === 'error' ? '⚠' : '✓'}</span> {msg}
    </div>
  )
}

const inputSt = { background: '#1c2230', border: '1px solid #2a3441', borderRadius: 8, padding: '8px 12px', color: '#e6edf3', fontSize: 13, width: '100%', fontFamily: "'DM Sans', sans-serif" }
const selectSt = { ...inputSt, cursor: 'pointer' }
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, TrendingUp, TrendingDown, Package,
  AlertTriangle, RefreshCw, Plus, BarChart3,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2,
  Truck, Circle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const MOCK_ORDERS = [
  { id:'SO-2041', type:'sales',    product:'Premium Cotton Thread',    party:'Rajesh Textiles Pvt.',    qty:'200 rolls', value:24000,  status:'dispatched', date:'Jan 20' },
  { id:'SO-2042', type:'sales',    product:'Silk Finish Cloth',        party:'Meena Fashion House',     qty:'150 m',     value:42000,  status:'open',       date:'Jan 21' },
  { id:'SO-2043', type:'sales',    product:'Finished Kurta Set',       party:'Deepak Retail Chain',     qty:'30 pcs',    value:25500,  status:'completed',  date:'Jan 18' },
  { id:'SO-2044', type:'sales',    product:'Denim Jacket Regular',     party:'Arjun Garments',          qty:'20 pcs',    value:12400,  status:'pending',    date:'Jan 22' },
  { id:'SO-2045', type:'sales',    product:'Polyester Blend Cloth',    party:'Priya Exports Ltd.',      qty:'300 m',     value:28500,  status:'open',       date:'Jan 23' },
  { id:'SO-2046', type:'sales',    product:'Organic Cotton Voile',     party:'Kavita Boutique',         qty:'100 m',     value:21000,  status:'completed',  date:'Jan 15' },
  { id:'SO-2047', type:'sales',    product:'Denim Twill Heavy',        party:'Mumbai Denims Co.',       qty:'200 m',     value:35000,  status:'dispatched', date:'Jan 19' },
  { id:'SO-2048', type:'sales',    product:'Thread',                   party:'Suresh Tailoring',        qty:'400 spools',value:14000,  status:'open',       date:'Jan 24' },
  { id:'PO-3021', type:'purchase', product:'Premium Cotton Roll',      party:'Gujarat Threads Co.',     qty:'20 rolls',  value:9600,   status:'received',   date:'Jan 10' },
  { id:'PO-3022', type:'purchase', product:'Heavy Duty Zippers 10pk',  party:'YKK India Distributors', qty:'200 pcs',   value:12000,  status:'completed',  date:'Jan 12' },
  { id:'PO-3023', type:'purchase', product:'Metal Buttons Pack',       party:'Mumbai Trims Ltd.',       qty:'500 pcs',   value:22500,  status:'pending',    date:'Jan 22' },
  { id:'PO-3024', type:'purchase', product:'Elastic Band Roll 10m',    party:'Mumbai Trims Ltd.',       qty:'80 rolls',  value:4400,   status:'open',       date:'Jan 23' },
  { id:'PO-3025', type:'purchase', product:'Snap Buttons Silver',      party:'Mumbai Trims Ltd.',       qty:'300 pcs',   value:11400,  status:'dispatched', date:'Jan 20' },
  { id:'PO-3026', type:'purchase', product:'Denim Twill Heavy',        party:'Ahmedabad Fabrics',       qty:'250 m',     value:43750,  status:'open',       date:'Jan 24' },
]

const LOW_STOCK = [
  { name:'Premium Cotton Roll',     qty:9,  threshold:20, unit:'rolls' },
  { name:'Denim Jacket Regular',    qty:12, threshold:25, unit:'pcs'   },
  { name:'Finished Kurta Set',      qty:18, threshold:30, unit:'pcs'   },
  { name:'Heavy Duty Zippers 10pk', qty:85, threshold:100,unit:'pcs'   },
]

const TOP_PRODUCTS = [
  { name:'Silk Finish Cloth',      value:42000, pct:100 },
  { name:'Denim Twill Heavy',      value:35000, pct:83  },
  { name:'Polyester Blend Cloth',  value:28500, pct:68  },
  { name:'Finished Kurta Set',     value:25500, pct:61  },
  { name:'Premium Cotton Thread',  value:24000, pct:57  },
]

const SUPPLIERS = [
  { name:'Ahmedabad Fabrics',      spend:43750, orders:1 },
  { name:'Mumbai Trims Ltd.',      spend:38300, orders:3 },
  { name:'YKK India Distributors', spend:12000, orders:1 },
  { name:'Gujarat Threads Co.',    spend:9600,  orders:1 },
]

const STATUS_STYLE = {
  open:       { bg:'rgba(34,211,238,0.1)',  border:'rgba(34,211,238,0.25)',  color:'#22d3ee' },
  pending:    { bg:'rgba(251,191,36,0.1)',  border:'rgba(251,191,36,0.25)',  color:'#fbbf24' },
  dispatched: { bg:'rgba(167,139,250,0.1)', border:'rgba(167,139,250,0.25)', color:'#a78bfa' },
  completed:  { bg:'rgba(52,211,153,0.1)',  border:'rgba(52,211,153,0.25)',  color:'#34d399' },
  received:   { bg:'rgba(52,211,153,0.1)',  border:'rgba(52,211,153,0.25)',  color:'#34d399' },
  cancelled:  { bg:'rgba(248,113,113,0.1)', border:'rgba(248,113,113,0.25)', color:'#f87171' },
}

function MiniBar({ pct, color }) {
  return (
    <div style={{ width:'100%', height:4, borderRadius:2, background:'rgba(75,77,107,0.3)', overflow:'hidden' }}>
      <motion.div initial={{ width:0 }} animate={{ width:`${pct}%`}} transition={{ duration:0.6, ease:'easeOut' }} style={{ height:'100%', borderRadius:2, background:color }} />
    </div>
  )
}

function StatCard({ label, value, sub, color, icon: Icon, trend }) {
  return (
    <motion.div whileHover={{ y:-2 }} style={{ background:'rgba(20,22,38,0.8)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:14, padding:16, display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11, color:'#6b6e89', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:500 }}>{label}</span>
        <div style={{ width:28, height:28, borderRadius:8, background:`${color}15`, border:`1px solid ${color}25`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={13} color={color} />
        </div>
      </div>
      <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
      <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#6b6e89' }}>
        {trend === 'up' && <ArrowUpRight size={11} color="#34d399" />}
        {trend === 'down' && <ArrowDownRight size={11} color="#f87171" />}
        {sub}
      </div>
    </motion.div>
  )
}

export default function SalesManagerDashboard({ onNewOrder }) {
  const [orders, setOrders] = useState(MOCK_ORDERS)
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('orders')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
        if (!error && data && data.length > 0) setOrders(data)
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const salesOrders = orders.filter(o => o.type === 'sales')
  const purchaseOrders = orders.filter(o => o.type === 'purchase')
  const totalValue = orders.reduce((s, o) => s + (Number(o.value) || 0), 0)
  const salesValue = salesOrders.reduce((s, o) => s + (Number(o.value) || 0), 0)
  const openCount = orders.filter(o => o.status === 'open').length
  const closedCount = orders.filter(o => ['completed','received','cancelled'].includes(o.status)).length
  const fulfilmentPct = orders.length ? Math.round((closedCount / orders.length) * 100) : 0
  const statusCounts = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {})
  const filtered = typeFilter === 'all' ? orders : orders.filter(o => o.type === typeFilter)

  const updateStatus = async (id, status) => {
    setOrders(prev => prev.map(o => (o.id === id || o.order_number === id) ? { ...o, status } : o))
    try { await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).or(`id.eq.${id},order_number.eq.${id}`) } catch {}
  }

  return (
    <div style={{ padding:24, display:'flex', flexDirection:'column', gap:20 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:600, color:'#e2e3ed' }}>Sales Dashboard</h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'#6b6e89' }}>{loading ? 'Loading…' : `${orders.length} orders · January 2025`}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }} onClick={() => setOrders(MOCK_ORDERS)} style={{ padding:'8px', borderRadius:10, background:'rgba(30,31,50,0.6)', border:'1px solid rgba(75,77,107,0.4)', color:'#9394a5', cursor:'pointer', display:'flex', alignItems:'center' }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </motion.button>
          {onNewOrder && (
            <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }} onClick={onNewOrder} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, background:'#7c3aed', border:'none', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:500 }}>
              <Plus size={14} /> New Order
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Tab Toggle */}
      <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.04 }} style={{ display:'flex', gap:3, padding:4, borderRadius:12, background:'rgba(20,22,38,0.6)', border:'1px solid rgba(75,77,107,0.3)', width:'fit-content' }}>
        {[{ id:'orders', label:'Orders', icon:ShoppingCart },{ id:'analytics', label:'Analytics', icon:BarChart3 }].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, fontSize:13, fontWeight:500, cursor:'pointer', background: activeTab === id ? 'rgba(124,58,237,0.2)' : 'transparent', color: activeTab === id ? '#a78bfa' : '#9394a5', border: activeTab === id ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent' }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </motion.div>

      {/* Stat Cards */}
      <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.06 }} style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12 }}>
        <StatCard label="Total order value" value={`₹${(totalValue/1000).toFixed(0)}K`} sub={`${orders.length} orders`} color="#a78bfa" icon={TrendingUp} trend="up" />
        <StatCard label="Sales revenue"     value={`₹${(salesValue/1000).toFixed(0)}K`} sub={`${salesOrders.length} sales orders`} color="#34d399" icon={ShoppingCart} trend="up" />
        <StatCard label="Open orders"       value={openCount} sub={`${salesOrders.filter(o=>o.status==='open').length} sales · ${purchaseOrders.filter(o=>o.status==='open').length} purchase`} color="#fbbf24" icon={Clock} />
        <StatCard label="Fulfilment rate"   value={`${fulfilmentPct}%`} sub={`${closedCount} of ${orders.length} closed`} color="#22d3ee" icon={CheckCircle2} trend={fulfilmentPct >= 50 ? 'up' : 'down'} />
      </motion.div>

      {/* Status mini pills */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.1 }} style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
        {[
          { label:'Open',       count: statusCounts.open       || 0, s: STATUS_STYLE.open       },
          { label:'Pending',    count: statusCounts.pending    || 0, s: STATUS_STYLE.pending    },
          { label:'Dispatched', count: statusCounts.dispatched || 0, s: STATUS_STYLE.dispatched },
          { label:'Completed',  count:(statusCounts.completed  || 0)+(statusCounts.received||0), s: STATUS_STYLE.completed },
        ].map(({ label, count, s }) => (
          <div key={label} style={{ background:'rgba(20,22,38,0.6)', border:'1px solid rgba(75,77,107,0.3)', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:s.bg, border:`1px solid ${s.border}`, color:s.color, fontFamily:'monospace', fontWeight:500 }}>{label}</span>
            <span style={{ fontWeight:700, fontSize:18, color:'#e2e3ed' }}>{count}</span>
          </div>
        ))}
      </motion.div>

      {/* Orders Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'orders' && (
          <motion.div key="orders" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} style={{ background:'rgba(20,22,38,0.8)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:16, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid rgba(75,77,107,0.3)' }}>
              <span style={{ fontSize:13, fontWeight:500, color:'#9394a5', textTransform:'uppercase', letterSpacing:'0.05em' }}>All orders</span>
              <div style={{ display:'flex', gap:3, padding:3, borderRadius:8, background:'rgba(30,31,50,0.5)' }}>
                {['all','sales','purchase'].map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)} style={{ fontSize:11, padding:'5px 10px', borderRadius:6, cursor:'pointer', fontWeight:500, background: typeFilter === t ? 'rgba(124,58,237,0.2)' : 'transparent', color: typeFilter === t ? '#a78bfa' : '#6b6e89', border: typeFilter === t ? '1px solid rgba(167,139,250,0.25)' : '1px solid transparent' }}>
                    {t === 'all' ? 'All' : t === 'sales' ? 'Sales' : 'Purchase'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid rgba(75,77,107,0.3)' }}>
                    {['Order ID','Type','Product','Party','Qty','Value','Status','Date'].map(h => (
                      <th key={h} style={{ padding:'10px 16px', fontSize:11, fontWeight:500, color:'#6b6e89', textTransform:'uppercase', letterSpacing:'0.05em', textAlign: ['Qty','Value'].includes(h) ? 'right' : 'left', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order, i) => {
                    const ss = STATUS_STYLE[order.status] || STATUS_STYLE.open
                    return (
                      <motion.tr key={order.id || order.order_number} initial={{ opacity:0, y:3 }} animate={{ opacity:1, y:0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} style={{ borderBottom:'1px solid rgba(75,77,107,0.15)', cursor:'default' }} whileHover={{ backgroundColor:'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding:'11px 16px', fontFamily:'monospace', fontSize:12, color:'#a78bfa', whiteSpace:'nowrap' }}>{order.order_number || order.id}</td>
                        <td style={{ padding:'11px 16px' }}>
                          <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontFamily:'monospace', fontWeight:500, ...(order.type === 'sales' ? { background:'rgba(34,211,238,0.1)', border:'1px solid rgba(34,211,238,0.2)', color:'#22d3ee' } : { background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.2)', color:'#fbbf24' }) }}>
                            {order.type === 'sales' ? 'Sale' : 'Purchase'}
                          </span>
                        </td>
                        <td style={{ padding:'11px 16px', fontSize:13, color:'#e2e3ed', fontWeight:500, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{order.product}</td>
                        <td style={{ padding:'11px 16px', fontSize:13, color:'#9394a5', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{order.customer || order.party}</td>
                        <td style={{ padding:'11px 16px', textAlign:'right', fontFamily:'monospace', fontSize:12, color:'#c4c6d0', whiteSpace:'nowrap' }}>{order.qty || `${order.quantity} ${order.unit || ''}`}</td>
                        <td style={{ padding:'11px 16px', textAlign:'right', fontFamily:'monospace', fontSize:13, color:'#c4c6d0', whiteSpace:'nowrap' }}>₹{(Number(order.value) || 0).toLocaleString()}</td>
                        <td style={{ padding:'11px 16px' }}>
                          <select value={order.status} onChange={e => updateStatus(order.order_number || order.id, e.target.value)} style={{ fontSize:11, padding:'4px 8px', borderRadius:8, fontFamily:'monospace', cursor:'pointer', outline:'none', background:ss.bg, border:`1px solid ${ss.border}`, color:ss.color }}>
                            {['open','pending','dispatched','completed','received','cancelled'].map(s => <option key={s} value={s} style={{ background:'#1a1b2e', color:'#e2e3ed' }}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding:'11px 16px', fontSize:12, color:'#6b6e89', fontFamily:'monospace', whiteSpace:'nowrap' }}>{order.date || (order.date || '').slice(0,10)}</td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:'10px 16px', borderTop:'1px solid rgba(75,77,107,0.3)', display:'flex', justifyContent:'space-between', fontSize:12, color:'#6b6e89', fontFamily:'monospace' }}>
              <span>{filtered.length} orders shown</span>
              <span>Total: ₹{filtered.reduce((s, o) => s + (Number(o.value) || 0), 0).toLocaleString()}</span>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

            {/* Top Products */}
            <div style={{ background:'rgba(20,22,38,0.8)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:16, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                <BarChart3 size={15} color="#a78bfa" />
                <span style={{ fontSize:13, fontWeight:500, color:'#9394a5', textTransform:'uppercase', letterSpacing:'0.05em' }}>Top products by sales value</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {TOP_PRODUCTS.map((p, i) => (
                  <motion.div key={i} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.06 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <span style={{ fontSize:13, color:'#c4c6d0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>{p.name}</span>
                      <span style={{ fontFamily:'monospace', fontSize:12, color:'#34d399', flexShrink:0, marginLeft:8 }}>₹{p.value.toLocaleString()}</span>
                    </div>
                    <MiniBar pct={p.pct} color="#a78bfa" />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Supplier Spend */}
            <div style={{ background:'rgba(20,22,38,0.8)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:16, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                <Package size={15} color="#fbbf24" />
                <span style={{ fontSize:13, fontWeight:500, color:'#9394a5', textTransform:'uppercase', letterSpacing:'0.05em' }}>Purchase spend by supplier</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {SUPPLIERS.map((s, i) => {
                  const maxSpend = Math.max(...SUPPLIERS.map(x => x.spend))
                  return (
                    <motion.div key={i} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.06 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <span style={{ fontSize:13, color:'#c4c6d0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>{s.name}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, marginLeft:8 }}>
                          <span style={{ fontSize:11, color:'#6b6e89' }}>{s.orders} order{s.orders > 1 ? 's' : ''}</span>
                          <span style={{ fontFamily:'monospace', fontSize:12, color:'#f87171' }}>₹{s.spend.toLocaleString()}</span>
                        </div>
                      </div>
                      <MiniBar pct={Math.round((s.spend / maxSpend) * 100)} color="#f59e0b" />
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Status Breakdown */}
            <div style={{ background:'rgba(20,22,38,0.8)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:16, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                <TrendingUp size={15} color="#22d3ee" />
                <span style={{ fontSize:13, fontWeight:500, color:'#9394a5', textTransform:'uppercase', letterSpacing:'0.05em' }}>Status breakdown</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  { label:'Open',       count: statusCounts.open       || 0, color:'#22d3ee', bar:'#22d3ee', s: STATUS_STYLE.open },
                  { label:'Pending',    count: statusCounts.pending    || 0, color:'#fbbf24', bar:'#f59e0b', s: STATUS_STYLE.pending },
                  { label:'Dispatched', count: statusCounts.dispatched || 0, color:'#a78bfa', bar:'#a78bfa', s: STATUS_STYLE.dispatched },
                  { label:'Completed',  count:(statusCounts.completed  || 0)+(statusCounts.received||0), color:'#34d399', bar:'#34d399', s: STATUS_STYLE.completed },
                ].map(({ label, count, color, bar, s }) => (
                  <div key={label}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                      <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:s.bg, border:`1px solid ${s.border}`, color:s.color, fontFamily:'monospace', fontWeight:500 }}>{label}</span>
                      <span style={{ fontFamily:'monospace', fontSize:15, fontWeight:700, color }}>{count}</span>
                    </div>
                    <MiniBar pct={orders.length ? Math.round((count / orders.length) * 100) : 0} color={bar} />
                  </div>
                ))}
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div style={{ background:'rgba(20,22,38,0.8)', border:'1px solid rgba(75,77,107,0.4)', borderRadius:16, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                <AlertTriangle size={15} color="#f87171" />
                <span style={{ fontSize:13, fontWeight:500, color:'#9394a5', textTransform:'uppercase', letterSpacing:'0.05em' }}>Low stock alerts</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {LOW_STOCK.map((item, i) => {
                  const pct = Math.round((item.qty / item.threshold) * 100)
                  const crit = pct < 50
                  return (
                    <motion.div key={i} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.06 }} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:12, background:'rgba(30,31,50,0.5)', border:'1px solid rgba(75,77,107,0.3)' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: crit ? '#ef4444' : '#f59e0b' }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, color:'#c4c6d0', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</p>
                        <p style={{ fontSize:11, color:'#6b6e89', fontFamily:'monospace', margin:'2px 0 4px' }}>{item.qty} / {item.threshold} {item.unit}</p>
                        <MiniBar pct={pct} color={crit ? '#ef4444' : '#f59e0b'} />
                      </div>
                      <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontFamily:'monospace', fontWeight:500, flexShrink:0, ...(crit ? { background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', color:'#f87171' } : { background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.25)', color:'#fbbf24' }) }}>
                        {crit ? 'Critical' : 'Low'}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import {
  Package, TrendingDown, TrendingUp, AlertTriangle,
  RefreshCw, Bot, ArrowRight, Zap, ShoppingCart, Truck,
  ChevronRight, CheckCircle, Clock
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import axios from 'axios'
import toast from 'react-hot-toast'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// Animated counter
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const target = parseFloat(value) || 0
    const duration = 900
    const start = performance.now()
    const from = 0
    const raf = (time) => {
      const progress = Math.min((time - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (target - from) * ease)
      if (progress < 1) requestAnimationFrame(raf)
      else setDisplay(target)
    }
    requestAnimationFrame(raf)
  }, [value])
  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.floor(display).toLocaleString()
  return <span>{prefix}{formatted}{suffix}</span>
}

function StatCard({ label, value, icon: Icon, color, sub, delay = 0, alert = false }) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.div
      initial={{ opacity:0, y:24 }}
      animate={{ opacity:1, y:0 }}
      transition={{ delay, duration:0.5, ease:[0.16,1,0.3,1] }}
      whileHover={{ y:-3, transition:{ duration:0.2 } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="glass-card rounded-2xl p-5 relative overflow-hidden cursor-default"
      style={{ borderColor: hovered ? `${color}25` : undefined }}
    >
      {/* Background glow on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ background:`radial-gradient(circle at 30% 30%, ${color}08, transparent 70%)` }}
          />
        )}
      </AnimatePresence>

      {/* Alert pulse */}
      {alert && (
        <motion.div
          animate={{ scale:[1,1.3,1], opacity:[0.7,1,0.7] }}
          transition={{ duration:1.5, repeat:Infinity }}
          className="absolute top-3 right-3 w-2 h-2 rounded-full"
          style={{ background:color }}
        />
      )}

      <div className="relative z-10">
        <motion.div
          whileHover={{ rotate:8, scale:1.05 }}
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background:`${color}15`, border:`1px solid ${color}25` }}
        >
          <Icon size={18} style={{ color }} />
        </motion.div>
        <div className="font-display font-bold text-3xl text-white mb-0.5">
          <AnimatedNumber value={typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g,'')) : value} />
          {typeof value === 'string' && value.includes('k') && 'k'}
        </div>
        <div className="text-muted text-sm">{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color:`${color}80` }}>{sub}</div>}
      </div>
    </motion.div>
  )
}

function TrafficRow({ product, index }) {
  const pct = Math.min(100, ((product.quantity || 0) / Math.max((product.reorder_threshold || 1) * 2.5, 1)) * 100)
  const avail = (product.quantity || 0) - (product.quantity_reserved || 0)
  const ratio = avail / Math.max(product.reorder_threshold || 1, 1)

  const { color, label, dotCls } =
    ratio <= 1  ? { color:'#f87171', label:'Critical', dotCls:'dot-red' } :
    ratio <= 1.5 ? { color:'#fbbf24', label:'Low',      dotCls:'dot-amber' } :
                  { color:'#4ade80', label:'Healthy',  dotCls:'dot-green' }

  return (
    <motion.div
      initial={{ opacity:0, x:-16 }}
      animate={{ opacity:1, x:0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ backgroundColor:'rgba(255,255,255,0.03)', transition:{duration:0.15} }}
      className="flex items-center gap-4 p-3 rounded-xl group cursor-default"
    >
      <div className={dotCls} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-white font-medium truncate">{product.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 font-mono"
            style={{ background:`${color}12`, color, border:`1px solid ${color}25` }}>
            {label}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width:0 }}
            animate={{ width:`${pct}%` }}
            transition={{ duration:1.2, ease:[0.16,1,0.3,1], delay: index * 0.04 + 0.3 }}
            className="h-full rounded-full"
            style={{ background:`linear-gradient(90deg, ${color}aa, ${color})`, boxShadow:`0 0 8px ${color}50` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted mt-1 font-mono">
          <span>{avail} available</span>
          <span>threshold: {product.reorder_threshold}</span>
        </div>
      </div>
    </motion.div>
  )
}

function AICard({ suggestion, index }) {
  return (
    <motion.div
      initial={{ opacity:0, x:-16 }}
      animate={{ opacity:1, x:0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ x:3 }}
      className="p-4 rounded-xl cursor-default transition-all"
      style={{ background:'rgba(126,255,212,0.04)', border:'1px solid rgba(126,255,212,0.1)' }}
    >
      <div className="flex items-start gap-3">
        <motion.div
          animate={{ rotate:[0,360] }}
          transition={{ duration:8, repeat:Infinity, ease:'linear' }}
        >
          <Zap size={13} style={{ color:'#7effd4', flexShrink:0, marginTop:2 }} />
        </motion.div>
        <p className="text-sm text-slate-300 leading-relaxed">{suggestion}</p>
      </div>
    </motion.div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <motion.div
      initial={{ opacity:0, scale:0.95 }}
      animate={{ opacity:1, scale:1 }}
      className="px-4 py-3 rounded-xl text-sm shadow-2xl"
      style={{ background:'#12131f', border:'1px solid rgba(126,255,212,0.2)' }}
    >
      <p className="text-muted text-xs mb-2 font-mono">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono text-xs">
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </motion.div>
  )
}

export default function InventoryDashboard() {
  const { profile } = useAuth()
  const [products, setProducts]         = useState([])
  const [stats, setStats]               = useState({})
  const [chartData, setChartData]       = useState([])
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading]           = useState(true)
  const [aiLoading, setAiLoading]       = useState(true)
  const [refreshing, setRefreshing]     = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll(showToast = false) {
    if (showToast) setRefreshing(true)
    setLoading(true)
    await Promise.all([fetchProducts(), fetchStats(), fetchChartData(), fetchRecentActivity()])
    setLoading(false)
    if (showToast) setRefreshing(false)
    fetchAISuggestions()
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, quantity, quantity_reserved, reorder_threshold, unit, category')
      .order('quantity', { ascending: true })
      .limit(12)
    if (data) setProducts(data)
  }

  async function fetchStats() {
    const { data: prods } = await supabase
      .from('products')
      .select('quantity, unit_price, reorder_threshold')
    if (!prods) return
    const totalSKUs   = prods.length
    const totalValue  = prods.reduce((s, p) => s + (p.quantity || 0) * (p.unit_price || 0), 0)
    const below       = prods.filter(p => (p.quantity||0) < p.reorder_threshold).length
    const approaching = prods.filter(p => (p.quantity||0) >= p.reorder_threshold && (p.quantity||0) < p.reorder_threshold * 1.5).length
    setStats({ totalSKUs, totalValue, below, approaching })
  }

  async function fetchChartData() {
    const { data } = await supabase
      .from('stock_movements')
      .select('created_at, type, quantity')
      .order('created_at', { ascending: true })
      .limit(80)
    if (!data) return
    const grouped = {}
    data.forEach(m => {
      const day = new Date(m.created_at).toLocaleDateString('en-IN', { month:'short', day:'numeric' })
      if (!grouped[day]) grouped[day] = { day, in:0, out:0 }
      if (m.type === 'in') grouped[day].in += (m.quantity||0)
      else grouped[day].out += (m.quantity||0)
    })
    setChartData(Object.values(grouped).slice(-14))
  }

  async function fetchRecentActivity() {
    const { data } = await supabase
      .from('stock_movements')
      .select('id, created_at, type, quantity, reason, products(name), profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(7)
    if (data) setRecentActivity(data)
  }

  async function fetchAISuggestions() {
    setAiLoading(true)
    try {
      const { data: lowStock } = await supabase
        .from('products')
        .select('name, quantity, reorder_threshold, preferred_supplier, unit, unit_price')
        .lte('quantity', 50)
        .limit(6)
      const res = await axios.post(`${BACKEND}/api/ai/reorder-suggestions`, {
        products: lowStock || [],
        context: 'inventory_manager',
      })
      setAiSuggestions(res.data.suggestions || [])
    } catch {
      setAiSuggestions(['AI suggestions temporarily unavailable. Check backend connection.'])
    }
    setAiLoading(false)
  }

  const below       = products.filter(p => (p.quantity||0) < p.reorder_threshold).length
  const approaching = products.filter(p => (p.quantity||0) >= p.reorder_threshold && (p.quantity||0) < p.reorder_threshold*1.5).length
  const healthy     = products.filter(p => (p.quantity||0) >= p.reorder_threshold*1.5).length

  const statCards = [
    { label:'Total SKUs',       value: stats.totalSKUs || 0,                             icon:Package,       color:'#60a5fa', delay:0 },
    { label:'Stock Value',      value: stats.totalValue ? `₹${(stats.totalValue/1000).toFixed(1)}k` : '₹0', icon:TrendingUp, color:'#7effd4', delay:0.07 },
    { label:'Below Threshold',  value: stats.below || 0,                                  icon:TrendingDown,  color:'#f87171', delay:0.14, alert: (stats.below||0)>0 },
    { label:'Approaching',      value: stats.approaching || 0,                             icon:AlertTriangle, color:'#fbbf24', delay:0.21 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity:0, y:-10 }}
        animate={{ opacity:1, y:0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="font-display font-bold text-white text-2xl">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span style={{ color:'#7effd4' }}>{profile?.full_name?.split(' ')[0] || 'Manager'}</span>
          </h2>
          <p className="text-muted text-sm mt-0.5">Live inventory snapshot — {new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}</p>
        </div>
        <motion.button
          whileHover={{ scale:1.04 }}
          whileTap={{ scale:0.97 }}
          onClick={() => fetchAll(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl btn-ghost text-sm"
        >
          <motion.div animate={refreshing ? { rotate:360 } : {}} transition={{ duration:0.8, repeat:refreshing?Infinity:0 }}>
            <RefreshCw size={14} />
          </motion.div>
          Refresh
        </motion.button>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Traffic light summary pills */}
      <motion.div
        initial={{ opacity:0, y:10 }}
        animate={{ opacity:1, y:0 }}
        transition={{ delay:0.35 }}
        className="flex flex-wrap gap-2"
      >
        {[
          { count:healthy,  label:'Healthy',    color:'#4ade80', bg:'rgba(74,222,128,0.1)',  border:'rgba(74,222,128,0.25)' },
          { count:approaching,label:'Approaching',color:'#fbbf24',bg:'rgba(251,191,36,0.1)', border:'rgba(251,191,36,0.25)' },
          { count:below,    label:'Critical',   color:'#f87171', bg:'rgba(248,113,113,0.1)', border:'rgba(248,113,113,0.25)' },
        ].map(s => (
          <motion.div
            key={s.label}
            whileHover={{ scale:1.04 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.color }}
          >
            <motion.div
              animate={s.label==='Critical' && s.count>0 ? { scale:[1,1.4,1] } : {}}
              transition={{ duration:1.5, repeat:Infinity }}
              className="w-2 h-2 rounded-full"
              style={{ background:s.color }}
            />
            {s.count} {s.label}
          </motion.div>
        ))}
      </motion.div>

      {/* Chart + Recent Activity */}
      <div className="grid lg:grid-cols-3 gap-5">
        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.45 }}
          className="lg:col-span-2 glass-card rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display font-bold text-white">Stock Movement</h3>
              <p className="text-muted text-xs mt-0.5">14-day inbound vs outbound</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-muted">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> In</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Out</span>
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7effd4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#7effd4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f87171" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fill:'#6b7280', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#6b7280', fontSize:11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="in"  name="Inbound"  stroke="#7effd4" fill="url(#gIn)"  strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:'#7effd4', strokeWidth:0 }} />
                <Area type="monotone" dataKey="out" name="Outbound" stroke="#f87171" fill="url(#gOut)" strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:'#f87171', strokeWidth:0 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center">
              {loading
                ? <div className="space-y-2 w-full">{[...Array(4)].map((_,i) => <div key={i} className="h-3 skeleton rounded" />)}</div>
                : <p className="text-muted text-sm">No movement data yet — add some adjustments to see the chart</p>
              }
            </div>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.55 }}
          className="glass-card rounded-2xl p-6"
        >
          <h3 className="font-display font-bold text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {loading
              ? [...Array(5)].map((_,i) => <div key={i} className="h-12 skeleton rounded-xl" />)
              : recentActivity.length > 0
                ? recentActivity.map((act, i) => (
                    <motion.div
                      key={act.id}
                      initial={{ opacity:0, x:12 }}
                      animate={{ opacity:1, x:0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-start gap-3"
                    >
                      <motion.div
                        whileHover={{ scale:1.1 }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: act.type === 'in' ? 'rgba(126,255,212,0.1)' : 'rgba(248,113,113,0.1)' }}
                      >
                        {act.type === 'in'
                          ? <TrendingUp size={12} style={{ color:'#7effd4' }} />
                          : <TrendingDown size={12} style={{ color:'#f87171' }} />}
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{act.products?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted">{act.reason?.slice(0,28)} · {act.profiles?.full_name?.split(' ')[0]}</p>
                      </div>
                      <span className="text-xs font-mono flex-shrink-0 font-bold"
                        style={{ color: act.type==='in' ? '#7effd4' : '#f87171' }}>
                        {act.type==='in' ? '+' : '-'}{act.quantity}
                      </span>
                    </motion.div>
                  ))
                : <p className="text-muted text-sm text-center py-4">No recent adjustments</p>
            }
          </div>
        </motion.div>
      </div>

      {/* Stock Health + AI Suggestions */}
      <div className="grid lg:grid-cols-2 gap-5">
        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.65 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-white">Stock Health</h3>
            <motion.button whileHover={{ x:2 }} className="text-xs flex items-center gap-1" style={{ color:'#7effd4' }}>
              View all <ChevronRight size={12} />
            </motion.button>
          </div>
          <div className="space-y-0.5">
            {loading
              ? [...Array(5)].map((_,i) => <div key={i} className="h-14 skeleton rounded-xl mb-1" />)
              : products.slice(0,7).map((p,i) => <TrafficRow key={p.id} product={p} index={i} />)
            }
            {!loading && products.length === 0 && (
              <p className="text-muted text-sm text-center py-8">No products yet. Add products to see health.</p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.75 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <motion.div
              animate={{ boxShadow:['0 0 12px rgba(126,255,212,0.3)','0 0 24px rgba(126,255,212,0.6)','0 0 12px rgba(126,255,212,0.3)'] }}
              transition={{ duration:2.5, repeat:Infinity }}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background:'rgba(126,255,212,0.1)', border:'1px solid rgba(126,255,212,0.25)' }}
            >
              <Bot size={15} style={{ color:'#7effd4' }} />
            </motion.div>
            <div>
              <h3 className="font-display font-bold text-white">AI Reorder Suggestions</h3>
              <p className="text-muted text-xs">Powered by Groq · LLaMA 3</p>
            </div>
            {!aiLoading && (
              <motion.div
                animate={{ scale:[1,1.3,1], opacity:[0.6,1,0.6] }}
                transition={{ duration:2, repeat:Infinity }}
                className="ml-auto w-2 h-2 rounded-full"
                style={{ background:'#7effd4' }}
              />
            )}
          </div>

          {aiLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 skeleton rounded-xl" style={{ animationDelay:`${i*0.15}s` }} />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {aiSuggestions.map((s, i) => <AICard key={i} suggestion={s} index={i} />)}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
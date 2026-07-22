// src/components/inventory/StockMovementChart.jsx
import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'

function buildChartData(movements) {
  const map = {}
  ;(movements || []).forEach(m => {
    const date = m.created_at?.slice(0, 10)
    if (!date) return
    if (!map[date]) map[date] = { date, in: 0, out: 0 }
    if (m.type === 'in')  map[date].in  += (m.quantity || 0)
    if (m.type === 'out') map[date].out += (m.quantity || 0)
  })
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card rounded-xl p-3 text-xs space-y-1"
      style={{ border: '1px solid rgba(126,255,212,0.2)', minWidth: 130 }}>
      <p className="text-muted mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-white capitalize">{p.dataKey === 'in' ? 'Stock in' : 'Stock out'}</span>
          </div>
          <span className="font-mono font-bold text-white">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function StockMovementChart() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: movements } = await supabase
      .from('stock_movements')
      .select('type, quantity, created_at')
      .order('created_at', { ascending: false })
      .limit(500)
    setData(buildChartData(movements))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalIn  = data.reduce((s, d) => s + d.in, 0)
  const totalOut = data.reduce((s, d) => s + d.out, 0)
  const net      = totalIn - totalOut

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-white">Stock Movement</h3>
          <p className="text-xs text-muted">Last 30 days — units in vs out</p>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={load} className="btn-ghost p-2 rounded-xl">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </motion.button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total in',  val: totalIn,  color: '#7effd4' },
          { label: 'Total out', val: totalOut, color: '#f87171' },
          { label: 'Net',       val: net,      color: net >= 0 ? '#7effd4' : '#f87171' },
        ].map(({ label, val, color }) => (
          <div key={label} className="p-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs text-muted mb-1">{label}</p>
            <p className="text-lg font-display font-bold" style={{ color }}>
              {val >= 0 ? '+' : ''}{val.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: '#7effd4', borderTopColor: 'transparent' }} />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <TrendingUp size={32} className="opacity-20 mb-2" />
          <p className="text-sm">No movement data yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#7effd4" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#7effd4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f87171" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              tickLine={false} axisLine={false} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
              tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="in"  stroke="#7effd4" fill="url(#gradIn)"  strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="out" stroke="#f87171" fill="url(#gradOut)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
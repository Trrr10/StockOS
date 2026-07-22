import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Brain, RefreshCw, TrendingDown, Clock, AlertCircle } from 'lucide-react'
import axios from 'axios'
import { supabase } from '../../lib/supabase'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// Cooldown between manual refreshes (ms) — prevents token spam
const REFRESH_COOLDOWN_MS = 30_000

const CONF = {
  high:   { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  label: 'High' },
  medium: { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  label: 'Medium' },
  low:    { color: '#f87171', bg: 'rgba(248,113,113,0.08)', label: 'Low' },
}

async function getAuthHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function DaysBar({ days }) {
  const pct   = Math.min(((days ?? 90) / 90) * 100, 100)
  const color = !days || days <= 7 ? '#f87171' : days <= 20 ? '#fbbf24' : '#4ade80'
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 9999 }} />
    </div>
  )
}

export default function DemandForecast() {
  const [forecasts, setForecasts]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [sortBy, setSortBy]         = useState('days')
  const [error, setError]           = useState(false)
  const [cooldown, setCooldown]     = useState(false)
  const [cooldownSecs, setCooldownSecs] = useState(0)

  // Track last fetch time across re-renders without triggering re-render
  const lastFetchRef   = useRef(0)
  const cooldownTimer  = useRef(null)
  const countdownTimer = useRef(null)

  async function load(force = false) {
    const now = Date.now()

    // Enforce cooldown unless forced by initial mount
    if (!force && now - lastFetchRef.current < REFRESH_COOLDOWN_MS) return

    lastFetchRef.current = now

    // Start 30s cooldown UI
    setCooldown(true)
    setCooldownSecs(30)

    clearTimeout(cooldownTimer.current)
    clearInterval(countdownTimer.current)

    countdownTimer.current = setInterval(() => {
      setCooldownSecs(s => {
        if (s <= 1) {
          clearInterval(countdownTimer.current)
          return 0
        }
        return s - 1
      })
    }, 1000)

    cooldownTimer.current = setTimeout(() => {
      setCooldown(false)
      setCooldownSecs(0)
    }, REFRESH_COOLDOWN_MS)

    setLoading(true)
    setError(false)

    try {
      const headers = await getAuthHeader()
      const { data } = await axios.get(`${BACKEND}/api/ai/demand-forecast`, { headers })
      setForecasts(data || [])
    } catch (e) {
      console.error('Forecast error:', e)
      setError(true)
    }

    setLoading(false)
  }

  // Initial load — bypass cooldown
  useEffect(() => {
    load(true)
    return () => {
      clearTimeout(cooldownTimer.current)
      clearInterval(countdownTimer.current)
    }
  }, [])

  const sorted = [...forecasts].sort((a, b) =>
    sortBy === 'days'
      ? (a.days_until_stockout ?? 999) - (b.days_until_stockout ?? 999)
      : (b.forecast_30d_need   ?? 0)   - (a.forecast_30d_need   ?? 0)
  )

  const urgentCount = forecasts.filter(f => (f.days_until_stockout ?? 999) <= 7).length

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(126,255,212,0.08)', border: '1px solid rgba(126,255,212,0.18)' }}
          >
            <Brain size={15} style={{ color: '#7effd4' }} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-white text-sm">Demand Forecast</h3>
            <p className="text-xs text-muted">
              AI-powered · next 30 days · cached 1hr
              {urgentCount > 0 && (
                <span style={{ color: '#f87171' }}> · {urgentCount} urgent</span>
              )}
            </p>
          </div>
        </div>

        {/* Refresh button with cooldown */}
        <button
          onClick={() => load(false)}
          disabled={cooldown || loading}
          title={cooldown ? `Available in ${cooldownSecs}s` : 'Refresh forecast'}
          className="btn-ghost p-2 rounded-xl disabled:opacity-40 relative"
          style={{ minWidth: 32 }}
        >
          {cooldown && !loading ? (
            <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
              {cooldownSecs}s
            </span>
          ) : (
            <RefreshCw
              size={14}
              className={loading ? 'animate-spin' : ''}
              style={{ color: 'var(--muted)' }}
            />
          )}
        </button>
      </div>

      {/* Sort toggle */}
      <div className="flex gap-1 p-1 rounded-xl border border-border w-fit" style={{ background: 'var(--card)' }}>
        {[
          { key: 'days', label: 'Stockout risk' },
          { key: 'need', label: '30-day need'   },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={
              sortBy === key
                ? { background: 'rgba(126,255,212,0.1)', color: '#7effd4' }
                : { color: 'var(--muted)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(126,255,212,0.4)', borderTopColor: '#7effd4' }}
          />
        </div>
      ) : error ? (
        <div className="text-center py-8 space-y-2">
          <AlertCircle size={24} className="mx-auto opacity-30" style={{ color: '#f87171' }} />
          <p className="text-sm text-muted">Couldn't load forecast</p>
          <p className="text-xs text-muted opacity-60">Make sure your backend is running</p>
          <button
            onClick={() => load(true)}
            className="text-xs mt-2"
            style={{ color: '#7effd4' }}
          >
            Try again
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-8 space-y-1">
          <TrendingDown size={24} className="mx-auto opacity-20 text-muted" />
          <p className="text-sm text-muted">Not enough movement data yet</p>
          <p className="text-xs text-muted opacity-60">Log some stock movements to enable forecasting</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {sorted.map((f, i) => {
            const days   = f.days_until_stockout
            const urgent = days !== null && days !== undefined && days <= 7
            const conf   = CONF[f.confidence] || CONF.low

            return (
              <motion.div
                key={f.product_name + i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-3 rounded-xl space-y-2"
                style={{
                  background: urgent ? 'rgba(248,113,113,0.04)' : 'rgba(255,255,255,0.02)',
                  border: urgent
                    ? '1px solid rgba(248,113,113,0.18)'
                    : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {urgent && (
                        <AlertCircle size={11} style={{ color: '#f87171', flexShrink: 0 }} />
                      )}
                      <p className="text-sm font-medium text-white truncate">{f.product_name}</p>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {f.daily_avg_consumption} units/day · {f.current_stock} on hand
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                    style={{ background: conf.bg, color: conf.color }}
                  >
                    {conf.label}
                  </span>
                </div>

                <DaysBar days={days} />

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-muted">
                    <Clock size={10} />
                    <span>
                      {!days || days > 90
                        ? 'No stockout risk'
                        : `Stockout in ~${days} days`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" style={{ color: '#7effd4' }}>
                    <TrendingDown size={10} />
                    <span>Need {f.forecast_30d_need} next 30d</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
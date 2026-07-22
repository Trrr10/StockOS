import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import {
  Package, ShoppingCart, Factory, Shield,
  ArrowRight, Zap, BarChart3, Lock, Layers, ChevronDown,
  Sparkles, TrendingUp, AlertTriangle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const ACCENT = '#7effd4'

const roles = [
  {
    id: 'admin',
    title: 'Admin',
    subtitle: 'Full system control',
    icon: Shield,
    color: '#3FAAFF',
    glow: 'rgba(63,170,255,0.3)',
    perks: ['System-wide analytics', 'User management', 'AI anomaly feed', 'Full audit trail'],
  },
  {
    id: 'inventory_manager',
    title: 'Inventory',
    subtitle: 'Stock operations',
    icon: Package,
    color: '#7EFF6E',
    glow: 'rgba(126,255,110,0.3)',
    perks: ['Real-time stock levels', 'Barcode scanning', 'Stock commit system', 'AI reorder alerts'],
  },
  {
    id: 'sales',
    title: 'Sales & Dispatch',
    subtitle: 'Orders & delivery',
    icon: ShoppingCart,
    color: '#FFB83F',
    glow: 'rgba(255,184,63,0.3)',
    perks: ['Order lifecycle tracking', 'Stock availability check', 'ETA estimation', 'Delivery confirmation'],
  },
  {
    id: 'procurement_manager',
    title: 'Procurement',
    subtitle: 'Purchasing & manufacturing',
    icon: Factory,
    color: '#FF6E9C',
    glow: 'rgba(255,110,156,0.3)',
    perks: ['Auto PO generation', 'WIP batch tracker', 'Supplier scorecards', 'Yield & waste reports'],
  },
]

const stats = [
  { value: '99.9%', label: 'Uptime SLA', icon: TrendingUp },
  { value: '<50ms', label: 'Real-time latency', icon: Zap },
  { value: '4 Roles', label: 'Access layers', icon: Layers },
  { value: 'AI-First', label: 'Groq-powered', icon: Sparkles },
]

const features = [
  {
    icon: Lock,
    title: 'Stock Commit System',
    desc: 'Before any order moves to packing, inventory is hard-reserved. Zero double-booking, zero surprises.',
    color: '#7EFF6E',
    tag: 'Zero conflicts',
  },
  {
    icon: Zap,
    title: 'Real-time Conflict Detection',
    desc: 'Two orders targeting the same last units? The system flags both instantly and alerts the right people.',
    color: '#3FAAFF',
    tag: 'Instant alerts',
  },
  {
    icon: BarChart3,
    title: 'Auto PO Generation',
    desc: 'Hit a reorder threshold? Groq drafts the purchase order pre-filled with optimal quantities. One click to approve.',
    color: '#FFB83F',
    tag: 'AI-drafted',
  },
]

/* ─── Floating particle field ─────────────────────── */
function Particles() {
  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() > 0.7 ? 2 : 1,
    duration: 4 + Math.random() * 6,
    delay: Math.random() * 5,
    opacity: 0.15 + Math.random() * 0.35,
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: ACCENT,
          }}
          animate={{ y: [0, -40, 0], opacity: [p.opacity * 0.5, p.opacity, p.opacity * 0.5] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

/* ─── Animated grid background ───────────────────── */
function GridBg() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(rgba(126,255,212,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(126,255,212,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }}
    />
  )
}

/* ─── Radial glow behind hero ─────────────────────── */
function HeroGlow() {
  return (
    <div
      className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{
        width: 900,
        height: 600,
        background: 'radial-gradient(ellipse at center top, rgba(126,255,212,0.07) 0%, transparent 65%)',
      }}
    />
  )
}

/* ─── Role card ───────────────────────────────────── */
function RoleCard({ role, index }) {
  const Icon = role.icon
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: index * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer"
    >
      <motion.div
        animate={{
          boxShadow: hovered ? `0 0 60px ${role.glow}, 0 0 120px ${role.glow.replace('0.3', '0.1')}` : '0 0 0px transparent',
          borderColor: hovered ? role.color + '50' : 'rgba(255,255,255,0.07)',
        }}
        transition={{ duration: 0.3 }}
        className="relative rounded-2xl p-6 overflow-hidden h-full"
        style={{ background: '#0d0e1a', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* top glow streak */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-px"
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          style={{ background: `linear-gradient(90deg, transparent, ${role.color}80, transparent)` }}
        />

        {/* scan line */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              className="absolute inset-x-0 h-px pointer-events-none"
              style={{ background: `linear-gradient(90deg, transparent, ${role.color}60, transparent)` }}
              initial={{ top: 0, opacity: 0 }}
              animate={{ top: '100%', opacity: [0, 0.6, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </AnimatePresence>

        {/* bg tint */}
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          style={{ background: `radial-gradient(ellipse at top left, ${role.color}08 0%, transparent 60%)` }}
        />

        <div className="relative z-10">
          <motion.div
            animate={{
              background: hovered ? `${role.color}20` : `${role.color}10`,
              boxShadow: hovered ? `0 0 24px ${role.color}40` : 'none',
            }}
            transition={{ duration: 0.3 }}
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
            style={{ border: `1px solid ${role.color}25` }}
          >
            <Icon size={20} style={{ color: role.color }} />
          </motion.div>

          <h3
            className="font-bold text-lg text-white mb-1 tracking-tight"
            style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}
          >
            {role.title}
          </h3>
          <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>{role.subtitle}</p>

          <ul className="space-y-2.5">
            {role.perks.map((perk, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 + i * 0.06 }}
                className="flex items-center gap-2.5 text-sm"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                <div
                  className="shrink-0 rounded-full"
                  style={{ width: 5, height: 5, background: role.color, boxShadow: `0 0 6px ${role.color}` }}
                />
                {perk}
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Feature card ────────────────────────────────── */
function FeatureCard({ feature, index }) {
  const Icon = feature.icon
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: index * 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-2xl p-7 cursor-default"
      style={{
        background: '#0d0e1a',
        border: `1px solid ${hovered ? feature.color + '30' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: hovered ? `0 8px 48px rgba(0,0,0,0.5), 0 0 40px ${feature.color}15` : '0 4px 24px rgba(0,0,0,0.3)',
        transition: 'all 0.35s ease',
      }}
    >
      {/* top accent line */}
      <div
        className="absolute top-0 left-6 right-6 h-px rounded-full transition-all duration-500"
        style={{
          background: `linear-gradient(90deg, transparent, ${feature.color}${hovered ? '80' : '30'}, transparent)`,
        }}
      />

      <div className="flex items-start justify-between mb-5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{
            background: `${feature.color}12`,
            border: `1px solid ${feature.color}25`,
            boxShadow: hovered ? `0 0 20px ${feature.color}30` : 'none',
            transition: 'box-shadow 0.3s ease',
          }}
        >
          <Icon size={18} style={{ color: feature.color }} />
        </div>

        <span
          className="text-xs font-mono px-2.5 py-1 rounded-full"
          style={{
            background: `${feature.color}10`,
            border: `1px solid ${feature.color}25`,
            color: feature.color,
          }}
        >
          {feature.tag}
        </span>
      </div>

      <h3
        className="font-bold text-white text-lg mb-3 tracking-tight"
        style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}
      >
        {feature.title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {feature.desc}
      </p>
    </motion.div>
  )
}

/* ─── Stat card ───────────────────────────────────── */
function StatCard({ stat, index }) {
  const Icon = stat.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 + index * 0.1 }}
      className="text-center group"
    >
      <div
        className="inline-flex items-center justify-center w-9 h-9 rounded-xl mb-3 mx-auto"
        style={{ background: 'rgba(126,255,212,0.06)', border: '1px solid rgba(126,255,212,0.12)' }}
      >
        <Icon size={15} style={{ color: ACCENT }} />
      </div>
      <div
        className="font-black text-2xl text-white mb-1 tracking-tight"
        style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}
      >
        {stat.value}
      </div>
      <div className="text-xs font-medium tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {stat.label}
      </div>
    </motion.div>
  )
}

/* ─── Main page ───────────────────────────────────── */
export default function HomePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const heroRef = useRef(null)
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 600], [0, -80])
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])

  useEffect(() => {
    if (user && profile) {
      const routes = {
        admin: '/admin/dashboard',
        inventory_manager: '/inventory/dashboard',
        sales: '/sales/dashboard',
        procurement_manager: '/procurement/dashboard',
      }
      navigate(routes[profile.role] || '/inventory/dashboard')
    }
  }, [user, profile])

  return (
    <div
      className="min-h-screen relative"
      style={{ background: '#07080f', color: '#e2e8f0', fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <GridBg />

      {/* ── NAVBAR ── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-4"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          background: 'rgba(7,8,15,0.8)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'rgba(126,255,212,0.08)',
              border: '1px solid rgba(126,255,212,0.2)',
              boxShadow: '0 0 16px rgba(126,255,212,0.1)',
            }}
          >
            <Layers size={15} style={{ color: ACCENT }} />
          </div>
          <span
            className="font-bold text-white text-lg tracking-tight"
            style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}
          >
            StockOS
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="hidden md:flex items-center gap-8 text-sm"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          {['Features', 'Roles'].map(link => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="transition-colors duration-200 hover:text-white relative group"
            >
              {link}
              <span
                className="absolute -bottom-0.5 left-0 right-0 h-px scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
                style={{ background: ACCENT }}
              />
            </a>
          ))}
        </motion.div>

        <motion.button
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{
            background: ACCENT,
            color: '#07080f',
            boxShadow: '0 0 24px rgba(126,255,212,0.3)',
          }}
        >
          Sign In <ArrowRight size={14} />
        </motion.button>
      </nav>

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="relative flex flex-col items-center justify-center text-center px-6 pt-28 pb-16"
        style={{ minHeight: '100vh' }}
      >
        <HeroGlow />
        <Particles />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 flex flex-col items-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-mono mb-10"
            style={{
              border: '1px solid rgba(126,255,212,0.2)',
              background: 'rgba(126,255,212,0.05)',
              color: ACCENT,
              letterSpacing: '0.08em',
            }}
          >
            <motion.span
              className="w-2 h-2 rounded-full"
              style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            AI-POWERED INVENTORY INTELLIGENCE
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="font-black leading-none tracking-tighter mb-7"
            style={{
              fontFamily: "'Clash Display', 'DM Sans', sans-serif",
              fontSize: 'clamp(52px, 8vw, 100px)',
              maxWidth: 900,
            }}
          >
            <span className="text-white">StockOS</span>
            <br />
            <span
              style={{
                color: ACCENT,
                textShadow: `0 0 60px rgba(126,255,212,0.5), 0 0 120px rgba(126,255,212,0.2)`,
              }}
            >
              perfected.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="text-lg leading-relaxed mb-12 max-w-xl"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            End-to-end inventory intelligence with real-time stock commits,
            AI-powered reorder suggestions, and conflict detection —
            built for operations teams that can't afford mistakes.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 items-center mb-20"
          >
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: '0 0 60px rgba(126,255,212,0.5)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="flex items-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold"
              style={{
                background: ACCENT,
                color: '#07080f',
                boxShadow: '0 0 32px rgba(126,255,212,0.35)',
              }}
            >
              Get Started Free <ArrowRight size={16} />
            </motion.button>

            <motion.a
              href="#roles"
              whileHover={{ color: '#ffffff' }}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Explore roles
              <motion.span animate={{ y: [0, 4, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>
                <ChevronDown size={14} />
              </motion.span>
            </motion.a>
          </motion.div>

          {/* Stats */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 px-8 py-6 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {stats.map((s, i) => <StatCard key={i} stat={s} index={i} />)}
          </div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ color: 'rgba(255,255,255,0.2)' }}
        >
          <ChevronDown size={20} />
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-28 px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div
            className="inline-flex items-center gap-2 text-xs font-mono mb-5 px-3 py-1.5 rounded-full"
            style={{
              color: ACCENT,
              border: '1px solid rgba(126,255,212,0.15)',
              background: 'rgba(126,255,212,0.04)',
              letterSpacing: '0.1em',
            }}
          >
            <AlertTriangle size={11} />
            CORE FEATURES
          </div>
          <h2
            className="font-black text-white mb-4"
            style={{
              fontFamily: "'Clash Display', 'DM Sans', sans-serif",
              fontSize: 'clamp(32px, 5vw, 52px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            The architecture that solves
            <br />
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>every failure mode.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => <FeatureCard key={i} feature={f} index={i} />)}
        </div>
      </section>

      {/* ── ROLES ── */}
      <section id="roles" className="py-28 px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div
            className="inline-flex items-center gap-2 text-xs font-mono mb-5 px-3 py-1.5 rounded-full"
            style={{
              color: ACCENT,
              border: '1px solid rgba(126,255,212,0.15)',
              background: 'rgba(126,255,212,0.04)',
              letterSpacing: '0.1em',
            }}
          >
            <Shield size={11} />
            ROLE-BASED ACCESS
          </div>
          <h2
            className="font-black text-white mb-4"
            style={{
              fontFamily: "'Clash Display', 'DM Sans', sans-serif",
              fontSize: 'clamp(32px, 5vw, 52px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            Four roles.{' '}
            <span style={{ color: ACCENT, textShadow: '0 0 40px rgba(126,255,212,0.4)' }}>One system.</span>
          </h2>
          <p className="max-w-lg mx-auto text-base" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Each role sees exactly what they need — no more, no less.
            Powered by Supabase RLS down to the row level.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roles.map((r, i) => <RoleCard key={r.id} role={r} index={i} />)}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-14"
        >
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 60px rgba(126,255,212,0.45)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold"
            style={{
              background: ACCENT,
              color: '#07080f',
              boxShadow: '0 0 32px rgba(126,255,212,0.3)',
            }}
          >
            Sign in to your workspace <ArrowRight size={16} />
          </motion.button>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="py-8 px-6 text-center text-sm"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.3)',
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Layers size={13} style={{ color: ACCENT }} />
          <span
            className="font-bold text-white"
            style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}
          >
            StockOS
          </span>
        </div>
        <p>Built with Supabase · Groq · FastAPI · React</p>
      </footer>
    </div>
  )
}
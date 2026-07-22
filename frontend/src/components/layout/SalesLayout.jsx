import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Factory, MapPin, LayoutDashboard,
  Layers, LogOut, ChevronLeft, ChevronRight,
  Menu, X, User
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const NAV_ITEMS = [
  { to: '/sales/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/sales/orders',        label: 'Orders',        icon: ShoppingCart    },
  { to: '/sales/manufacturing', label: 'Manufacturing', icon: Factory         },
  { to: '/sales/tracking',      label: 'Tracking Map',  icon: MapPin          },
]

const ACCENT = '#7effd4'

export default function SalesLayout() {
  const { user, profile } = useAuth()
  const navigate          = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const initials = (profile?.full_name || user?.email || 'SM')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: '#07080f', color: '#e2e8f0', fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? 68 : 232 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`
          relative z-50 flex flex-col shrink-0 h-full overflow-hidden
          border-r border-white/[0.06]
          fixed md:relative
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          transition-transform md:transition-none
        `}
        style={{ background: '#0d0e1a' }}
      >

        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.05] shrink-0"
          style={{ minHeight: 64 }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(126,255,212,0.08)',
              border: '1px solid rgba(126,255,212,0.2)',
            }}
          >
            <Layers size={15} style={{ color: ACCENT }} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <p
                  className="font-bold text-white text-base leading-tight tracking-tight"
                  style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}
                >
                  StockOS
                </p>
                <p className="text-xs mt-0.5" style={{ color: ACCENT }}>
                  Sales & Dispatch
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/sales/dashboard'}
              onClick={() => setMobileOpen(false)}
            >
              {({ isActive }) => (
                <motion.div
                  whileHover={{ x: collapsed ? 0 : 2 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 relative group"
                  style={{
                    background: isActive ? 'rgba(126,255,212,0.08)' : 'transparent',
                    border: isActive
                      ? '1px solid rgba(126,255,212,0.18)'
                      : '1px solid transparent',
                  }}
                  title={collapsed ? label : undefined}
                >
                  {/* Active left bar */}
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                      style={{ background: ACCENT }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}

                  <Icon
                    size={17}
                    style={{
                      color: isActive ? ACCENT : 'rgba(255,255,255,0.4)',
                      flexShrink: 0,
                      transition: 'color 0.2s',
                    }}
                  />

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.16 }}
                        className="text-sm font-medium whitespace-nowrap overflow-hidden"
                        style={{
                          color: isActive ? ACCENT : 'rgba(255,255,255,0.55)',
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Tooltip when collapsed */}
                  {collapsed && (
                    <div
                      className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium
                        opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50
                        transition-opacity duration-150"
                      style={{
                        background: '#1a1b2e',
                        border: '1px solid rgba(75,77,107,0.5)',
                        color: '#e2e3ef',
                      }}
                    >
                      {label}
                    </div>
                  )}
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: user + logout */}
        <div className="px-2 pb-4 space-y-1 border-t border-white/[0.05] pt-3 shrink-0">

          {/* User pill */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: 'rgba(126,255,212,0.12)',
                border: '1px solid rgba(126,255,212,0.2)',
                color: ACCENT,
                fontFamily: 'monospace',
              }}
            >
              {initials}
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.16 }}
                  className="min-w-0 overflow-hidden"
                >
                  <p className="text-xs font-medium text-white truncate leading-tight">
                    {profile?.full_name || 'Sales Manager'}
                  </p>
                  <p
                    className="text-[10px] truncate mt-0.5"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    {user?.email || ''}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Logout */}
          <motion.button
            whileHover={{ x: collapsed ? 0 : 2 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
            style={{ border: '1px solid transparent' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(251,113,133,0.08)'
              e.currentTarget.style.borderColor = 'rgba(251,113,133,0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }}
            title={collapsed ? 'Log out' : undefined}
          >
            <LogOut
              size={16}
              style={{ color: 'rgba(251,113,133,0.6)', flexShrink: 0, transition: 'color 0.2s' }}
              className="group-hover:!text-rose-400"
            />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.16 }}
                  className="text-sm font-medium whitespace-nowrap"
                  style={{ color: 'rgba(251,113,133,0.6)' }}
                >
                  Log out
                </motion.span>
              )}
            </AnimatePresence>

            {collapsed && (
              <div
                className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50
                  transition-opacity duration-150"
                style={{
                  background: '#1a1b2e',
                  border: '1px solid rgba(75,77,107,0.5)',
                  color: '#fb7185',
                }}
              >
                Log out
              </div>
            )}
          </motion.button>

          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden md:flex w-full items-center gap-3 px-3 py-2 rounded-xl
              text-xs transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.25)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
          >
            {collapsed
              ? <ChevronRight size={14} style={{ flexShrink: 0 }} />
              : <><ChevronLeft size={14} style={{ flexShrink: 0 }} /><span>Collapse</span></>
            }
          </button>
        </div>
      </motion.aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile topbar */}
        <div
          className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0"
          style={{ background: '#0d0e1a' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(126,255,212,0.08)', border: '1px solid rgba(126,255,212,0.2)' }}
            >
              <Layers size={13} style={{ color: ACCENT }} />
            </div>
            <span
              className="font-bold text-white text-sm tracking-tight"
              style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}
            >
              StockOS
            </span>
            <span className="text-xs" style={{ color: ACCENT }}>Sales</span>
          </div>
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="p-2 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: '#07080f' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
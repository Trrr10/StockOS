// AdminLayout.jsx — Sidebar + TopBar shell for all admin/staff routes
// Styled to match InventoryLayout: framer-motion animations, glassmorphic topbar,
// animated sidebar pill, hover hints, notification dropdown, live pulse indicator.

import React, { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, ShoppingCart, Factory,
  BarChart3, Users, Megaphone, Shield, Settings,
  LogOut, ChevronRight, Bell, Menu, X,
  TrendingUp, Truck, ClipboardList, Scan,
  MessageSquare, Bot, Gauge, RefreshCw, Warehouse,
  FileText, Zap, AlertTriangle, Flag,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// ─── Navigation config ────────────────────────────────────────────────────────
// Roles helper — add any new roles here once, rather than editing every nav item
const IM = 'inventory_manager' // shorthand

export const NAV_SECTIONS = [
  {
    section: 'Overview',
    items: [
      { to: '/admin/dashboard',        icon: LayoutDashboard, label: 'Dashboard',         desc: 'Home',       roles: ['admin'] },
      { to: '/sales/dashboard',        icon: TrendingUp,      label: 'Sales Dashboard',   desc: 'Revenue',    roles: ['sales_manager', 'admin', IM] },
      { to: '/procurement/dashboard',  icon: Gauge,           label: 'Procurement',       desc: 'Buying',     roles: ['admin', 'sales_manager', IM] },
      { to: '/inventory/dashboard',    icon: Warehouse,       label: 'Inventory',         desc: 'Stock',      roles: ['warehouse_staff', 'admin', 'sales_manager', IM] },
    ],
  },
  {
    section: 'Operations',
    items: [
      { to: '/sales/orders',                icon: ShoppingCart,  label: 'Orders',           desc: 'All orders', roles: ['sales_manager', 'admin', IM] },
      { to: '/sales/manufacturing',         icon: Factory,       label: 'Manufacturing',    desc: 'Production', roles: ['manufacturer', 'admin', IM] },
      { to: '/sales/tracking',              icon: Truck,         label: 'Tracking Map',     desc: 'Live map',   roles: ['sales_manager', 'admin', IM] },
      { to: '/procurement/purchase-orders', icon: ClipboardList, label: 'Purchase Orders',  desc: 'PO list',    roles: ['admin', 'sales_manager', IM] },
      { to: '/procurement/suppliers',       icon: Users,         label: 'Suppliers',        desc: 'Vendors',    roles: ['admin', 'sales_manager', IM] },
      { to: '/procurement/auto-generate',   icon: Zap,           label: 'Auto Generate PO', desc: 'Smart PO',   roles: ['admin', IM] },
    ],
  },
  {
    section: 'Inventory Tools',
    items: [
      { to: '/inventory/products',        icon: Package,   label: 'Products',          desc: 'Catalog',    roles: ['warehouse_staff', 'admin', 'sales_manager', IM] },
      { to: '/inventory/adjustments',     icon: RefreshCw, label: 'Stock Adjustments', desc: 'In/out',     roles: ['warehouse_staff', 'admin', IM] },
      { to: '/inventory/traffic-lights',  icon: Gauge,     label: 'Traffic Lights',    desc: 'Status',     roles: ['admin', 'sales_manager', 'warehouse_staff', IM] },
      { to: '/inventory/demand-forecast', icon: BarChart3, label: 'Demand Forecast',   desc: 'AI-powered', roles: ['admin', 'sales_manager', IM] },
      { to: '/inventory/barcode',         icon: Scan,      label: 'Barcode Scanner',   desc: 'Scan items', roles: ['warehouse_staff', 'admin', IM] },
      { to: '/inventory/audit',           icon: FileText,  label: 'Audit Trail',       desc: 'History',    roles: ['admin', 'accountant', IM] },
    ],
  },
  {
    section: 'Collaboration',
    items: [
      { to: '/inventory/chat',   icon: MessageSquare, label: 'Group Chat',    desc: 'Team',    roles: ['admin', 'sales_manager', 'warehouse_staff', 'manufacturer', 'accountant', IM] },
      { to: '/inventory/ai',     icon: Bot,           label: 'AI Assistant',  desc: 'Groq AI', roles: ['admin', 'sales_manager', IM] },
      { to: '/inventory/report', icon: Flag,          label: 'Submit Report', desc: 'Anon',    roles: ['admin', 'sales_manager', 'warehouse_staff', 'manufacturer', 'accountant', IM] },
    ],
  },
  {
    section: 'Admin',
    items: [
      { to: '/admin/broadcast',         icon: Megaphone, label: 'Broadcast',    desc: 'Announce', roles: ['admin', IM] },
      { to: '/admin/anonymous-reports', icon: Shield,    label: 'Anon Reports', desc: 'Review',   roles: ['admin', IM] },
      { to: '/admin/settings',          icon: Settings,  label: 'Settings',     desc: 'Config',   roles: ['admin', IM] },
    ],
  },
]

// ─── Sidebar (pure presentational — no hooks, receives everything as props) ───
function SidebarContent({ profile, onNavigate, onLogout, unreadCount, currentPath }) {
  const [hoveredNav, setHoveredNav] = useState(null)
  const userRole = profile?.role || 'inventory_manager'
  const hasAccess = (roles) => { if (!profile) return true; return userRole === 'admin' || userRole === 'inventory_manager' || roles.includes(userRole) }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.[0] || 'U').toUpperCase()

  let animIndex = 0

  return (
    <>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-obsidian-800/50">
        <motion.div
          animate={{
            boxShadow: [
              '0 0 10px rgba(139,92,246,0.2)',
              '0 0 22px rgba(139,92,246,0.45)',
              '0 0 10px rgba(139,92,246,0.2)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}
        >
          <Package size={16} style={{ color: '#a78bfa' }} />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-white text-sm">StockOS</div>
          <div className="text-xs font-mono truncate capitalize" style={{ color: 'rgba(167,139,250,0.55)' }}>
            {profile?.role?.replace('_', ' ') || 'Admin'}
          </div>
        </div>

        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"
          title="Connected"
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-obsidian-700">
        {NAV_SECTIONS.map(({ section, items }) => {
          const visible = items.filter((i) => hasAccess(i.roles))
          if (!visible.length) return null

          return (
            <div key={section} className="mb-1">
              <p
                className="text-[9px] uppercase tracking-widest font-display px-2 py-2 mt-2 select-none"
                style={{ color: 'rgba(167,139,250,0.35)' }}
              >
                {section}
              </p>

              {visible.map(({ to, icon: Icon, label, desc }) => {
                const active = currentPath === to
                const delay = (animIndex++) * 0.04

                return (
                  <motion.div
                    key={to}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay }}
                    onHoverStart={() => setHoveredNav(to)}
                    onHoverEnd={() => setHoveredNav(null)}
                  >
                    <button
                      onClick={() => onNavigate(to)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative ${
                        active
                          ? 'text-violet-400'
                          : 'text-obsidian-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="admin-sidebar-pill"
                          className="absolute inset-0 rounded-xl"
                          style={{
                            background: 'rgba(139,92,246,0.1)',
                            border: '1px solid rgba(139,92,246,0.22)',
                          }}
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <Icon size={15} className="relative z-10 flex-shrink-0" />
                      <span className="relative z-10 flex-1 text-left">{label}</span>
                      {active && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative z-10"
                        >
                          <ChevronRight size={12} style={{ color: '#a78bfa' }} />
                        </motion.div>
                      )}
                      <AnimatePresence>
                        {hoveredNav === to && !active && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute right-2 text-xs font-mono pointer-events-none z-10"
                            style={{ color: 'rgba(167,139,250,0.4)' }}
                          >
                            {desc}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </motion.div>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Alert strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mx-3 mb-2 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.14)' }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 12, -12, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 4 }}
          >
            <AlertTriangle size={12} style={{ color: '#a78bfa' }} />
          </motion.div>
          <span className="text-xs font-medium" style={{ color: '#a78bfa' }}>
            {unreadCount > 0 ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''}` : 'All clear'}
          </span>
        </div>
      </motion.div>

      {/* User footer */}
      <div className="p-3 border-t border-obsidian-800/50">
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-display font-bold flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-medium truncate">{profile?.full_name || 'User'}</div>
            <div className="text-obsidian-500 text-xs truncate">{profile?.email}</div>
          </div>
          <motion.button
            whileHover={{ scale: 1.2 }}
            onClick={onLogout}
            className="text-obsidian-500 hover:text-rose-400 transition-colors flex-shrink-0"
            title="Sign out"
          >
            <LogOut size={13} />
          </motion.button>
        </motion.div>
      </div>
    </>
  )
}

// ─── AdminLayout ──────────────────────────────────────────────────────────────
export default function AdminLayout({ session, profile, onLogout }) {
  // ── ALL hooks must be declared first, unconditionally ──
  const navigate  = useNavigate()
  const location  = useLocation()
  const [mobileOpen,     setMobileOpen]     = useState(false)
  const [notifOpen,      setNotifOpen]      = useState(false)
  const [notifications,  setNotifications]  = useState([])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Load + subscribe to notifications
  useEffect(() => {
    if (!session?.user?.id) return

    const loadNotifs = async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(8)
        if (data) setNotifications(data)
      } catch (e) {
        console.error('Notif load error:', e)
      }
    }

    loadNotifs()

    const ch = supabase
      .channel('admin-notif-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications((prev) => [payload.new, ...prev.slice(0, 7)])
            toast(payload.new.message, {
              icon: payload.new.type === 'critical' ? '🔴' : payload.new.type === 'warning' ? '🟡' : '🔵',
            })
          } else {
            loadNotifs()
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [session?.user?.id])

  // ── Derived values (no hooks below) ──
  const unreadCount = notifications.length

  const allItems = NAV_SECTIONS.flatMap((s) => s.items)
  const currentPage =
    allItems.find((i) => i.to === location.pathname)?.label ||
    allItems.find((i) => location.pathname.startsWith(i.to))?.label ||
    'StockOS'

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email?.[0] || 'U').toUpperCase()

  async function markAllRead() {
    if (!notifications.length) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', notifications.map((n) => n.id))
    setNotifications([])
  }

  const sidebarProps = {
    profile,
    onNavigate: navigate,
    onLogout,
    unreadCount,
    currentPath: location.pathname,
  }

  return (
    <div className="flex min-h-screen bg-obsidian-950 overflow-hidden">
      <div className="fixed inset-0 bg-grid pointer-events-none" />

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 h-full z-40"
        style={{
          width: '232px',
          background: 'rgba(7,8,15,0.96)',
          borderRight: '1px solid rgba(139,92,246,0.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/65 z-40 md:hidden backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 26, stiffness: 200 }}
              className="fixed left-0 top-0 h-full z-50 md:hidden flex flex-col"
              style={{
                width: '232px',
                background: 'rgba(7,8,15,0.98)',
                borderRight: '1px solid rgba(139,92,246,0.1)',
              }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 text-obsidian-400 hover:text-white"
              >
                <X size={18} />
              </button>
              <SidebarContent
                {...sidebarProps}
                onNavigate={(to) => { navigate(to); setMobileOpen(false) }}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10 md:ml-[232px]">

        {/* Topbar */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5"
          style={{
            background: 'rgba(7,8,15,0.88)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(139,92,246,0.1)',
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden text-obsidian-400 hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>
            <motion.div key={currentPage} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="font-display font-bold text-white text-base">{currentPage}</h1>
              <p className="text-obsidian-500 text-xs hidden md:block capitalize">
                {profile?.role?.replace('_', ' ') || 'Admin panel'}
              </p>
            </motion.div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Notification bell */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => setNotifOpen((o) => !o)}
                className="relative w-9 h-9 rounded-xl flex items-center justify-center text-obsidian-400 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.1)' }}
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                    style={{ background: '#ff4d6d' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </motion.button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 top-11 rounded-xl overflow-hidden shadow-2xl z-50"
                    style={{ background: '#0a0b18', border: '1px solid rgba(139,92,246,0.15)', width: '300px' }}
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-obsidian-800/50">
                      <span className="font-display font-bold text-white text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-obsidian-500 hover:text-violet-400 transition-colors"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-obsidian-500 text-sm">All caught up! 🎉</div>
                    ) : (
                      notifications.map((n, i) => (
                        <motion.div
                          key={n.id}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-3 px-4 py-3 border-b border-obsidian-800/30 last:border-0 hover:bg-white/[0.03] cursor-pointer"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                            n.type === 'critical' ? 'bg-red-400'
                            : n.type === 'warning' ? 'bg-yellow-400'
                            : n.type === 'success' ? 'bg-green-400'
                            : 'bg-violet-400'
                          }`} />
                          <div>
                            <p className="text-xs font-medium text-white">{n.title}</p>
                            <p className="text-xs text-obsidian-500 mt-0.5 leading-relaxed">{n.message}</p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User chip */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.1)' }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}
              >
                {initials}
              </div>
              <span className="text-sm text-white hidden sm:block">
                {profile?.full_name?.split(' ')[0] || 'Admin'}
              </span>
            </motion.div>
          </div>
        </motion.header>

        {/* Page content */}
        <main className="flex-1 p-5 md:p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
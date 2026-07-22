import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, ArrowUpDown, ClipboardList,
  Bot, LogOut, Bell, Menu, X, Layers, MessageSquare,
  AlertTriangle, ChevronRight, ScanLine, Flag
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const NAV = [
  { icon:LayoutDashboard, label:'Dashboard',   path:'/inventory/dashboard',   desc:'Overview' },
  { icon:Package,         label:'Products',    path:'/inventory/products',    desc:'Catalog' },
  { icon:ArrowUpDown,     label:'Adjustments', path:'/inventory/adjustments', desc:'Stock in/out' },
  {icon:ScanLine,        label:'Barcode Gen', path:'/inventory/barcode-generator', desc:'Create barcodes' },
  { icon:ScanLine,        label:'Barcode',     path:'/inventory/barcode',     desc:'Scan items' },
  { icon:ClipboardList,   label:'Audit Trail', path:'/inventory/audit',       desc:'History' },
  { icon:MessageSquare,   label:'Group Chat',  path:'/inventory/chat',        desc:'Team' },
  { icon:Bot,             label:'AI Assistant',path:'/inventory/ai',          desc:'Groq AI' },
  { icon:Flag,            label:'Report',      path:'/inventory/report',      desc:'Anonymous' },
  {icon:Layers,          label:'Traffic Lights', path:'/inventory/traffic-lights', desc:'Stock status' },
  {icon:Layers,          label:'Demand Forecast', path:'/inventory/demand-forecast', desc:'AI-powered' },
]

export default function InventoryLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [notifOpen, setNotifOpen]       = useState(false)
  const [notifications, setNotifications] = useState([])
  const [hoveredNav, setHoveredNav]     = useState(null)

  useEffect(() => {
    // Load notifications
    async function loadNotifs() {
      if (!profile?.id) return
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(8)
      if (data) setNotifications(data)
    }
    loadNotifs()

    // Real-time notifications
    const sub = supabase.channel('notifs-layout')
      .on('postgres_changes', {
        event:'INSERT', schema:'public', table:'notifications',
        filter: profile?.id ? `user_id=eq.${profile.id}` : undefined,
      }, payload => {
        setNotifications(prev => [payload.new, ...prev.slice(0, 7)])
        toast(payload.new.message, {
          icon: payload.new.type === 'critical' ? '🔴' : payload.new.type === 'warning' ? '🟡' : '🔵',
        })
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [profile?.id])

  const unreadCount = notifications.length

  async function handleSignOut() {
    await signOut()
    navigate('/login')
    toast.success('Signed out')
  }

  async function markAllRead() {
    if (!notifications.length) return
    await supabase.from('notifications')
      .update({ is_read: true })
      .in('id', notifications.map(n => n.id))
    setNotifications([])
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const currentPage = NAV.find(n => location.pathname === n.path)?.label
    || NAV.find(n => location.pathname.startsWith(n.path))?.label
    || 'Inventory'

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <motion.div
          animate={{ boxShadow:['0 0 10px rgba(126,255,212,0.2)','0 0 22px rgba(126,255,212,0.45)','0 0 10px rgba(126,255,212,0.2)'] }}
          transition={{ duration:3, repeat:Infinity }}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background:'rgba(126,255,212,0.12)', border:'1px solid rgba(126,255,212,0.25)' }}
        >
          <Layers size={16} style={{ color:'#7effd4' }} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-white text-sm">StockOS</div>
          <div className="text-xs font-mono truncate" style={{ color:'rgba(126,255,212,0.55)' }}>
            {profile?.role?.replace('_', ' ') || 'Inventory'}
          </div>
        </div>
        {/* Live pulse */}
        <motion.div
          animate={{ opacity:[1,0.4,1] }}
          transition={{ duration:2, repeat:Infinity }}
          className="w-2 h-2 rounded-full bg-green-400"
          title="Connected"
        />
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item, i) => {
          const active = location.pathname === item.path
          return (
            <motion.div
              key={item.path}
              initial={{ opacity:0, x:-16 }}
              animate={{ opacity:1, x:0 }}
              transition={{ delay: i * 0.05 }}
              onHoverStart={() => setHoveredNav(item.path)}
              onHoverEnd={() => setHoveredNav(null)}
            >
              <button
                onClick={() => { navigate(item.path); setMobileOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative ${
                  active ? 'nav-active' : 'text-muted hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{ background:'rgba(126,255,212,0.1)', border:'1px solid rgba(126,255,212,0.22)' }}
                    transition={{ type:'spring', stiffness:380, damping:32 }}
                  />
                )}
                <item.icon size={15} className="relative z-10 flex-shrink-0" />
                <span className="relative z-10 flex-1 text-left">{item.label}</span>
                {active && (
                  <motion.div
                    initial={{ opacity:0, scale:0.5 }}
                    animate={{ opacity:1, scale:1 }}
                    className="relative z-10"
                  >
                    <ChevronRight size={12} style={{ color:'#7effd4' }} />
                  </motion.div>
                )}
                {/* Hover hint */}
                <AnimatePresence>
                  {hoveredNav === item.path && !active && (
                    <motion.span
                      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                      className="absolute right-2 text-xs font-mono pointer-events-none z-10"
                      style={{ color:'rgba(126,255,212,0.4)' }}
                    >
                      {item.desc}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          )
        })}
      </nav>

      {/* Critical alert strip */}
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
        className="mx-3 mb-2 px-3 py-2.5 rounded-xl"
        style={{ background:'rgba(255,77,109,0.06)', border:'1px solid rgba(255,77,109,0.14)' }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate:[0,12,-12,0] }}
            transition={{ duration:1.8, repeat:Infinity, repeatDelay:4 }}
          >
            <AlertTriangle size={12} style={{ color:'#f87171' }} />
          </motion.div>
          <span className="text-xs font-medium" style={{ color:'#f87171' }}>
            {unreadCount > 0 ? `${unreadCount} alert${unreadCount > 1 ? 's' : ''}` : 'All clear'}
          </span>
        </div>
      </motion.div>

      {/* User footer */}
      <div className="p-3 border-t border-border">
        <motion.div
          whileHover={{ scale:1.01 }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card"
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-display font-bold flex-shrink-0"
            style={{ background:'rgba(126,255,212,0.15)', border:'1px solid rgba(126,255,212,0.3)', color:'#7effd4' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-medium truncate">{profile?.full_name || 'Manager'}</div>
            <div className="text-muted text-xs truncate">{profile?.email}</div>
          </div>
          <motion.button
            whileHover={{ scale:1.2, color:'#ff4d6d' }}
            onClick={handleSignOut}
            className="text-muted transition-colors flex-shrink-0"
          >
            <LogOut size={13} />
          </motion.button>
        </motion.div>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-obsidian overflow-hidden">
      <div className="fixed inset-0 bg-grid pointer-events-none" />

      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex w-58 flex-col fixed left-0 top-0 h-full z-40"
        style={{
          width: '232px',
          background:'rgba(13,14,26,0.96)',
          borderRight:'1px solid var(--border)',
          backdropFilter:'blur(20px)',
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 bg-black/65 z-40 md:hidden backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x:-240 }} animate={{ x:0 }} exit={{ x:-240 }}
              transition={{ type:'spring', damping:26, stiffness:200 }}
              className="fixed left-0 top-0 h-full z-50 md:hidden flex flex-col"
              style={{ width:'232px', background:'rgba(13,14,26,0.98)', borderRight:'1px solid var(--border)' }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 text-muted hover:text-white"
              >
                <X size={18} />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10" style={{ marginLeft:'232px' }}
        /* mobile: no margin */ >
        <style>{`@media(max-width:767px){.ml-sidebar{margin-left:0}}`}</style>

        {/* Topbar */}
        <motion.header
          initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
          className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5"
          style={{
            background:'rgba(7,8,15,0.88)',
            backdropFilter:'blur(20px)',
            borderBottom:'1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="md:hidden text-muted hover:text-white">
              <Menu size={20} />
            </button>
            <motion.div key={currentPage} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }}>
              <h1 className="font-display font-bold text-white text-base">{currentPage}</h1>
              <p className="text-muted text-xs hidden md:block">
                {profile?.material_group ? `Group: ${profile.material_group}` : 'All material groups'}
              </p>
            </motion.div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Notification bell */}
            <div className="relative">
              <motion.button
                whileHover={{ scale:1.08 }} whileTap={{ scale:0.93 }}
                onClick={() => setNotifOpen(o => !o)}
                className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-card border border-border text-muted hover:text-white transition-colors"
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale:0 }} animate={{ scale:1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                    style={{ background:'#ff4d6d' }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </motion.button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity:0, y:8, scale:0.95 }}
                    animate={{ opacity:1, y:0, scale:1 }}
                    exit={{ opacity:0, y:6, scale:0.95 }}
                    transition={{ duration:0.16 }}
                    className="absolute right-0 top-11 w-76 rounded-xl overflow-hidden shadow-2xl z-50"
                    style={{ background:'#12131f', border:'1px solid var(--border)', width:'300px' }}
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <span className="font-display font-bold text-white text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-muted hover:text-accent transition-colors">
                          Mark all read
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-muted text-sm">All caught up! 🎉</div>
                    ) : (
                      notifications.map((n, i) => (
                        <motion.div
                          key={n.id}
                          initial={{ opacity:0, x:8 }}
                          animate={{ opacity:1, x:0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-3 px-4 py-3 border-b border-border/40 last:border-0 hover:bg-white/[0.03] cursor-pointer"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                            n.type==='critical' ? 'bg-red-400' :
                            n.type==='warning'  ? 'bg-yellow-400' :
                            n.type==='success'  ? 'bg-green-400' : 'bg-blue-400'
                          }`} />
                          <div>
                            <p className="text-xs font-medium text-white">{n.title}</p>
                            <p className="text-xs text-muted mt-0.5 leading-relaxed">{n.message}</p>
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
              whileHover={{ scale:1.02 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border"
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background:'rgba(126,255,212,0.15)', color:'#7effd4' }}>
                {initials}
              </div>
              <span className="text-sm text-white hidden sm:block">
                {profile?.full_name?.split(' ')[0] || 'User'}
              </span>
            </motion.div>
          </div>
        </motion.header>

        {/* Page */}
        <main className="flex-1 p-5 md:p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity:0, y:12 }}
              animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-8 }}
              transition={{ duration:0.25, ease:[0.16,1,0.3,1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
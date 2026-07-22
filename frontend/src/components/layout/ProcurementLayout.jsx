import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { path: '/procurement/dashboard',       label: 'Dashboard',       icon: '📊' },
  { path: '/procurement/purchase-orders', label: 'Purchase Orders', icon: '📋' },
  { path: '/procurement/suppliers',       label: 'Suppliers',       icon: '🏭' },
  { path: '/procurement/auto-generate',   label: 'Auto-Generate',   icon: '⚡' },
]

export default function ProcurementLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  function handleSignOut() {
    navigate('/login')
    signOut()
  }

  const currentLabel = NAV.find(n => location.pathname === n.path)?.label
    || NAV.find(n => location.pathname.startsWith(n.path))?.label
    || 'Procurement'

  const Sidebar = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid #2a3441', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          🏭
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#e6edf3', fontSize: 14 }}>StockOS</div>
          <div style={{ fontSize: 11, color: 'rgba(0,200,150,0.6)', fontFamily: 'monospace', marginTop: 1 }}>procurement</div>
        </div>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00c896', boxShadow: '0 0 6px #00c896' }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px' }}>
        {NAV.map((item) => {
          const active = location.pathname === item.path ||
            (item.path !== '/procurement/dashboard' && location.pathname.startsWith(item.path))
          return (
            <button key={item.path}
              onClick={() => { navigate(item.path); setMobileOpen(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                background: active ? 'rgba(0,200,150,0.1)' : 'transparent',
                border: active ? '1px solid rgba(0,200,150,0.22)' : '1px solid transparent',
                color: active ? '#00c896' : '#8b949e',
                cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                textAlign: 'left', fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e6edf3' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b949e' } }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <span style={{ fontSize: 12, color: 'rgba(0,200,150,0.5)' }}>›</span>}
            </button>
          )
        })}
      </nav>

      {/* User + Sign Out */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid #2a3441' }}>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#1c2230' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,200,150,0.15)', border: '1px solid rgba(0,200,150,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#00c896', flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Manager'}</div>
              <div style={{ fontSize: 11, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%', padding: '8px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)',
              color: '#ff6b6b', fontSize: 12, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,107,107,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,107,107,0.1)'}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d1117' }}>
      <style>{`@media (max-width: 767px) { .proc-sidebar { display: none !important; } .proc-main { margin-left: 0 !important; } }`}</style>

      {/* Desktop sidebar */}
      <aside className="proc-sidebar" style={{
        width: 220, flexShrink: 0, position: 'fixed', left: 0, top: 0, height: '100vh',
        background: 'rgba(13,17,23,0.97)', borderRight: '1px solid #2a3441', zIndex: 40,
      }}>
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
          <aside style={{ position: 'fixed', left: 0, top: 0, height: '100vh', width: 220, background: '#0d1117', borderRight: '1px solid #2a3441', zIndex: 50 }}>
            <Sidebar />
          </aside>
        </>
      )}

      {/* Main */}
      <div className="proc-main" style={{ flex: 1, marginLeft: 220, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Topbar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 28px', background: 'rgba(7,8,15,0.88)',
          borderBottom: '1px solid #2a3441', backdropFilter: 'blur(20px)',
        }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#e6edf3', fontFamily: "'DM Sans', sans-serif" }}>{currentLabel}</h1>
            <p style={{ fontSize: 11, color: '#8b949e', margin: 0 }}>Procurement · {profile?.full_name}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {NAV.filter(n => n.path !== location.pathname).slice(0, 2).map(item => (
              <button key={item.path} onClick={() => navigate(item.path)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a3441', color: '#8b949e', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans', sans-serif" }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,200,150,0.08)'; e.currentTarget.style.color = '#00c896'; e.currentTarget.style.borderColor = 'rgba(0,200,150,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#8b949e'; e.currentTarget.style.borderColor = '#2a3441' }}>
                <span>{item.icon}</span> {item.label}
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#161b22', border: '1px solid #2a3441', borderRadius: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,200,150,0.15)', border: '1px solid rgba(0,200,150,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#00c896' }}>
                {initials}
              </div>
              <span style={{ fontSize: 13, color: '#e6edf3', fontFamily: "'DM Sans', sans-serif" }}>
                {profile?.full_name?.split(' ')[0] || 'Manager'}
              </span>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { signOut } from '../lib/supabase'
import { isMarketOpen } from '../lib/stocks'
import { LayoutDashboard, Briefcase, BarChart3, ShieldCheck, LogOut, TrendingUp } from 'lucide-react'

export default function Layout() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const marketOpen = isMarketOpen()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      {/* TOP BAR */}
      <header className="topbar">
        <div className="topbar-logo">
          <TrendingUp size={20} color="var(--gold)" />
          <div>
            <div className="wordmark">CRAMER TRACKER</div>
            <div className="tagline">vs Jim Cramer</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="market-status">
            <div className={`market-dot ${marketOpen ? 'open' : 'closed'}`} />
            {marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            👤 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {profile?.display_name || profile?.username}
            </span>
            {isAdmin && <span className="badge badge-gold" style={{ marginLeft: 6 }}>ADMIN</span>}
          </div>
        </div>
      </header>

      {/* DESKTOP SIDEBAR */}
      <nav className="sidebar">
        <div className="sidebar-section-label">Navigation</div>

        <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={15} /> Dashboard
        </NavLink>

        <NavLink to="/portfolio" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Briefcase size={15} /> My Portfolio
        </NavLink>

        <NavLink to="/compare" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <BarChart3 size={15} /> vs Cramer
        </NavLink>

        {isAdmin && (
          <>
            <div className="sidebar-section-label">Admin</div>
            <NavLink to="/admin" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <ShieldCheck size={15} /> Cramer Portfolio
            </NavLink>
          </>
        )}

        <div className="sidebar-bottom">
          <button className="sidebar-link" onClick={handleSignOut}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="bottom-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          Dashboard
        </NavLink>

        <NavLink to="/portfolio" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Briefcase size={20} />
          Portfolio
        </NavLink>

        <NavLink to="/compare" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <BarChart3 size={20} />
          vs Cramer
        </NavLink>

        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <ShieldCheck size={20} />
            Admin
          </NavLink>
        )}

        <button className="bottom-nav-item" onClick={handleSignOut}>
          <LogOut size={20} />
          Sign Out
        </button>
      </nav>
    </div>
  )
}

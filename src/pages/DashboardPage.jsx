import { useEffect, useState } from 'react'
import { usePortfolio } from '../lib/usePortfolio'
import { useAuth } from '../lib/auth'
import { getCramerChanges } from '../lib/supabase'
import { RefreshCw } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const fmtPct = (n) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(2)}%`

export default function DashboardPage() {
  const { profile } = useAuth()
  const {
    userCalc, cramerCalc, loadingPortfolio, loadingPrices,
    priceProgress, refreshPrices, cramerPortfolio
  } = usePortfolio()

  const [recentChanges, setRecentChanges] = useState([])
  const [loadingChanges, setLoadingChanges] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoadingChanges(true)
      const { data } = await getCramerChanges(10)
      setRecentChanges(data || [])
      setLoadingChanges(false)
    }
    load()
  }, [])

  if (loadingPortfolio) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spinner" />
    </div>
  )

  const cramerTotal = cramerCalc.totalValue
  const userTotal = userCalc.totalValue
  const diffDollars = userTotal - cramerTotal
  const diffPercent = cramerTotal > 0 ? ((userTotal - cramerTotal) / cramerTotal) * 100 : 0
  const userVsCramerPct = cramerTotal > 0 ? (userTotal / cramerTotal) * 100 : 0

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">DASHBOARD</div>
          <div className="page-subtitle">Welcome back, {profile?.display_name} — here's your performance overview</div>
        </div>
        <button className="btn btn-secondary" onClick={() => refreshPrices()} disabled={loadingPrices}>
          <RefreshCw size={13} />
          {loadingPrices ? `${Math.round(priceProgress)}%` : 'Refresh'}
        </button>
      </div>

      {!cramerPortfolio && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          📢 Jim Cramer's portfolio hasn't been set up yet. Ask your admin to add it via the Admin panel.
        </div>
      )}

      {/* TOP STATS */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className={`stat-card ${diffDollars >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Your Portfolio Value</div>
          <div className="stat-value">{fmt(userTotal)}</div>
          <div className="stat-sub">{fmt(userCalc.stockValue)} stocks + {fmt(userCalc.cashValue)} cash</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cramer's Portfolio Value</div>
          <div className="stat-value gold">{fmt(cramerTotal)}</div>
          <div className="stat-sub">{fmt(cramerCalc.stockValue)} stocks + {fmt(cramerCalc.cashValue)} cash</div>
        </div>
        <div className={`stat-card ${diffDollars >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">Your Lead / Deficit</div>
          <div className={`stat-value ${diffDollars >= 0 ? 'positive' : 'negative'}`}>
            {diffDollars >= 0 ? '+' : ''}{fmt(diffDollars)}
          </div>
          <div className="stat-sub">
            {cramerTotal > 0 ? `${fmtPct(diffPercent)} vs Cramer` : 'No Cramer portfolio yet'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">You Are At</div>
          <div className="stat-value gold">{cramerTotal > 0 ? `${userVsCramerPct.toFixed(1)}%` : '—'}</div>
          <div className="stat-sub">of Cramer's total portfolio value</div>
        </div>
      </div>

      {/* PORTFOLIO SIZE COMPARISON */}
      {cramerTotal > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Portfolio Size Comparison</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
              {userCalc.holdings.length} your holdings | {cramerCalc.holdings.length} Cramer holdings
            </div>
          </div>
          <ComparisonBar label="You" value={userTotal} maxValue={Math.max(userTotal, cramerTotal) * 1.05} color="var(--blue)" />
          <ComparisonBar label="Cramer" value={cramerTotal} maxValue={Math.max(userTotal, cramerTotal) * 1.05} color="var(--gold)" />
        </div>
      )}

      {/* TOP HOLDINGS SIDE BY SIDE */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Your Top Holdings</div>
            <span className="badge badge-blue">{userCalc.holdings.length} stocks</span>
          </div>
          {userCalc.holdings.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <div className="empty-desc">Add holdings in My Portfolio →</div>
            </div>
          ) : (
            userCalc.holdings.slice(0, 5).map(h => (
              <HoldingRow key={h.id} holding={h} totalValue={userTotal} />
            ))
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title"><span className="text-gold">★</span> Cramer's Top Holdings</div>
            <span className="badge badge-gold">{cramerCalc.holdings.length} stocks</span>
          </div>
          {cramerCalc.holdings.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <div className="empty-desc">Cramer portfolio not configured yet</div>
            </div>
          ) : (
            cramerCalc.holdings.slice(0, 5).map(h => (
              <HoldingRow key={h.id} holding={h} totalValue={cramerTotal} gold />
            ))
          )}
        </div>
      </div>

      {/* RECENT CRAMER CHANGES - FULL WIDTH */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📺 Recent Cramer Changes</div>
          <span className="badge badge-gray">Last 10</span>
        </div>

        {loadingChanges ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : recentChanges.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-icon">📋</div>
            <div className="empty-title">No Changes Yet</div>
            <div className="empty-desc">Changes to Cramer's portfolio will appear here</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 0 }}>
            {recentChanges.map(change => (
              <ChangeRow key={change.id} change={change} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ChangeRow({ change }) {
  const actionColor = { ADD: 'var(--green)', UPDATE: 'var(--blue)', REMOVE: 'var(--red)' }[change.action] || 'var(--text-secondary)'
  const actionBg = { ADD: 'var(--green-bg)', UPDATE: 'var(--blue-bg)', REMOVE: 'var(--red-bg)' }[change.action] || 'var(--bg-hover)'
  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

  const date = new Date(change.changed_at)
  const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const sharesChange = () => {
    if (change.action === 'ADD') return `+${parseFloat(change.new_shares).toLocaleString(undefined, { maximumFractionDigits: 2 })} shares`
    if (change.action === 'REMOVE') return `−${parseFloat(change.old_shares).toLocaleString(undefined, { maximumFractionDigits: 2 })} shares`
    if (change.action === 'UPDATE') {
      const diff = (change.new_shares || 0) - (change.old_shares || 0)
      return `${diff >= 0 ? '+' : ''}${diff.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares (${parseFloat(change.new_shares).toLocaleString(undefined, { maximumFractionDigits: 2 })} total)`
    }
    return ''
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--border-dim)' }}>
      <div style={{
        width: 56, textAlign: 'center', padding: '3px 6px',
        background: actionBg, border: `1px solid ${actionColor}`,
        borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9,
        fontWeight: 700, color: actionColor, letterSpacing: 1, flexShrink: 0
      }}>
        {change.action}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>
            {change.symbol}
          </span>
          {change.company_name && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {change.company_name}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          {sharesChange()}
          {change.price_at_change && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>@ {fmt(change.price_at_change)}</span>
          )}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
        {timeStr}
      </div>
    </div>
  )
}

function ComparisonBar({ label, value, maxValue, color }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
  const fmtCompact = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div style={{ width: 60, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 28, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color, borderRadius: 3,
          transition: 'width 0.5s ease', display: 'flex', alignItems: 'center',
          paddingLeft: 8, minWidth: 2
        }}>
          {pct > 15 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#000' }}>
              {fmtCompact(value)}
            </span>
          )}
        </div>
      </div>
      {pct <= 15 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', width: 60 }}>
          {fmtCompact(value)}
        </div>
      )}
    </div>
  )
}

function HoldingRow({ holding, totalValue, gold }) {
  const pct = totalValue > 0 ? (holding.value / totalValue) * 100 : 0
  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-dim)' }}>
      <div style={{ width: 44, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: gold ? 'var(--gold)' : 'var(--text-primary)' }}>
        {holding.symbol}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2 }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: gold ? 'var(--gold)' : 'var(--blue)', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        <div style={{ color: 'var(--text-primary)' }}>{fmt(holding.value)}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{pct.toFixed(1)}%</div>
      </div>
      <div style={{ width: 60, textAlign: 'right' }}>
        <span className={`change-badge ${holding.changePercent > 0 ? 'up' : holding.changePercent < 0 ? 'down' : 'flat'}`}>
          {holding.changePercent >= 0 ? '▲' : '▼'}{Math.abs(holding.changePercent).toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

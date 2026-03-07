import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { usePortfolio } from '../lib/usePortfolio'
import { updatePortfolioCash, upsertHolding, deleteHolding, logCramerChange } from '../lib/supabase'
import { validateSymbol } from '../lib/stocks'
import { Plus, Trash2, RefreshCw, ShieldCheck, DollarSign, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

export default function AdminPage() {
  const { user } = useAuth()
  const { cramerPortfolio, cramerCalc, loadingPortfolio, refreshPrices, loadPortfolios } = usePortfolio()

  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState('')
  const [cashInput, setCashInput] = useState('')
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [symbolInfo, setSymbolInfo] = useState(null)
  const [showCashModal, setShowCashModal] = useState(false)
  const [initializingPortfolio, setInitializingPortfolio] = useState(false)
  const [adminSortField, setAdminSortField] = useState('value')
  const [adminSortDir, setAdminSortDir] = useState('desc')

  const handleAdminSort = (field) => {
    if (adminSortField === field) {
      setAdminSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setAdminSortField(field)
      setAdminSortDir('desc')
    }
  }

  const SortIcon = ({ field }) => {
    if (adminSortField !== field) return <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />
    return adminSortDir === 'asc'
      ? <ChevronUp size={12} style={{ color: 'var(--gold)' }} />
      : <ChevronDown size={12} style={{ color: 'var(--gold)' }} />
  }

  const sortedCramerHoldings = [...cramerCalc.holdings].sort((a, b) => {
    let aVal, bVal
    switch (adminSortField) {
      case 'symbol':
        return adminSortDir === 'asc'
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol)
      case 'shares': aVal = parseFloat(a.shares); bVal = parseFloat(b.shares); break
      case 'price': aVal = a.currentPrice; bVal = b.currentPrice; break
      case 'value': aVal = a.value; bVal = b.value; break
      case 'pct': aVal = a.pctOfPortfolio; bVal = b.pctOfPortfolio; break
      default: aVal = a.value; bVal = b.value
    }
    return adminSortDir === 'asc' ? aVal - bVal : bVal - aVal
  })

  const handleInitCramerPortfolio = async () => {
    setInitializingPortfolio(true)
    setError('')
    try {
      const { supabase: sb } = await import('../lib/supabase')
      const { data, error } = await sb
        .from('portfolios')
        .insert({ user_id: user.id, name: 'Jim Cramer Mad Money Portfolio', is_cramer: true, cash_balance: 0 })
        .select()
        .single()
      if (error) throw error
      await loadPortfolios()
      setSuccess("Cramer's portfolio initialized!")
    } catch (e) {
      setError(e.message)
    } finally {
      setInitializingPortfolio(false)
    }
  }

  const handleSymbolBlur = async () => {
    if (!symbol) return
    setValidating(true)
    setSymbolInfo(null)
    setError('')
    const { valid, data } = await validateSymbol(symbol)
    setValidating(false)
    if (valid) setSymbolInfo(data)
    else setError(`Invalid symbol: ${symbol.toUpperCase()}`)
  }

  const handleAddHolding = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const sharesNum = parseFloat(shares)
    if (!symbol) { setError('Enter a symbol'); return }
    if (isNaN(sharesNum) || sharesNum <= 0) { setError('Enter valid shares'); return }
    if (!cramerPortfolio) { setError('Initialize Cramer portfolio first'); return }
    setSubmitting(true)
    try {
      const existing = cramerCalc.holdings.find(h => h.symbol === symbol.toUpperCase())
      await upsertHolding(cramerPortfolio.id, symbol.toUpperCase(), sharesNum, symbolInfo?.company_name || null)
      await logCramerChange(
        symbol,
        existing ? 'UPDATE' : 'ADD',
        existing ? parseFloat(existing.shares) : null,
        sharesNum,
        symbolInfo?.price || null,
        symbolInfo?.company_name || null
      )
      await loadPortfolios()
      await refreshPrices()
      setSuccess(`${symbol.toUpperCase()} updated in Cramer's portfolio!`)
      setSymbol('')
      setShares('')
      setSymbolInfo(null)
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (holdingId, sym) => {
    if (!confirm(`Remove ${sym} from Cramer's portfolio?`)) return
    try {
      const existing = cramerCalc.holdings.find(h => h.symbol === sym)
      await deleteHolding(holdingId)
      await logCramerChange(
        sym, 'REMOVE',
        existing ? parseFloat(existing.shares) : null,
        null,
        existing?.currentPrice || null,
        existing?.companyName || null
      )
      await loadPortfolios()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSaveCash = async () => {
    const amount = parseFloat(cashInput)
    if (isNaN(amount) || amount < 0) { setError('Invalid amount'); return }
    if (!cramerPortfolio) { setError('Initialize Cramer portfolio first'); return }
    try {
      await updatePortfolioCash(cramerPortfolio.id, amount)
      await loadPortfolios()
      setShowCashModal(false)
    } catch (e) {
      setError(e.message)
    }
  }

  if (loadingPortfolio) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <div className="page-title">
            <ShieldCheck size={22} style={{ display: 'inline', marginRight: 8, color: 'var(--gold)' }} />
            ADMIN PANEL
          </div>
          <div className="page-subtitle">Manage Jim Cramer's portfolio</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cramerPortfolio && (
            <button className="btn btn-secondary" onClick={() => { setShowCashModal(true); setCashInput(cramerPortfolio.cash_balance || '') }}>
              <DollarSign size={13} /> Set Cash
            </button>
          )}
          <button className="btn btn-secondary" onClick={refreshPrices}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {!cramerPortfolio && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--gold-dim)', background: 'rgba(240,192,64,0.03)' }}>
          <div className="cramer-avatar" style={{ marginBottom: 16 }}>
            <div className="cramer-icon">📺</div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>Jim Cramer</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Mad Money Host</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Cramer's portfolio hasn't been set up yet.
          </p>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary" onClick={handleInitCramerPortfolio} disabled={initializingPortfolio}>
            {initializingPortfolio ? 'Initializing...' : '📺 Initialize Cramer Portfolio'}
          </button>
        </div>
      )}

      {cramerPortfolio && (
        <>
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Total Value</div>
              <div className="stat-value gold">{fmt(cramerCalc.totalValue)}</div>
              <div className="stat-sub">{cramerCalc.holdings.length} holdings</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Stock Value</div>
              <div className="stat-value">{fmt(cramerCalc.stockValue)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cash Balance</div>
              <div className="stat-value gold">{fmt(cramerCalc.cashValue)}</div>
            </div>
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* ADD FORM */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">📺 Add / Update Holding</div>
              </div>

              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <form onSubmit={handleAddHolding}>
                <div className="form-group">
                  <label className="form-label">Stock Symbol</label>
                  <input
                    className="form-input"
                    value={symbol}
                    onChange={e => { setSymbol(e.target.value.toUpperCase()); setSymbolInfo(null); setError('') }}
                    onBlur={handleSymbolBlur}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSymbolBlur() } }}
                    placeholder="AAPL"
                    style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                  />
                  {validating && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)' }}>Validating...</div>}
                  {symbolInfo && (
                    <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--green-bg)', border: '1px solid var(--green-dim)', borderRadius: 4, fontSize: 12 }}>
                      <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>✓ {symbolInfo.symbol}</span>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{symbolInfo.company_name}</span>
                      <span style={{ color: 'var(--text-primary)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>{fmt(symbolInfo.price)}</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Number of Shares</label>
                  <input
                    className="form-input"
                    type="number"
                    value={shares}
                    onChange={e => setShares(e.target.value)}
                    placeholder="500"
                    min="0"
                    step="0.0001"
                  />
                  {symbolInfo && shares && !isNaN(parseFloat(shares)) && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      ≈ {fmt(parseFloat(shares) * symbolInfo.price)} total value
                    </div>
                  )}
                </div>

                <button className="btn btn-primary w-full" type="submit" disabled={submitting}>
                  <Plus size={13} />
                  {submitting ? 'Saving...' : 'Update Cramer Portfolio'}
                </button>
              </form>
            </div>

            {/* HOLDINGS TABLE */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Cramer's Holdings</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                    Click headers to sort
                  </span>
                  <span className="badge badge-gold">{cramerCalc.holdings.length} positions</span>
                </div>
              </div>

              {sortedCramerHoldings.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <div className="empty-icon">📺</div>
                  <div className="empty-title">No Holdings Yet</div>
                  <div className="empty-desc">Add Cramer's stocks using the form</div>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {[
                          { field: 'symbol', label: 'Symbol' },
                          { field: 'shares', label: 'Shares' },
                          { field: 'price', label: 'Price' },
                          { field: 'value', label: 'Value' },
                          { field: 'pct', label: '%' }
                        ].map(col => (
                          <th
                            key={col.field}
                            onClick={() => handleAdminSort(col.field)}
                            style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {col.label} <SortIcon field={col.field} />
                            </span>
                          </th>
                        ))}
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCramerHoldings.map(h => (
                        <tr key={h.id}>
                          <td>
                            <div className="symbol" style={{ color: 'var(--gold)' }}>{h.symbol}</div>
                            <div className="company-name">{h.companyName}</div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                            {parseFloat(h.shares).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="price">{h.currentPrice > 0 ? fmt(h.currentPrice) : '—'}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>
                            {h.value > 0 ? fmt(h.value) : '—'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                            {h.pctOfPortfolio.toFixed(1)}%
                          </td>
                          <td>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleRemove(h.id, h.symbol)}>
                              <Trash2 size={12} color="var(--red)" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* CASH MODAL */}
      {showCashModal && (
        <div className="modal-overlay" onClick={() => setShowCashModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">CRAMER CASH POSITION</div>
            <div className="form-group">
              <label className="form-label">Cash Balance ($)</label>
              <input
                className="form-input"
                type="number"
                value={cashInput}
                onChange={e => setCashInput(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSaveCash}>Save</button>
              <button className="btn btn-secondary" onClick={() => setShowCashModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { usePortfolio } from '../lib/usePortfolio'
import { validateSymbol } from '../lib/stocks'
import { Plus, Trash2, RefreshCw, DollarSign, Search } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const fmtShort = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n || 0)

export default function PortfolioPage() {
  const { userPortfolio, userCalc, loadingPortfolio, loadingPrices, addOrUpdateHolding, removeHolding, setCash, refreshPrices } = usePortfolio()

  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState('')
  const [cash, setCashInput] = useState('')
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [symbolInfo, setSymbolInfo] = useState(null)
  const [showCashModal, setShowCashModal] = useState(false)

  const handleSymbolBlur = async () => {
    if (!symbol || symbol.length < 1) return
    setValidating(true)
    setSymbolInfo(null)
    setError('')
    const { valid, data } = await validateSymbol(symbol)
    setValidating(false)
    if (valid) {
      setSymbolInfo(data)
    } else {
      setError(`Could not find stock symbol: ${symbol.toUpperCase()}`)
    }
  }

  const handleAddHolding = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const sharesNum = parseFloat(shares)
    if (!symbol) { setError('Enter a stock symbol'); return }
    if (isNaN(sharesNum) || sharesNum <= 0) { setError('Enter a valid number of shares'); return }

    setSubmitting(true)
    try {
      await addOrUpdateHolding(symbol.toUpperCase(), sharesNum)
      setSuccess(`${symbol.toUpperCase()} updated successfully!`)
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
    if (!confirm(`Remove ${sym} from your portfolio?`)) return
    try {
      await removeHolding(holdingId, false)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSaveCash = async () => {
    const amount = parseFloat(cash)
    if (isNaN(amount) || amount < 0) { setError('Invalid cash amount'); return }
    try {
      await setCash(amount, false)
      setShowCashModal(false)
      setCashInput('')
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
          <div className="page-title">MY PORTFOLIO</div>
          <div className="page-subtitle">Manage your stocks and cash position</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { setShowCashModal(true); setCashInput(userPortfolio?.cash_balance || '') }}>
            <DollarSign size={13} /> Set Cash
          </button>
          <button className="btn btn-secondary" onClick={refreshPrices} disabled={loadingPrices}>
            <RefreshCw size={13} /> {loadingPrices ? 'Refreshing...' : 'Refresh Prices'}
          </button>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="stat-grid mb-24">
        <div className="stat-card">
          <div className="stat-label">Total Value</div>
          <div className="stat-value">{fmt(userCalc.totalValue)}</div>
          <div className="stat-sub">{userCalc.holdings.length} positions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stock Value</div>
          <div className="stat-value">{fmt(userCalc.stockValue)}</div>
          <div className="stat-sub">{userCalc.totalValue > 0 ? ((userCalc.stockValue / userCalc.totalValue) * 100).toFixed(1) : 0}% of portfolio</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cash Available</div>
          <div className="stat-value gold">{fmt(userCalc.cashValue)}</div>
          <div className="stat-sub">{userCalc.totalValue > 0 ? ((userCalc.cashValue / userCalc.totalValue) * 100).toFixed(1) : 0}% of portfolio</div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* ADD HOLDING FORM */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Add / Update Holding</div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleAddHolding}>
            <div className="form-group">
              <label className="form-label">Stock Symbol</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  value={symbol}
                  onChange={e => { setSymbol(e.target.value.toUpperCase()); setSymbolInfo(null); setError('') }}
                  onBlur={handleSymbolBlur}
                  placeholder="AAPL"
                  style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                />
                {validating && <div className="spinner" style={{ width: 20, height: 20, flexShrink: 0, alignSelf: 'center' }} />}
              </div>
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
                placeholder="100"
                min="0"
                step="0.0001"
              />
              {symbolInfo && shares && !isNaN(parseFloat(shares)) && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  ≈ {fmt(parseFloat(shares) * symbolInfo.price)} at current price
                </div>
              )}
            </div>

            <button className="btn btn-primary w-full" type="submit" disabled={submitting || validating}>
              <Plus size={13} />
              {submitting ? 'Saving...' : 'Add / Update Holding'}
            </button>
          </form>

          <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <div>• Enter symbol and hit Tab to validate</div>
            <div>• If stock already held, shares will be REPLACED (not added)</div>
            <div>• Set to 0 to effectively clear a position, or use Delete button</div>
          </div>
        </div>

        {/* HOLDINGS TABLE */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Holdings</div>
            <span className="badge badge-blue">{userCalc.holdings.length} positions</span>
          </div>

          {userCalc.holdings.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-icon">📈</div>
              <div className="empty-title">No Holdings Yet</div>
              <div className="empty-desc">Add your first stock using the form on the left</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Shares</th>
                  <th>Price</th>
                  <th>Value</th>
                  <th>% Port</th>
                  <th>Change</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {userCalc.holdings.map(h => (
                  <tr key={h.id}>
                    <td>
                      <div className="symbol">{h.symbol}</div>
                      <div className="company-name">{h.companyName}</div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {parseFloat(h.shares).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </td>
                    <td className="price">{h.currentPrice > 0 ? fmt(h.currentPrice) : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{h.value > 0 ? fmt(h.value) : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {h.pctOfPortfolio.toFixed(1)}%
                    </td>
                    <td>
                      <span className={`change-badge ${h.changePercent > 0 ? 'up' : h.changePercent < 0 ? 'down' : 'flat'}`}>
                        {h.changePercent >= 0 ? '▲' : '▼'}{Math.abs(h.changePercent).toFixed(2)}%
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleRemove(h.id, h.symbol)}>
                        <Trash2 size={12} color="var(--red)" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', paddingTop: 12 }}>
                    Cash: {fmt(userCalc.cashValue)}
                  </td>
                  <td colSpan={4} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, paddingTop: 12 }}>
                    {fmt(userCalc.totalValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* CASH MODAL */}
      {showCashModal && (
        <div className="modal-overlay" onClick={() => setShowCashModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">SET CASH BALANCE</div>
            <div className="form-group">
              <label className="form-label">Available Cash ($)</label>
              <input
                className="form-input"
                type="number"
                value={cash}
                onChange={e => setCashInput(e.target.value)}
                placeholder="10000.00"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={handleSaveCash}>Save Cash</button>
              <button className="btn btn-secondary" onClick={() => setShowCashModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

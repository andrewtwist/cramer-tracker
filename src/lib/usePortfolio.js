import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import {
  getUserPortfolio, getCramerPortfolio, createPortfolio,
  updatePortfolioCash, upsertHolding, deleteHolding
} from '../lib/supabase'
import { fetchMultiplePrices } from '../lib/stocks'

export const usePortfolio = () => {
  const { user } = useAuth()
  const [userPortfolio, setUserPortfolio] = useState(null)
  const [cramerPortfolio, setCramerPortfolio] = useState(null)
  const [prices, setPrices] = useState({}) // { SYMBOL: { price, change_percent, company_name } }
  const [loadingPortfolio, setLoadingPortfolio] = useState(true)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [priceProgress, setPriceProgress] = useState(0)
  const [error, setError] = useState(null)

  // Load portfolios from DB
  const loadPortfolios = useCallback(async () => {
    if (!user) return
    setLoadingPortfolio(true)
    setError(null)
    try {
      const [{ data: up }, { data: cp }] = await Promise.all([
        getUserPortfolio(user.id),
        getCramerPortfolio()
      ])
      setUserPortfolio(up)
      setCramerPortfolio(cp)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingPortfolio(false)
    }
  }, [user])

  // Refresh prices for all held symbols
  const refreshPrices = useCallback(async (portfolioData = null) => {
    const up = portfolioData?.user || userPortfolio
    const cp = portfolioData?.cramer || cramerPortfolio

    const symbols = new Set()
    up?.holdings?.forEach(h => symbols.add(h.symbol))
    cp?.holdings?.forEach(h => symbols.add(h.symbol))

    if (symbols.size === 0) return

    setLoadingPrices(true)
    setPriceProgress(0)
    try {
      const { results } = await fetchMultiplePrices([...symbols], (pct) => setPriceProgress(pct))
      setPrices(prev => ({ ...prev, ...results }))
    } catch (e) {
      console.error('Price refresh error:', e)
    } finally {
      setLoadingPrices(false)
      setPriceProgress(100)
    }
  }, [userPortfolio, cramerPortfolio])

  useEffect(() => {
    loadPortfolios()
  }, [loadPortfolios])

  useEffect(() => {
    if (!loadingPortfolio) {
      refreshPrices()
    }
  }, [loadingPortfolio])

  // Auto-refresh prices every 3 minutes
  useEffect(() => {
    const interval = setInterval(refreshPrices, 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refreshPrices])

  // -------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------
  const ensurePortfolio = async () => {
    if (userPortfolio) return userPortfolio
    const { data, error } = await createPortfolio(user.id, 'My Portfolio', 0)
    if (error) throw error
    setUserPortfolio({ ...data, holdings: [] })
    return data
  }

  const addOrUpdateHolding = async (symbol, shares, targetPortfolioId = null) => {
    const portfolio = targetPortfolioId
      ? { id: targetPortfolioId }
      : await ensurePortfolio()

    const priceData = prices[symbol.toUpperCase()]
    const { data, error } = await upsertHolding(
      portfolio.id,
      symbol,
      shares,
      priceData?.company_name || null
    )
    if (error) throw error

    // Re-fetch portfolio to get updated holdings
    if (targetPortfolioId === cramerPortfolio?.id) {
      const { data: cp } = await getCramerPortfolio()
      setCramerPortfolio(cp)
    } else {
      const { data: up } = await getUserPortfolio(user.id)
      setUserPortfolio(up)
    }

    // Fetch price for new symbol if not cached
    if (!prices[symbol.toUpperCase()]) {
      const { results } = await fetchMultiplePrices([symbol.toUpperCase()])
      setPrices(prev => ({ ...prev, ...results }))
    }

    return data
  }

  const removeHolding = async (holdingId, isCramer = false) => {
    const { error } = await deleteHolding(holdingId)
    if (error) throw error

    if (isCramer) {
      setCramerPortfolio(prev => ({
        ...prev,
        holdings: prev.holdings.filter(h => h.id !== holdingId)
      }))
    } else {
      setUserPortfolio(prev => ({
        ...prev,
        holdings: prev.holdings.filter(h => h.id !== holdingId)
      }))
    }
  }

  const setCash = async (amount, isCramer = false) => {
    const portfolioId = isCramer ? cramerPortfolio?.id : userPortfolio?.id
    if (!portfolioId) return

    const { data, error } = await updatePortfolioCash(portfolioId, amount)
    if (error) throw error

    if (isCramer) {
      setCramerPortfolio(prev => ({ ...prev, cash_balance: amount }))
    } else {
      setUserPortfolio(prev => ({ ...prev, cash_balance: amount }))
    }
  }

  // -------------------------------------------------------
  // COMPUTED VALUES
  // -------------------------------------------------------
  const calcPortfolioValue = (portfolio) => {
    if (!portfolio) return { totalValue: 0, stockValue: 0, cashValue: 0, holdings: [] }

    const stockValue = (portfolio.holdings || []).reduce((sum, h) => {
      const price = prices[h.symbol]?.price || 0
      return sum + (h.shares * price)
    }, 0)

    const cashValue = parseFloat(portfolio.cash_balance || 0)
    const totalValue = stockValue + cashValue

    const enrichedHoldings = (portfolio.holdings || []).map(h => {
      const priceInfo = prices[h.symbol] || {}
      const currentPrice = priceInfo.price || 0
      const value = h.shares * currentPrice
      return {
        ...h,
        currentPrice,
        value,
        changePercent: priceInfo.change_percent || 0,
        companyName: priceInfo.company_name || h.company_name || h.symbol,
        pctOfPortfolio: totalValue > 0 ? (value / totalValue) * 100 : 0
      }
    }).sort((a, b) => b.value - a.value)

    return { totalValue, stockValue, cashValue, holdings: enrichedHoldings }
  }

  const userCalc = calcPortfolioValue(userPortfolio)
  const cramerCalc = calcPortfolioValue(cramerPortfolio)

  return {
    userPortfolio,
    cramerPortfolio,
    prices,
    loadingPortfolio,
    loadingPrices,
    priceProgress,
    error,
    userCalc,
    cramerCalc,
    loadPortfolios,
    refreshPrices,
    addOrUpdateHolding,
    removeHolding,
    setCash,
    ensurePortfolio
  }
}

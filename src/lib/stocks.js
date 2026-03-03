const CACHE_TTL_MS = 3 * 60 * 1000
const localCache = new Map()

const fetchFinnhubPrice = async (symbol) => {
  const apiKey = import.meta.env.VITE_FINNHUB_API_KEY
  if (!apiKey) throw new Error('No Finnhub API key configured')

  const [quoteRes, profileRes] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`),
    fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`)
  ])

  if (!quoteRes.ok) throw new Error(`HTTP ${quoteRes.status}`)

  const quote = await quoteRes.json()
  const profile = await profileRes.json()

  if (!quote.c || quote.c === 0) throw new Error(`Invalid symbol: ${symbol}`)

  const changePercent = quote.pc ? ((quote.c - quote.pc) / quote.pc) * 100 : 0

  return {
    symbol: symbol.toUpperCase(),
    price: parseFloat(quote.c.toFixed(4)),
    previous_close: parseFloat((quote.pc || 0).toFixed(4)),
    change_percent: parseFloat(changePercent.toFixed(4)),
    company_name: profile.name || symbol,
    fetched_at: new Date().toISOString()
  }
}

export const fetchStockPrice = async (symbol) => {
  const upperSymbol = symbol.toUpperCase()
  const cached = localCache.get(upperSymbol)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const data = await fetchFinnhubPrice(upperSymbol)
  localCache.set(upperSymbol, { data, timestamp: Date.now() })
  return data
}

export const fetchMultiplePrices = async (symbols, onProgress = null) => {
  const results = {}
  const errors = {}
  const BATCH_SIZE = 5
  const DELAY_MS = 200

  const batches = []
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    batches.push(symbols.slice(i, i + BATCH_SIZE))
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]

    await Promise.allSettled(
      batch.map(async (symbol) => {
        try {
          const data = await fetchStockPrice(symbol)
          results[symbol.toUpperCase()] = data
        } catch (err) {
          errors[symbol.toUpperCase()] = err.message
        }
      })
    )

    if (onProgress) {
      onProgress(Math.min(((batchIdx + 1) * BATCH_SIZE / symbols.length) * 100, 100))
    }

    if (batchIdx < batches.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  return { results, errors }
}

export const validateSymbol = async (symbol) => {
  try {
    const data = await fetchStockPrice(symbol)
    if (data && data.price > 0) {
      return { valid: true, data }
    }
    return { valid: false, data: null }
  } catch {
    return { valid: false, data: null }
  }
}

export const isMarketOpen = () => {
  const now = new Date()
  const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = eastern.getDay()
  const hours = eastern.getHours()
  const minutes = eastern.getMinutes()
  const timeInMinutes = hours * 60 + minutes
  if (day === 0 || day === 6) return false
  return timeInMinutes >= 570 && timeInMinutes < 960
}

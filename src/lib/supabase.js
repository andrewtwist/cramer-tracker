import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// -------------------------------------------------------
// AUTH HELPERS
// -------------------------------------------------------
export const signUp = async (email, password, username) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: username } }
  })
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// -------------------------------------------------------
// PROFILE HELPERS
// -------------------------------------------------------
export const getProfile = async (userId) => {
  console.log('getProfile: starting query for', userId)
  try {
    const result = await Promise.race([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile query timed out after 5s')), 5000)
      )
    ])
    console.log('getProfile: result =', result)
    return result
  } catch (err) {
    console.error('getProfile: error =', err.message)
    return { data: null, error: err }
  }
}

// -------------------------------------------------------
// PORTFOLIO HELPERS
// -------------------------------------------------------
export const getUserPortfolio = async (userId) => {
  const { data, error } = await supabase
    .from('portfolios')
    .select(`*, holdings(*)`)
    .eq('user_id', userId)
    .eq('is_cramer', false)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return { data, error }
}

export const getCramerPortfolio = async () => {
  const { data, error } = await supabase
    .from('portfolios')
    .select(`*, holdings(*)`)
    .eq('is_cramer', true)
    .maybeSingle()
  return { data, error }
}

export const createPortfolio = async (userId, name = 'My Portfolio', cashBalance = 0) => {
  const { data, error } = await supabase
    .from('portfolios')
    .insert({ user_id: userId, name, cash_balance: cashBalance, is_cramer: false })
    .select()
    .single()
  return { data, error }
}

export const updatePortfolioCash = async (portfolioId, cashBalance) => {
  const { data, error } = await supabase
    .from('portfolios')
    .update({ cash_balance: cashBalance })
    .eq('id', portfolioId)
    .select()
    .single()
  return { data, error }
}

// -------------------------------------------------------
// HOLDINGS HELPERS
// -------------------------------------------------------
export const upsertHolding = async (portfolioId, symbol, shares, companyName = null) => {
  const { data, error } = await supabase
    .from('holdings')
    .upsert(
      { portfolio_id: portfolioId, symbol: symbol.toUpperCase(), shares, company_name: companyName },
      { onConflict: 'portfolio_id,symbol' }
    )
    .select()
    .single()
  return { data, error }
}

export const deleteHolding = async (holdingId) => {
  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('id', holdingId)
  return { error }
}

// -------------------------------------------------------
// PRICE CACHE HELPERS
// -------------------------------------------------------
export const getCachedPrices = async (symbols) => {
  const { data, error } = await supabase
    .from('price_cache')
    .select('*')
    .in('symbol', symbols)
  return { data, error }
}

export const upsertPriceCache = async (priceData) => {
  // priceData: array of { symbol, price, previous_close, change_percent, company_name }
  const { data, error } = await supabase
    .from('price_cache')
    .upsert(priceData, { onConflict: 'symbol' })
    .select()
  return { data, error }
}

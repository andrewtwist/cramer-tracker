import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getProfile } from './supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId) => {
    console.log('loadProfile called for:', userId)
    const { data, error } = await getProfile(userId)
    console.log('loadProfile result:', data, error)
    setProfile(data)
    return data
  }

  useEffect(() => {
    console.log('AuthProvider: getting session...')
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('getSession result:', session?.user?.id, error)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id).finally(() => {
          console.log('loadProfile done, setting loading=false')
          setLoading(false)
        })
      } else {
        console.log('No session, setting loading=false')
        setLoading(false)
      }
    }).catch(err => {
      console.error('getSession error:', err)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('auth state change:', event, session?.user?.id)
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.is_admin ?? false,
    refreshProfile: () => user ? loadProfile(user.id) : null
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../lib/supabase'
import { TrendingUp } from 'lucide-react'

export default function LoginPage() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      navigate('/dashboard')
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim()) { setError('Username is required'); return }
    if (username.length < 3) { setError('Username must be at least 3 characters'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }

    setLoading(true)
    const { error } = await signUp(email, password, username)
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setSuccess('Account created! Check your email to confirm, then sign in.')
      setTab('login')
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-logo">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <TrendingUp size={32} color="var(--gold)" />
          </div>
          <div className="title">CRAMER TRACKER</div>
          <div className="sub">Beat the Mad Money Machine</div>
        </div>

        <div className="login-tabs">
          <button className={`login-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError('') }}>
            Sign In
          </button>
          <button className={`login-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setError('') }}>
            Create Account
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="trader_joe"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
              />
            </div>
            <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account →'}
            </button>
          </form>
        )}

        <div style={{ marginTop: 20, padding: '12px', background: 'var(--bg-input)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          💡 Admin accounts are promoted via Supabase SQL. See README for setup.
        </div>
      </div>
    </div>
  )
}

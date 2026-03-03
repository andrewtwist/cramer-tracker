import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PortfolioPage from './pages/PortfolioPage'
import ComparePage from './pages/ComparePage'
import AdminPage from './pages/AdminPage'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  return user ? children : <Navigate to="/login" replace />
}

const AdminRoute = ({ children }) => {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  </AuthProvider>
)

export default App

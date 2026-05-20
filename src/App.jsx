import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Nav from './components/Nav'
import Login from './pages/Login'
import Home from './pages/Home'
import League from './pages/League'
import Predictions from './pages/Predictions'
import Leaderboard from './pages/Leaderboard'

function Protected({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { user } = useAuth()

  return (
    <div className="app-shell">
      {user && <Nav />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

        <Route path="/" element={<Protected><Home /></Protected>} />
        <Route path="/league/:leagueId" element={<Protected><League /></Protected>} />
        <Route path="/league/:leagueId/predictions" element={<Protected><Predictions /></Protected>} />
        <Route path="/league/:leagueId/leaderboard" element={<Protected><Leaderboard /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Nav() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const leagueMatch = location.pathname.match(/\/league\/([^/]+)/)
  const leagueId = leagueMatch ? leagueMatch[1] : null
  const initials = user?.displayName?.split(' ').map(n => n[0]).join('').slice(0,2) || '?'

  return (
    <nav className="nav">
      <NavLink to="/" className="nav-logo">
        🏆 WC26
      </NavLink>

      <div className="nav-links">
        {leagueId && (
          <>
            <NavLink to={`/league/${leagueId}/predictions`} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              Predictions
            </NavLink>
            <NavLink to={`/league/${leagueId}/leaderboard`} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              Leaderboard
            </NavLink>
            <NavLink to={`/league/${leagueId}`} end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              My League
            </NavLink>
          </>
        )}
        <NavLink to="/rules" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Rules
        </NavLink>
      </div>

      <div className="nav-user">
        <span className="muted text-sm">{user?.displayName}</span>
        <div className="avatar">
          {user?.photoURL
            ? <img src={user.photoURL} alt={initials} />
            : initials}
        </div>
        <button className="btn btn-ghost text-sm" style={{ padding: '5px 10px' }} onClick={logout}>
          Sign out
        </button>
      </div>
    </nav>
  )
}

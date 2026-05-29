import { NavLink, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Nav() {
  const { user, logout } = useAuth()
  const { leagueId }     = useParams()
  const initials = user?.displayName?.split(' ').map(n => n[0]).join('').slice(0,2) || '?'

  return (
    <nav className="nav">
      <NavLink to="/" className="nav-logo">
        🏆 WC26
      </NavLink>

      {leagueId && (
        <div className="nav-links">
          <NavLink to={`/league/${leagueId}/predictions`} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Predictions
          </NavLink>
          <NavLink to={`/league/${leagueId}/leaderboard`} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Leaderboard
          </NavLink>
          <NavLink to={`/league/${leagueId}`} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            My League
          </NavLink>
          <NavLink to={`/league/${leagueId}/rules`} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Rules
          </NavLink>
        </div>
      )}

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

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeMyPredictions, subscribeResults } from '../services/firestore'
import { fetchMatches, fetchSquad } from '../services/apiFootball'
import MatchCard from '../components/MatchCard'

export default function Predictions() {
  const navigate = useNavigate()
  const { leagueId }   = useParams()
  const { user }       = useAuth()
  const [matches,  setMatches]  = useState([])
  const [squads,   setSquads]   = useState({})   // { teamId: [players] }
  const [myPreds,  setMyPreds]  = useState({})   // { matchId: prediction }
  const [results,  setResults]  = useState({})   // { matchId: result }
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('upcoming')

  // Load matches from API-Football
  useEffect(() => {
    fetchMatches()
      .then(ms => { setMatches(ms); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Load squads lazily — fetch each unique team once
  useEffect(() => {
    const teamIds = [...new Set(matches.flatMap(m => [m.homeId, m.awayId]))]
    teamIds.forEach(id => {
      if (squads[id]) return
      fetchSquad(id).then(players => setSquads(prev => ({ ...prev, [id]: players })))
    })
  }, [matches])

  // Subscribe to my predictions and match results in real-time
  useEffect(() => {
    const unsubPreds   = subscribeMyPredictions(leagueId, user.uid, setMyPreds)
    const unsubResults = subscribeResults(setResults)
    return () => { unsubPreds(); unsubResults() }
  }, [leagueId, user.uid])

  const grouped = useMemo(() => {
    const now = Date.now()
    const filtered = matches.filter(m => {
      const t = new Date(m.date).getTime()
      if (filter === 'upcoming') return t > now && m.status === 'NS'
      if (filter === 'live')     return ['1H','2H','HT','ET','P'].includes(m.status)
      if (filter === 'finished') return m.status === 'FT'
      return true
    })

    const groups = {}
    filtered.forEach(m => {
      const d = new Date(m.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      if (!groups[d]) groups[d] = []
      groups[d].push(m)
    })
    return groups
  }, [matches, filter])

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>

  const FILTERS = [
    { key: 'upcoming', label: '📅 Upcoming' },
    { key: 'live',     label: '🔴 Live' },
    { key: 'finished', label: '✓ Finished' },
    { key: 'all',      label: 'All' },
  ]

  return (
    <div className="page"> {/* Standings added to prediction page*/}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
  <h1 className="page-title" style={{ marginBottom: 0 }}>Predictions</h1>
  <button
    className="btn btn-ghost text-sm"
    onClick={() => navigate(`/league/${leagueId}/leaderboard`)}
  >
    🏆 Standings
  </button>
</div>
<p className="page-sub">Your picks lock 1 hour before each match kicks off.</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`btn ${filter === f.key ? 'btn-primary' : 'btn-ghost'} text-sm`}
            style={{ padding: '6px 14px' }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-2)', padding: 40 }}>
          No matches in this view
        </div>
      )}

      {Object.entries(grouped).map(([date, ms]) => (
        <div key={date} style={{ marginBottom: 24 }}>
          <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{date}</span>
            <span style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
          </div>
          {ms.map(m => (
            <MatchCard
              key={m.id}
              match={m}
              leagueId={leagueId}
              uid={user.uid}
              myPrediction={myPreds[m.id]}
              result={results[m.id]}
              squads={squads}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

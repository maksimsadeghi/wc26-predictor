import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeMyPredictions, subscribeResults, subscribeAllPredictions, subscribeFixtures, subscribeLeague } from '../services/firestore'
import { fetchSquad } from '../services/apiFootball'
import MatchCard from '../components/MatchCard'

export default function Predictions() {
  const navigate = useNavigate()
  const { leagueId }   = useParams()
  const { user }       = useAuth()
  const [matches,  setMatches]  = useState([])
  const [squads,   setSquads]   = useState({})
  const [myPreds,  setMyPreds]  = useState({})
  const [allPreds, setAllPreds] = useState({})
  const [results,  setResults]  = useState({})
  const [members,  setMembers]  = useState({})
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('upcoming')

  useEffect(() => {
    const unsub = subscribeFixtures(ms => { setMatches(ms); setLoading(false) })
    return unsub
  }, [])

  useEffect(() => {
    const teamIds = [...new Set(matches.flatMap(m => [m.homeId, m.awayId]))]
    teamIds.forEach(id => {
      if (squads[id]) return
      fetchSquad(id).then(players => setSquads(prev => ({ ...prev, [id]: players })))
    })
  }, [matches])

  useEffect(() => {
    const unsubPreds   = subscribeMyPredictions(leagueId, user.uid, setMyPreds)
    const unsubAll     = subscribeAllPredictions(leagueId, setAllPreds)
    const unsubResults = subscribeResults(setResults)
    const unsubLeague  = subscribeLeague(leagueId, league => {
      const map = {}
      ;(league?.members || []).forEach(m => { map[m.uid] = m.displayName })
      setMembers(map)
    })
    return () => { unsubPreds(); unsubAll(); unsubResults(); unsubLeague() }
  }, [leagueId, user.uid])

  const rounds = useMemo(() => {
    const unique = [...new Set(matches.map(m => m.round))]
    return unique.sort()
  }, [matches])

  const grouped = useMemo(() => {
    const now = Date.now()
    const DONE = ['FT', 'AET', 'PEN', 'AWD', 'WO']
    const filtered = matches.filter(m => {
      const t = new Date(m.date).getTime()
      const status = results[m.id]?.status || m.status
      const isDone = DONE.includes(status)
      if (filter === 'upcoming') return t > now
      if (filter === 'live')     return t <= now && !isDone && (now - t) < 3 * 60 * 60 * 1000
      if (filter === 'finished') return isDone || (now - t) >= 3 * 60 * 60 * 1000
      if (filter === 'all')      return true
      return m.round === filter
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
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Predictions</h1>
        <button
          className="btn btn-ghost text-sm"
          onClick={() => navigate(`/league/${leagueId}/leaderboard`)}
        >
          🏆 Standings
        </button>
      </div>
      <p className="page-sub">Your picks lock 30 minutes before each match kicks off. · Everyone's picks visible once locked</p>

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
        <div style={{ width: '100%', height: '0.5px', background: 'var(--border)', margin: '4px 0' }} />
        {rounds.map(round => (
          <button
            key={round}
            className={`btn ${filter === round ? 'btn-primary' : 'btn-ghost'} text-sm`}
            style={{ padding: '6px 14px' }}
            onClick={() => setFilter(round)}
          >
            {round}
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
              displayName={user.displayName}
              myPrediction={myPreds[m.id]}
              allPredictions={allPreds[m.id] || []}
              result={results[m.id]}
              squads={squads}
              members={members}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
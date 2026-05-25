import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { saveResult, recalcLeaderboard } from '../services/firestore'
import { refreshFixtures } from '../services/apiFootball'

const ADMIN_UIDS = ['tfw6WyAsX1Xwkuu4lxV635dAJ6f2'] // add Maksim's uid later

export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Redirect if not admin
  if (!ADMIN_UIDS.includes(user.uid)) {
    navigate('/')
    return null
  }

  const [leagues, setLeagues] = useState([])

  // Result fix state
  const [matchId, setMatchId] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [firstTeam, setFirstTeam] = useState('')
  const [firstScorer, setFirstScorer] = useState('')
  const [firstScorerPos, setFirstScorerPos] = useState('')
  const [resultMsg, setResultMsg] = useState(null)

  // Leaderboard state
  const [selectedLeague, setSelectedLeague] = useState('')
  const [recalcMsg, setRecalcMsg] = useState(null)

  // Fixture refresh state
  const [refreshMsg, setRefreshMsg] = useState(null)

  // Squad fix state
  const [teamId, setTeamId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerPos, setPlayerPos] = useState('ST')
  const [squadMsg, setSquadMsg] = useState(null)

  useEffect(() => {
    getDocs(collection(db, 'leagues')).then(snap => {
      setLeagues(snap.docs.map(d => d.data()))
    })
  }, [])

  async function handleFixResult() {
    if (!matchId) return
    try {
      await saveResult(Number(matchId), {
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        firstTeamScore: firstTeam || null,
        firstScorer: firstScorer || null,
        firstScorerPos: firstScorerPos || null,
        status: 'FT',
      })
      setResultMsg('✅ Result saved!')
    } catch (e) {
      setResultMsg(`❌ Error: ${e.message}`)
    }
  }

  async function handleRecalc() {
    if (!selectedLeague) return
    try {
      setRecalcMsg('Recalculating...')
      await recalcLeaderboard(selectedLeague)
      setRecalcMsg('✅ Leaderboard updated!')
    } catch (e) {
      setRecalcMsg(`❌ Error: ${e.message}`)
    }
  }

  async function handleRefresh() {
    try {
      setRefreshMsg('Refreshing...')
      await refreshFixtures()
      setRefreshMsg('✅ Fixtures refreshed!')
    } catch (e) {
      setRefreshMsg(`❌ Error: ${e.message}`)
    }
  }

  async function handleFixSquad() {
    if (!teamId || !playerName) return
    try {
      const { doc, getDoc, setDoc } = await import('firebase/firestore')
      const ref = doc(db, '_cache', `squad_${teamId}`)
      const snap = await getDoc(ref)
      const existing = snap.exists() ? snap.data().players : []
      const updated = [...existing, { id: Date.now(), name: playerName, pos: playerPos }]
      await setDoc(ref, { players: updated }, { merge: true })
      setSquadMsg(`✅ Added ${playerName} to squad ${teamId}`)
      setPlayerName('')
    } catch (e) {
      setSquadMsg(`❌ Error: ${e.message}`)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">⚙️ Admin</h1>
      <p className="page-sub">Only accessible by admins.</p>

      {/* Fix Result */}
      <div className="section-label" style={{ marginTop: 24 }}>Fix a Result</div>
      <div className="card" style={{ maxWidth: 500 }}>
        <div className="form-group">
          <label className="form-label">Match ID</label>
          <input className="form-input" placeholder="e.g. 855736" value={matchId} onChange={e => setMatchId(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label className="form-label">Home Score</label>
            <input className="form-input" type="number" value={homeScore} onChange={e => setHomeScore(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Away Score</label>
            <input className="form-input" type="number" value={awayScore} onChange={e => setAwayScore(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">First Team to Score</label>
          <input className="form-input" placeholder="e.g. Brazil" value={firstTeam} onChange={e => setFirstTeam(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label className="form-label">First Scorer</label>
            <input className="form-input" placeholder="e.g. Ronaldo" value={firstScorer} onChange={e => setFirstScorer(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Position</label>
            <select className="form-input" value={firstScorerPos} onChange={e => setFirstScorerPos(e.target.value)}>
              <option value="ST">ST (FW)</option>
              <option value="CM">CM (MF)</option>
              <option value="CB">CB (DEF)</option>
              <option value="GK">GK</option>
            </select>
          </div>
        </div>
        {resultMsg && <p style={{ fontSize: 13, marginBottom: 12, color: resultMsg.includes('✅') ? 'var(--green)' : '#f87171' }}>{resultMsg}</p>}
        <button className="btn btn-primary" onClick={handleFixResult}>Save Result</button>
      </div>

      {/* Recalc Leaderboard */}
      <div className="section-label" style={{ marginTop: 24 }}>Recalc Leaderboard</div>
      <div className="card" style={{ maxWidth: 500 }}>
        <div className="form-group">
          <label className="form-label">Select League</label>
          <select className="form-input" value={selectedLeague} onChange={e => setSelectedLeague(e.target.value)}>
            <option value="">Choose a league...</option>
            {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        {recalcMsg && <p style={{ fontSize: 13, marginBottom: 12, color: recalcMsg.includes('✅') ? 'var(--green)' : '#f87171' }}>{recalcMsg}</p>}
        <button className="btn btn-primary" onClick={handleRecalc} disabled={!selectedLeague}>Recalc Leaderboard</button>
      </div>

      {/* Force Refresh Fixtures */}
      <div className="section-label" style={{ marginTop: 24 }}>Force Refresh Fixtures</div>
      <div className="card" style={{ maxWidth: 500 }}>
        <p className="muted text-sm" style={{ marginBottom: 12 }}>Costs 1 API call. Use sparingly.</p>
        {refreshMsg && <p style={{ fontSize: 13, marginBottom: 12, color: refreshMsg.includes('✅') ? 'var(--green)' : '#f87171' }}>{refreshMsg}</p>}
        <button className="btn btn-primary" onClick={handleRefresh}>Refresh Fixtures</button>
      </div>

      {/* Fix Squad */}
      <div className="section-label" style={{ marginTop: 24 }}>Add Player to Squad</div>
      <div className="card" style={{ maxWidth: 500 }}>
        <div className="form-group">
          <label className="form-label">Team ID</label>
          <input className="form-input" placeholder="e.g. 6" value={teamId} onChange={e => setTeamId(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label className="form-label">Player Name</label>
            <input className="form-input" placeholder="e.g. Ronaldo" value={playerName} onChange={e => setPlayerName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Position</label>
            <select className="form-input" value={playerPos} onChange={e => setPlayerPos(e.target.value)}>
              <option value="ST">ST (FW)</option>
              <option value="CM">CM (MF)</option>
              <option value="CB">CB (DEF)</option>
              <option value="GK">GK</option>
            </select>
          </div>
        </div>
        {squadMsg && <p style={{ fontSize: 13, marginBottom: 12, color: squadMsg.includes('✅') ? 'var(--green)' : '#f87171' }}>{squadMsg}</p>}
        <button className="btn btn-primary" onClick={handleFixSquad}>Add Player</button>
      </div>
    </div>
  )
}
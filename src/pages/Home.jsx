import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createLeague, joinLeague } from '../services/firestore'

export default function Home() {
  const { user }   = useAuth()
  const navigate   = useNavigate()

  const [mode, setMode]       = useState(null)   // 'create' | 'join'
  const [name, setName]       = useState('')
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true); setError(null)
    try {
      const { id } = await createLeague(user.uid, user.displayName, name.trim())
      navigate(`/league/${id}`)
    } catch (e) {
      setError(e.message); setLoading(false)
    }
  }

  async function handleJoin() {
    if (!code.trim()) return
    setLoading(true); setError(null)
    try {
      const id = await joinLeague(user.uid, user.displayName, code.trim())
      navigate(`/league/${id}/predictions`)
    } catch (e) {
      setError(e.message); setLoading(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Welcome, {user?.displayName?.split(' ')[0]} 👋</h1>
      <p className="page-sub">Create a private league with friends or join one with an invite code.</p>

      {!mode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 460 }}>
          <button className="card btn" style={{ flexDirection: 'column', gap: 10, padding: 24, cursor: 'pointer' }} onClick={() => setMode('create')}>
            <span style={{ fontSize: 32 }}>🏟️</span>
            <span style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700 }}>Create league</span>
            <span className="muted text-sm">Start a new league and invite your mates</span>
          </button>
          <button className="card btn" style={{ flexDirection: 'column', gap: 10, padding: 24, cursor: 'pointer' }} onClick={() => setMode('join')}>
            <span style={{ fontSize: 32 }}>🔗</span>
            <span style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700 }}>Join league</span>
            <span className="muted text-sm">Enter a 6-letter code from a friend</span>
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="card" style={{ maxWidth: 420 }}>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Create a league</h2>
          <div className="form-group">
            <label className="form-label">League name</label>
            <input className="form-input" placeholder="e.g. The Lads, Office Pool…" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          </div>
          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <div className="flex gap-8">
            <button className="btn btn-ghost" onClick={() => { setMode(null); setError(null) }}>Back</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading || !name.trim()} style={{ flex: 1 }}>
              {loading ? 'Creating…' : 'Create league →'}
            </button>
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div className="card" style={{ maxWidth: 420 }}>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Join a league</h2>
          <div className="form-group">
            <label className="form-label">Invite code</label>
            <input
              className="form-input"
              placeholder="e.g. X7K2MN"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              style={{ fontFamily: 'var(--font-head)', fontSize: 20, letterSpacing: 4, textAlign: 'center' }}
              maxLength={6}
            />
          </div>
          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <div className="flex gap-8">
            <button className="btn btn-ghost" onClick={() => { setMode(null); setError(null) }}>Back</button>
            <button className="btn btn-primary" onClick={handleJoin} disabled={loading || code.length < 6} style={{ flex: 1 }}>
              {loading ? 'Joining…' : 'Join league →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

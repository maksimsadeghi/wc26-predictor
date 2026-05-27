import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

useEffect(() => {
  getRedirectResult(auth).then(result => {
    if (result?.user) setUser(result.user)
  })
  const unsub = onAuthStateChanged(auth, (u) => {
    setUser(u)
    setLoading(false)
  })
  return unsub
}, [])

  const login = () => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  if (isMobile) {
    return signInWithRedirect(auth, googleProvider)
  }
  return signInWithPopup(auth, googleProvider)
}

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

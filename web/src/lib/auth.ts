import { create } from 'zustand'

interface AuthState {
  token: string | null
  user: { username: string; role: string } | null
  setAuth: (token: string, user: { username: string; role: string }) => void
  logout: () => void
}

export const useAuth = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('vexil-token') : null,
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vexil-user') || 'null') : null,
  setAuth: (token, user) => {
    localStorage.setItem('vexil-token', token)
    localStorage.setItem('vexil-user', JSON.stringify(user))
    set({ token, user })
  },
  logout: () => {
    localStorage.removeItem('vexil-token')
    localStorage.removeItem('vexil-user')
    set({ token: null, user: null })
  },
}))

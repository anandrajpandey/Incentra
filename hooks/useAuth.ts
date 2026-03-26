'use client'

import { create } from 'zustand'
import type { GoogleIdentityProfile, User } from '@/types'
import { getCurrentUser, login, loginWithGoogle, logout } from '@/services/api'

interface AuthStore {
  user: User | null
  isLoading: boolean
  error: string | null
  loginUser: (email: string, password: string) => Promise<void>
  loginWithGoogleUser: (profile: GoogleIdentityProfile) => Promise<void>
  logoutUser: () => Promise<void>
  fetchCurrentUser: () => Promise<void>
  resetAuthState: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  fetchCurrentUser: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = await getCurrentUser()
      set({ user, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch user',
        isLoading: false,
      })
    }
  },

  loginUser: async (email: string, password: string) => {
    set({ user: null, isLoading: true, error: null })
    try {
      const { user } = await login(email, password)
      set({ user, isLoading: false })
    } catch (error) {
      set({
        user: null,
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
      })
      throw error
    }
  },

  loginWithGoogleUser: async (profile: GoogleIdentityProfile) => {
    set({ user: null, isLoading: true, error: null })
    try {
      const { user } = await loginWithGoogle(profile)
      set({ user, isLoading: false })
    } catch (error) {
      set({
        user: null,
        error: error instanceof Error ? error.message : 'Google sign-in failed',
        isLoading: false,
      })
      throw error
    }
  },

  logoutUser: async () => {
    set({ isLoading: true })
    try {
      await logout()
      const user = await getCurrentUser()
      set({ user, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Logout failed',
        isLoading: false,
      })
    }
  },

  resetAuthState: () => {
    set({ user: null, error: null, isLoading: false })
  },
}))

export function useAuth() {
  const {
    user,
    isLoading,
    error,
    loginUser,
    loginWithGoogleUser,
    logoutUser,
    fetchCurrentUser,
    resetAuthState,
  } =
    useAuthStore()

  return {
    user,
    isLoading,
    error,
    loginUser,
    loginWithGoogleUser,
    logoutUser,
    fetchCurrentUser,
    resetAuthState,
  }
}

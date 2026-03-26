'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { fetchCurrentUser } = useAuth()

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  return <>{children}</>
}

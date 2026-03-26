'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Navbar } from '@/components/shared/navbar'
import { AdminSidebar } from '@/components/shared/sidebar'
import { StatsCards } from '@/components/admin/stats-cards'
import { getAdminStats } from '@/services/api'
import type { AdminStats } from '@/types'
import Link from 'next/link'
import { ArrowRight, Cloud, Database, UploadCloud } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const { fetchCurrentUser, user, isLoading: isAuthLoading } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authResolved, setAuthResolved] = useState(false)

  useEffect(() => {
    let cancelled = false

    const resolveAuth = async () => {
      await fetchCurrentUser()
      if (!cancelled) {
        setAuthResolved(true)
      }
    }

    void resolveAuth()

    return () => {
      cancelled = true
    }
  }, [fetchCurrentUser])

  useEffect(() => {
    if (!authResolved || isAuthLoading) return
    if (user?.role === 'admin') return
    router.replace('/login?redirect=%2Fadmin')
  }, [authResolved, isAuthLoading, router, user?.role])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getAdminStats()
        setStats(data)
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (!authResolved || (isAuthLoading && !user)) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
      </div>
    )
  }
  if (user?.role !== 'admin') return null

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="flex">
        <AdminSidebar />

        <main className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 xl:p-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mb-10 border-b border-white/8 pb-8">
                <p className="text-xs uppercase tracking-[0.35em] text-primary/70">
                  Studio Overview
                </p>
                <h1 className="mt-2 text-5xl text-foreground" data-display="true">
                  Editorial Overview
                </h1>
                <p className="mt-3 max-w-2xl text-foreground/65">
                  Track the health of the lineup, spotlight the right title, and keep the library moving.
                </p>
              </div>

              {stats && (
                <StatsCards stats={stats} isLoading={isLoading} />
              )}

              <div className="mt-10 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="border-b border-white/8 pb-8"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-3xl text-foreground" data-display="true">
                      Tonight's Focus
                    </h2>
                    <Cloud className="h-5 w-5 text-primary" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="border-b border-white/8 pb-5 md:border-b-0 md:pr-4">
                      <UploadCloud className="mb-3 h-6 w-6 text-primary" />
                      <p className="font-semibold text-foreground">New arrival</p>
                      <p className="mt-2 text-sm text-foreground/60">
                        Bring a fresh title into the library and get it ready for release.
                      </p>
                    </div>
                    <div className="border-b border-white/8 pb-5 md:border-b-0 md:px-4">
                      <Cloud className="mb-3 h-6 w-6 text-primary" />
                      <p className="font-semibold text-foreground">Featured placement</p>
                      <p className="mt-2 text-sm text-foreground/60">
                        Choose the title that should command the homepage first look.
                      </p>
                    </div>
                    <div className="pb-5 md:pl-4">
                      <Database className="mb-3 h-6 w-6 text-primary" />
                      <p className="font-semibold text-foreground">Library details</p>
                      <p className="mt-2 text-sm text-foreground/60">
                        Keep titles, artwork, and descriptions polished across the platform.
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="border-b border-white/8 pb-8"
                >
                  <h2 className="text-3xl text-foreground" data-display="true">
                    Quick Actions
                  </h2>
                  <div className="mt-5 space-y-3">
                    <Link
                      href="/admin/upload"
                      className="flex items-center justify-between border-b border-white/8 px-0 py-4 transition hover:text-primary"
                    >
                      <div>
                        <p className="font-semibold text-foreground">Upload new video</p>
                        <p className="text-sm text-foreground/60">Add the next title to the lineup</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </Link>
                    <Link
                      href="/admin/videos"
                      className="flex items-center justify-between px-0 py-4 transition hover:text-primary"
                    >
                      <div>
                        <p className="font-semibold text-foreground">Manage catalog</p>
                        <p className="text-sm text-foreground/60">Refine the library and keep it sharp</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </Link>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  )
}

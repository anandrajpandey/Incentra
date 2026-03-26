'use client'

import { motion } from 'framer-motion'
import { Film, Eye, Users, TrendingUp } from 'lucide-react'
import type { AdminStats } from '@/types'
interface StatsCardsProps {
  stats: AdminStats
  isLoading?: boolean
}

export function StatsCards({ stats, isLoading = false }: StatsCardsProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  }

  const statItems = [
    {
      icon: Film,
      label: 'Total Videos',
      value: stats.totalVideos,
      color: 'from-rose-300 to-red-500',
    },
    {
      icon: Eye,
      label: 'Total Views',
      value: stats.totalViews,
      color: 'from-indigo-300 to-sky-500',
    },
    {
      icon: Users,
      label: 'Total Users',
      value: stats.totalUsers,
      color: 'from-emerald-400 to-teal-500',
    },
    {
      icon: TrendingUp,
      label: 'Uploaded This Month',
      value: stats.uploadedThisMonth,
      color: 'from-fuchsia-300 to-rose-500',
    },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
    >
      {statItems.map((item, index) => {
        const Icon = item.icon
        const formattedValue = item.value.toLocaleString()

        return (
          <motion.div key={index} variants={itemVariants}>
            <div className="border-b border-white/8 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`text-transparent bg-gradient-to-br ${item.color} bg-clip-text`}>
                  <Icon className="w-6 h-6" />
                </div>
                {isLoading && <div className="h-5 w-12 animate-pulse rounded bg-muted" />}
              </div>
              <h3 className="text-sm font-medium text-foreground/70 mb-1">
                {item.label}
              </h3>
              <p className="text-3xl font-semibold text-foreground">
                {isLoading ? <span className="animate-pulse">Loading...</span> : formattedValue}
              </p>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

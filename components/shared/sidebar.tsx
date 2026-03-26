'use client'

import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Film,
  Upload,
  Home,
  ChevronRight,
  Clapperboard,
  UserCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin', icon: Home, label: 'Dashboard', exact: true },
  { href: '/admin/videos', icon: Film, label: 'Videos', exact: false },
  { href: '/admin/upload', icon: Upload, label: 'Upload', exact: false },
  { href: '/profile', icon: UserCircle2, label: 'Profile', exact: false },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <motion.aside
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-16 hidden h-[calc(100vh-4rem)] w-72 border-r border-white/8 bg-background pt-8 lg:block"
    >
      <div className="mb-8 px-5">
        <div className="border-b border-white/8 pb-5">
          <div className="mb-3 flex items-center gap-3 text-primary">
            <Clapperboard className="h-5 w-5" />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary/70">Studio</p>
              <p className="text-sm text-foreground/80">Editorial desk</p>
            </div>
          </div>
          <p className="text-sm text-foreground/60">
            Shape the lineup, refresh the homepage, and keep the library ready for the next release.
          </p>
        </div>
      </div>
      <nav className="space-y-1 px-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href) && pathname !== '/admin'

          return (
            <motion.div
              key={item.href}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href={item.href}
                className={cn(
                  'group flex items-center justify-between rounded-xl px-4 py-3 transition-colors',
                  isActive
                    ? 'bg-white/6 text-foreground'
                    : 'text-foreground/70 hover:bg-white/4 hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
                {isActive && (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Link>
            </motion.div>
          )
        })}
      </nav>
    </motion.aside>
  )
}

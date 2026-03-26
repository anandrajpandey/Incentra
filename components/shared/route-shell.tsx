'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

export function RouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return <div key={pathname}>{children}</div>
}

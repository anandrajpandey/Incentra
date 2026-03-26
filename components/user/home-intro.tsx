'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { IncentraEye } from '@/components/shared/incentra-eye'

const INTRO_SESSION_KEY = 'incentra.home-intro.seen'

interface HomeIntroProps {
  onComplete?: () => void
}

export function HomeIntro({ onComplete }: HomeIntroProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.sessionStorage.getItem(INTRO_SESSION_KEY) === '1') {
      onComplete?.()
      return
    }

    setVisible(true)

    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem(INTRO_SESSION_KEY, '1')
      setVisible(false)
      window.setTimeout(() => onComplete?.(), 700)
    }, 3200)

    return () => window.clearTimeout(timer)
  }, [onComplete])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.7, ease: 'easeInOut' } }}
          className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(32,16,16,0.18),rgba(0,0,0,0.96)_58%)]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,0,0,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_50%,rgba(255,255,255,0.015))]" />

          <motion.div
            initial={{ opacity: 0, scale: 0.82, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col items-center"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.18 }}
              className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
            >
              <IntroRush className="-translate-y-3 scale-[2.35] sm:scale-[2.7] md:scale-[3]" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18, letterSpacing: '0.55em' }}
              animate={{
                opacity: [0, 0, 1],
                y: [18, 18, 0],
                letterSpacing: ['0.55em', '0.55em', '0.28em'],
              }}
              transition={{ duration: 2.4, times: [0, 0.62, 1], ease: 'easeOut' }}
              className="relative z-10"
            >
              <IncentraEye mode="sweep" className="scale-[1.08] md:scale-[1.14]" title="Incentra" />
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function IntroRush({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-28 w-64 items-center justify-center overflow-visible ${className}`}>
      {[0, 1, 2, 3].map((index) => (
        <motion.span
          key={index}
          className="absolute h-[3px] w-40 rounded-full bg-white/72 blur-[0.25px]"
          initial={{ x: -170, opacity: 0.02, scaleX: 0.72 }}
          animate={{ x: 170, opacity: [0, 0.74, 0], scaleX: [0.72, 1.04, 0.8] }}
          transition={{
            duration: 0.94,
            delay: index * 0.11,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ top: `${30 + index * 10}px` }}
        />
      ))}
    </span>
  )
}

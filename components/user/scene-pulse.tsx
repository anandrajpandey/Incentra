'use client'

import { motion } from 'framer-motion'
import { Clock3, Sparkles } from 'lucide-react'
import type { ScenePulse } from '@/types'

interface ScenePulseProps {
  pulses: ScenePulse[]
  duration: number
  currentTime: number
  onJump?: (timeInSeconds: number) => void
}

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function ScenePulse({ pulses, duration, currentTime, onJump }: ScenePulseProps) {
  if (duration <= 0) return null

  return (
    <section className="mt-12 text-white">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-red-200/60">Scene Pulse</p>
          <h3 className="mt-2 text-2xl sm:text-3xl" data-display="true">
            Narrative Beat Map
          </h3>
        </div>
        <p className="max-w-xl text-sm leading-7 text-white/56">
          A live map of the scenes people keep coming back to in the conversation.
        </p>
      </div>

      {!pulses.length ? (
        <div className="mt-8 border-t border-white/10 pt-6 text-sm leading-7 text-white/56">
          The beat map will appear once viewers start reacting to the same moments.
        </div>
      ) : (
        <>
          <div className="relative mt-8 overflow-hidden py-8">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/18 to-transparent" />
            <motion.div
              className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 bg-gradient-to-r from-red-500/0 via-red-400/80 to-red-300/0"
              animate={{ width: `${Math.min((currentTime / duration) * 100, 100)}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />

            {pulses.map((pulse, index) => {
              const left = `${(pulse.timeInSeconds / duration) * 100}%`
              const active = currentTime >= pulse.timeInSeconds
              const size =
                pulse.intensity === 'high'
                  ? 'h-5 w-5'
                  : pulse.intensity === 'medium'
                    ? 'h-4 w-4'
                    : 'h-3 w-3'

              return (
                <motion.button
                  key={pulse.id}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.06 }}
                  onClick={() => onJump?.(pulse.timeInSeconds)}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-left"
                  style={{ left }}
                >
                  <span
                    className={`block ${size} rounded-full transition ${
                      active
                        ? 'bg-red-400 shadow-[0_0_28px_rgba(248,113,113,0.72)]'
                        : 'bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                    }`}
                  />
                </motion.button>
              )
            })}
          </div>

          <div className="space-y-5 border-t border-white/10 pt-6">
            {pulses.map((pulse, index) => {
              const active = currentTime >= pulse.timeInSeconds
              return (
                <motion.button
                  key={pulse.id}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.08 + index * 0.06 }}
                  onClick={() => onJump?.(pulse.timeInSeconds)}
                  className="grid w-full gap-3 border-b border-white/6 pb-5 text-left transition last:border-b-0 hover:border-white/14 md:grid-cols-[150px_1fr]"
                >
                  <div className="flex items-center gap-3 text-sm text-white/54">
                    <Clock3 className="h-4 w-4 text-red-200/70" />
                    <span>{formatTimestamp(pulse.timeInSeconds)}</span>
                  </div>
                  <div>
                    <p className={`inline-flex items-center gap-2 text-sm uppercase tracking-[0.22em] ${active ? 'text-red-100' : 'text-white/64'}`}>
                      <Sparkles className="h-3.5 w-3.5" />
                      {pulse.label}
                    </p>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-white/66">{pulse.description}</p>
                    {pulse.sampleCount ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.22em] text-white/36">
                        {pulse.sampleCount} recurring reactions
                      </p>
                    ) : null}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Send } from 'lucide-react'
import { IncentraEye } from '@/components/shared/incentra-eye'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CompanionMessage } from '@/types'

export function WatchCompanionUnavailable() {
  return (
    <div className="space-y-5 border-b border-white/10 pb-8 text-white">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0 opacity-90 scale-[1.08]">
          <IncentraEye mode="idle" size="compact" restingLook="left" />
          <div className="absolute -bottom-1 -right-1">
            <Image
              src="/companion-popcorn.svg"
              alt="Popcorn"
              width={36}
              height={36}
              className="drop-shadow-[0_8px_18px_rgba(0,0,0,0.4)]"
            />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-red-200/60">Second Seat</p>
          <h3 className="mt-2 text-3xl text-white" data-display="true">
            No CC, No Commentary
          </h3>
          <p className="mt-2 text-sm leading-7 text-white/62">
            I would love to sit here and talk nonsense with you, but I cannot watch this thing blind.
          </p>
        </div>
      </div>

      <div className="overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-sm text-white/92">Second Seat</p>
          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/35">Closed Captions Required</p>
        </div>

        <div className="space-y-4 px-4 py-5">
          <div className="max-w-[92%] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-4 py-3 text-sm leading-7 text-white shadow-[0_14px_40px_rgba(0,0,0,0.16)]">
            Sorry boss, I cannot do the whole psychic-cinema thing. Give me subtitles and I will start acting like I know everybody's business.
          </div>
          <p className="text-sm leading-7 text-white/52">
            Upload an `.srt` or `.vtt` file from admin and I will jump back in with scene beats, chat, and key-moment reactions.
          </p>
        </div>
      </div>
    </div>
  )
}

export function WatchCompanion({
  messages,
  isThinking,
  onSend,
  onJump,
}: {
  messages: CompanionMessage[]
  isThinking: boolean
  onSend: (message: string) => Promise<void>
  onJump: (seconds: number) => void
}) {
  const [draft, setDraft] = useState('')
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = threadRef.current
    if (!node) return
    node.scrollTo({
      top: node.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isThinking])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    const message = draft.trim()
    setDraft('')
    await onSend(message)
  }

  return (
    <div className="space-y-5 border-b border-white/10 pb-8 text-white">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0 opacity-90 scale-[1.08]">
          <IncentraEye mode="idle" size="compact" restingLook="left" />
          <div className="absolute -bottom-1 -right-1">
            <Image
              src="/companion-popcorn.svg"
              alt="Popcorn"
              width={36}
              height={36}
              className="drop-shadow-[0_8px_18px_rgba(0,0,0,0.4)]"
            />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-red-200/60">Second Seat</p>
          <h3 className="mt-2 text-3xl text-white" data-display="true">
            Watch Companion
          </h3>
          <p className="mt-2 text-sm leading-7 text-white/62">
            It only cuts in when the movie actually spikes, then talks to you like a friend who is fully locked in.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/40">
          <MessageCircle className="h-4 w-4 text-primary" />
          Ask the companion
        </div>

        <div className="overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm text-white/92">Second Seat</p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/35">Live Companion Thread</p>
            </div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">
              {isThinking ? 'Replying' : 'Watching'}
            </div>
          </div>

          <div ref={threadRef} className="themed-scrollbar max-h-[380px] space-y-3 overflow-auto bg-black/10 px-4 py-4">
          {messages.length === 0 ? (
            <div className="text-sm leading-7 text-white/56">
              Ask things like `what just happened`, `who do you trust here`, or `what do you think happens next`.
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[90%] ${message.role === 'assistant' ? 'items-start' : 'items-end'} flex flex-col gap-1`}>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/32">
                      {message.role === 'assistant' ? 'Second Seat' : 'You'}
                    </p>
                    <div
                      className={`px-4 py-3 text-sm leading-7 shadow-[0_14px_40px_rgba(0,0,0,0.16)] ${
                        message.role === 'assistant'
                          ? 'border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] text-white'
                          : 'bg-[linear-gradient(180deg,rgba(181,51,43,0.36),rgba(120,24,18,0.28))] text-white/92'
                      }`}
                    >
                      <p>{message.message}</p>
                    </div>
                    {message.role === 'assistant' && typeof message.timestampSeconds === 'number' ? (
                      <button
                        type="button"
                        onClick={() => onJump(message.timestampSeconds ?? 0)}
                        className="text-[11px] uppercase tracking-[0.22em] text-white/34 transition hover:text-primary"
                      >
                        Jump to {Math.floor(message.timestampSeconds / 60)}:
                        {(message.timestampSeconds % 60).toString().padStart(2, '0')}
                      </button>
                    ) : null}
                  </div>
                </motion.div>
              ))}
            </>
          )}
          {isThinking ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-3 border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-4 py-3 text-sm text-white/60">
                <span className="text-[11px] uppercase tracking-[0.24em] text-white/38">Companion</span>
                <span className="inline-flex items-center gap-1">
                  <motion.span
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: 0 }}
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                  />
                  <motion.span
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: 0.15 }}
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                  />
                  <motion.span
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: 0.3 }}
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                  />
                </span>
              </div>
            </div>
          ) : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask what that scene meant..."
            className="h-12 border-white/10 bg-white/5 text-white placeholder:text-white/28"
          />
          <Button type="submit" disabled={isThinking || !draft.trim()} className="h-12 px-4">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

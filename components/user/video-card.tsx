'use client'

import { motion } from 'framer-motion'
import { Clock3, Play, ThumbsUp } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { Video } from '@/types'

interface VideoCardProps {
  video: Video
  index?: number
}

export function VideoCard({ video, index = 0 }: VideoCardProps) {
  const durationMinutes = Math.floor(video.duration / 60)
  const durationSeconds = video.duration % 60

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group"
    >
      <Link href={`/watch/${video.id}`} className="block">
        <article className="overflow-hidden rounded-[28px] border border-border/60 bg-card/70 shadow-xl shadow-black/15 transition hover:border-primary/40">
          <div className="relative aspect-video overflow-hidden">
            <Image
              src={video.thumbnail}
              alt={video.title}
              fill
              className="object-cover transition duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/85">
              {video.category}
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="inline-flex rounded-full bg-white/15 p-3 text-white backdrop-blur-md transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Play className="h-5 w-5 fill-current" />
              </div>
              <div className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs text-white">
                {durationMinutes}:{String(durationSeconds).padStart(2, '0')}
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div>
              <h3 className="line-clamp-2 text-xl text-foreground" data-display="true">
                {video.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-foreground/60">
                {video.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-foreground/55">
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" />
                {video.likes.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {video.uploadedAt}
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  )
}

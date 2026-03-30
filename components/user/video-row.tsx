'use client'

import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Video } from '@/types'
import { VideoCard } from './video-card'
import { Button } from '@/components/ui/button'

interface VideoRowProps {
  title: string
  subtitle?: string
  videos: Video[]
}

export function VideoRow({ title, subtitle, videos }: VideoRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(videos.length > 4)

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return
    const scrollAmount = 500
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  const handleScroll = () => {
    const container = scrollContainerRef.current
    if (!container) return
    setShowLeftArrow(container.scrollLeft > 10)
    setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth - 10)
  }

  if (!videos.length) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-10"
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl text-foreground sm:text-3xl" data-display="true">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-foreground/60">{subtitle}</p> : null}
        </div>
      </div>

      <div className="group relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showLeftArrow ? 1 : 0 }}
          className="absolute left-0 top-0 bottom-0 z-10 hidden items-center md:flex"
        >
          <Button
            variant="ghost"
            size="icon"
            className="ml-2 rounded-full border border-border/60 bg-black/45 text-white hover:bg-black/65"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </motion.div>

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="scrollbar-hide flex gap-4 overflow-x-auto pb-2 pr-4 sm:gap-5"
        >
          {videos.map((video, index) => (
            <div key={video.id} className="w-[78vw] min-w-[78vw] sm:w-[280px] sm:min-w-[280px] md:w-[320px] md:min-w-[320px]">
              <VideoCard video={video} index={index} />
            </div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showRightArrow ? 1 : 0 }}
          className="absolute right-0 top-0 bottom-0 z-10 hidden items-center md:flex"
        >
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 rounded-full border border-border/60 bg-black/45 text-white hover:bg-black/65"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </motion.section>
  )
}

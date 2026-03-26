'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
}

export function Logo({ size = 'md', animated = true }: LogoProps) {
  const sizeClasses = {
    sm: 'h-9 w-[3.6rem]',
    md: 'h-10 w-[4rem]',
    lg: 'h-14 w-[5.6rem]',
  }

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-[1.7rem]',
  }

  const logoVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
        duration: 0.6,
      },
    },
  }

  const iconVariants = {
    hidden: { rotate: -180, opacity: 0 },
    visible: {
      rotate: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
        delay: 0.2,
      },
    },
  }

  const textVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        delay: 0.3,
      },
    },
  }

  return (
    <motion.div
      className="flex items-center gap-3"
      variants={logoVariants}
      initial={animated ? 'hidden' : 'visible'}
      animate="visible"
    >
      <motion.div
        className={`${sizeClasses[size]} relative shrink-0`}
        variants={iconVariants}
      >
        <Image
          src="/incentra-eye-logo.svg"
          alt="Incentra eye logo"
          fill
          sizes="(max-width: 768px) 64px, 96px"
          className="object-contain"
          priority={size === 'lg'}
        />
      </motion.div>
      <motion.span
        className={`${textSizes[size]} bg-gradient-to-r from-white via-red-100 to-red-300 bg-clip-text font-bold tracking-[0.22em] text-transparent`}
        variants={textVariants}
      >
        Incentra
      </motion.span>
    </motion.div>
  )
}

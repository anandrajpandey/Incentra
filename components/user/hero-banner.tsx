"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Sparkles, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Video } from "@/types";
import { Button } from "@/components/ui/button";
import { getGenreByName } from "@/services/genres";

interface HeroBannerProps {
  video: Video;
  kicker?: string;
  meta?: string[];
  activatePreview?: boolean;
}

export function HeroBanner({
  video,
  kicker,
  meta = [],
  activatePreview = true,
}: HeroBannerProps) {
  const primaryPlaybackUrl = video.streamUrl ?? video.videoUrl ?? "";
  const genre = getGenreByName(video.category);
  const previewRef = useRef<HTMLVideoElement>(null);
  const targetPreviewVolumeRef = useRef(0.26);
  const previewMutedRef = useRef(true);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(true);
  const isHls = video.playbackType === "hls" || primaryPlaybackUrl.toLowerCase().includes(".m3u8");
  const isMkv = (video.sourceFormat || primaryPlaybackUrl).toLowerCase().includes("mkv");
  const canUsePreviewVideo = Boolean(primaryPlaybackUrl) && !isMkv && !isHls;
  const previewStartTime = Math.min(
    Math.max(14, Math.round(video.duration * 0.46)),
    Math.max(0, video.duration - 9),
  );
  const previewLength = 15;

  useEffect(() => {
    const node = previewRef.current;
    previewMutedRef.current = previewMuted;
    if (!node) return;
    node.muted = previewMuted;
    targetPreviewVolumeRef.current = previewMuted ? 0 : 0.26;
    node.volume = previewMuted ? 0 : Math.min(node.volume || 0.26, 0.26);
  }, [previewMuted]);

  useEffect(() => {
    const node = previewRef.current;
    if (!canUsePreviewVideo || !node || !activatePreview) {
      setPreviewReady(false);
      if (node) {
        node.pause();
      }
      return;
    }

    let cancelled = false;
    setPreviewReady(false);

    const bootPreview = async () => {
      await ensureMetadata(node);
      if (cancelled) return;

      node.currentTime = previewStartTime;
      node.volume = 0;
      node.muted = previewMutedRef.current;

      try {
        await node.play();
      } catch {
        node.muted = true;
        setPreviewMuted(true);
        try {
          await node.play();
        } catch {
          if (!cancelled) {
            setPreviewReady(false);
          }
          return;
        }
      }

      if (!cancelled) {
        setPreviewReady(true);
      }
    };

    const handleTimeUpdate = () => {
      const elapsed = Math.max(0, node.currentTime - previewStartTime);
      const remaining = previewStartTime + previewLength - node.currentTime;
      const maxVolume = previewMutedRef.current ? 0 : targetPreviewVolumeRef.current;

      if (!previewMutedRef.current) {
        if (elapsed <= 1.2) {
          node.volume = maxVolume * Math.max(0, Math.min(1, elapsed / 1.2));
        } else if (remaining <= 1.4) {
          node.volume = maxVolume * Math.max(0, Math.min(1, remaining / 1.4));
        } else {
          node.volume = maxVolume;
        }
      }

      if (node.currentTime >= previewStartTime + previewLength) {
        node.volume = 0;
        node.currentTime = previewStartTime;
        if (node.paused) {
          void node.play().catch(() => undefined);
        }
      }
    };

    void bootPreview();
    node.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      cancelled = true;
      node.pause();
      node.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [activatePreview, canUsePreviewVideo, previewLength, previewStartTime, video.id]);

  const togglePreviewAudio = () => {
    const node = previewRef.current;
    const nextMuted = !previewMuted;
    setPreviewMuted(nextMuted);

    if (!node) return;

    node.muted = nextMuted;
    targetPreviewVolumeRef.current = nextMuted ? 0 : 0.26;
    node.volume = nextMuted ? 0 : 0.1;

    if (!nextMuted && node.paused) {
      void node.play().catch(() => {
        node.muted = true;
        setPreviewMuted(true);
      });
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative mb-12 overflow-hidden -mx-4 sm:-mx-6 lg:-mx-10 2xl:-mx-14"
    >
      <div className="relative min-h-[calc(100vh-4rem)]">
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          className={`object-cover transition duration-700 ${
            previewReady ? "scale-[1.03] opacity-0" : "opacity-100"
          }`}
          priority
        />
        {canUsePreviewVideo ? (
          <video
            ref={previewRef}
            src={primaryPlaybackUrl}
            poster={video.thumbnail}
            autoPlay
            muted={previewMuted}
            playsInline
            preload="metadata"
            className={`absolute inset-0 h-full w-full object-cover transition duration-700 ${
              previewReady ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(255,183,77,0.25),transparent_24%),linear-gradient(90deg,rgba(10,15,27,0.98),rgba(10,15,27,0.78)_42%,rgba(10,15,27,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,12,0.08),rgba(6,8,12,0.44)_55%,rgba(6,8,12,0.82)_100%)]" />
        {canUsePreviewVideo ? (
          <button
            type="button"
            onClick={togglePreviewAudio}
            className="absolute bottom-28 right-4 z-20 text-white/78 transition hover:text-white sm:right-6 md:bottom-36 md:right-10 lg:bottom-36 lg:right-14 2xl:bottom-36 2xl:right-20"
            aria-label={previewMuted ? "Unmute preview" : "Mute preview"}
          >
            {previewMuted ? (
              <VolumeX className="h-5 w-5 md:h-6 md:w-6" />
            ) : (
              <Volume2 className="h-5 w-5 md:h-6 md:w-6" />
            )}
          </button>
        ) : null}

        <div className="relative z-10 flex min-h-[calc(100vh-4rem)] items-end px-4 py-8 pb-3 sm:px-6 sm:py-10 md:px-10 lg:px-14 2xl:px-20">
          <div className="max-w-2xl pb-10 sm:pb-24">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.35em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Featured Premiere
            </div>

            <h1
              className="max-w-xl text-4xl leading-none text-white sm:text-5xl md:text-7xl"
              data-display="true"
            >
              {video.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-white/80 sm:text-base">
              {video.description}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/70 sm:mt-6 sm:gap-4 sm:text-sm">
              <span>{video.likes.toLocaleString()} likes</span>
              <span>{Math.ceil(video.duration / 60)} min runtime</span>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link href={`/watch/${video.id}`} className="w-full sm:w-auto">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  <Play className="h-5 w-5 fill-current" />
                  Watch now
                </Button>
              </Link>
              {genre ? (
                <Link href={`/genre/${genre.slug}`} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                  >
                    Explore {genre.name}
                  </Button>
                </Link>
              ) : (
                <a href="#catalog" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                  >
                    Browse rows
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-4 px-4 pb-4 sm:px-6 sm:pb-5 md:absolute md:bottom-0 md:left-0 md:right-0 md:mt-0 md:px-10 lg:px-14 2xl:px-20">
          <div className="flex flex-col gap-4 border-t border-white/10 pt-4 text-white md:pt-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-red-200/70">
                {kicker ?? "Picked For Tonight"}
              </p>
              <p className="mt-2 max-w-xl text-xs leading-6 text-white/62 sm:text-sm sm:leading-7">
                A strong first watch for tonight, with a mood that carries from
                the opening frame through the late-hour finish.
              </p>
            </div>
            {meta.length ? (
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/70 sm:gap-6 sm:text-sm">
                {meta.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ensureMetadata(node: HTMLVideoElement) {
  if (node.readyState >= 1) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const handleLoadedMetadata = () => {
      node.removeEventListener("loadedmetadata", handleLoadedMetadata);
      resolve();
    };

    node.addEventListener("loadedmetadata", handleLoadedMetadata);
    node.load();
  });
}

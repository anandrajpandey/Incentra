"use client";

import { FormEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { EyeOff, MessageCircleMore, ShieldAlert } from "lucide-react";
import type { CreateCommentInput, SocialComment } from "@/types";
import { Button } from "@/components/ui/button";

interface SpoilerSafeSocialProps {
  comments: SocialComment[];
  isSubmitting: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  defaultAuthorName: string;
  currentTime: number;
  onSubmit: (input: CreateCommentInput) => Promise<void>;
  onJumpToTimestamp?: (seconds: number) => void;
  onLoadMore?: () => Promise<void> | void;
}

function formatAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.floor(diff / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTimestamp(seconds?: number) {
  if (!seconds && seconds !== 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SpoilerSafeSocial({
  comments,
  isSubmitting,
  isLoadingMore = false,
  hasMore = false,
  defaultAuthorName,
  currentTime,
  onSubmit,
  onJumpToTimestamp,
  onLoadMore,
}: SpoilerSafeSocialProps) {
  const [message, setMessage] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [aura, setAura] = useState("Voltage");
  const [authorName, setAuthorName] = useState(defaultAuthorName);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [attachTimestamp, setAttachTimestamp] = useState(true);

  const safeCount = useMemo(
    () => comments.filter((comment) => !comment.containsSpoilers).length,
    [comments],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    await onSubmit({
      authorName: authorName.trim() || defaultAuthorName,
      message: message.trim(),
      containsSpoilers,
      aura,
      timestampSeconds: attachTimestamp ? Math.floor(currentTime) : undefined,
    });
    setMessage("");
    setContainsSpoilers(false);
  };

  return (
    <section className="text-white">
      <div className="pb-5">
        <p className="text-xs uppercase tracking-[0.35em] text-red-200/60">
          Reactions
        </p>
        <h3 className="mt-2 text-3xl" data-display="true">
          Spoiler-Safe Social
        </h3>
        <p className="mt-3 text-sm leading-7 text-white/58">
          {safeCount} visible reactions. Hidden posts stay blurred until you choose to reveal them.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Display name"
            className="h-12 rounded-2xl border border-white/12 bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-white/26"
          />
          <select
            value={aura}
            onChange={(event) => setAura(event.target.value)}
            className="h-12 rounded-2xl border border-white/12 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-white/26"
          >
            <option className="bg-black">Damn🔥</option>
            <option className="bg-black">Wtfff💀</option>
            <option className="bg-black">Huhh🤔</option>
            <option className="bg-black">Awww💖</option>
          </select>
        </div>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Leave a reaction, scene thought, or spoiler-marked theory."
          className="mt-4 min-h-28 w-full rounded-[24px] border border-white/12 bg-black/20 px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-white/26"
        />
        <div className="mt-4 space-y-3 text-sm text-white/68">
          <label className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2">
            <input
              type="checkbox"
              checked={containsSpoilers}
              onChange={(event) => setContainsSpoilers(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5"
            />
            Hide this reaction behind a spoiler shield
          </label>
          <label className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2">
            <input
              type="checkbox"
              checked={attachTimestamp}
              onChange={(event) => setAttachTimestamp(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5"
            />
            Anchor to current scene at{" "}
            {formatTimestamp(Math.floor(currentTime))}
          </label>
        </div>
        <Button
          type="submit"
          disabled={isSubmitting || !message.trim()}
          className="mt-5 rounded-full bg-[linear-gradient(135deg,#5a0000,#af1111_58%,#ff4949)] text-white"
        >
          <MessageCircleMore className="mr-2 h-4 w-4" />
          Post reaction
        </Button>
      </form>

      <div className="mt-6 rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.22)] backdrop-blur-md">
        <div className="space-y-0">
        {comments.map((comment, index) => {
          const revealed = revealedIds.includes(comment.commentId);
          const hidden = comment.containsSpoilers && !revealed;

          return (
            <motion.article
              key={comment.commentId}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.04 }}
              className="border-b border-white/8 px-4 py-5 last:border-b-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {comment.authorName}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/40">
                    {comment.aura ?? "Reaction"}
                    {comment.timestampSeconds !== undefined
                      ? ` / ${formatTimestamp(comment.timestampSeconds)}`
                      : ""}
                    {` / ${formatAgo(comment.createdAt)}`}
                  </p>
                </div>
                {comment.containsSpoilers ? (
                  <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-red-100/78">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Spoiler Shield
                  </span>
                ) : null}
              </div>

              <div
                className={`mt-3 transition ${hidden ? "blur-[7px] saturate-0" : ""}`}
              >
                <p className="text-sm leading-7 text-white/74">
                  {comment.message}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {hidden ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-0 text-sm text-white/64 hover:bg-transparent hover:text-white"
                    onClick={() =>
                      setRevealedIds((current) => [
                        ...current,
                        comment.commentId,
                      ])
                    }
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Reveal spoiler
                  </Button>
                ) : null}
                {comment.timestampSeconds !== undefined ? (
                  <button
                    type="button"
                    onClick={() =>
                      onJumpToTimestamp?.(comment.timestampSeconds as number)
                    }
                    className="text-xs uppercase tracking-[0.22em] text-red-100/78 transition hover:text-white"
                  >
                    Jump to {formatTimestamp(comment.timestampSeconds)}
                  </button>
                ) : null}
              </div>
            </motion.article>
          );
        })}
        </div>

        {hasMore ? (
          <div className="border-t border-white/8 px-4 pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={isLoadingMore}
              onClick={() => onLoadMore?.()}
              className="h-auto px-0 text-sm text-red-100/78 hover:bg-transparent hover:text-white"
            >
              {isLoadingMore ? "Loading more..." : "View more reactions"}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

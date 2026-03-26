"use client";

import { motion } from "framer-motion";
import { Tv2 } from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { GENRES } from "@/services/genres";

export function Navbar() {
  const { user } = useAuth();

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/45"
    >
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-10 2xl:px-14">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Logo size="md" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/"
            className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
          >
            Discover
          </Link>
          {GENRES.slice(0, 4).map((genre) => (
            <Link
              key={genre.slug}
              href={`/genre/${genre.slug}`}
              className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              {genre.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/profile"
                className="hidden items-center gap-3 text-sm text-foreground/76 transition hover:text-foreground md:flex"
              >
                <Avatar className="size-7">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-white/6 text-xs text-white">
                    {user.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex items-center gap-2">
                  <Tv2 className="h-4 w-4 text-primary" />
                  {user.name}
                </span>
              </Link>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </motion.nav>
  );
}

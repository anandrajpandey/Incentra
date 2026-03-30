"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { AlertCircle, Lock, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IncentraEye } from "@/components/shared/incentra-eye";
import { Logo } from "@/components/shared/logo";
import { useAuth } from "@/hooks/useAuth";
import { apiConfig } from "@/services/config";
import type { GoogleIdentityProfile } from "@/types";

export default function LoginPage() {
  const router = useRouter();
  const { loginUser, loginWithGoogleUser, isLoading, error, resetAuthState } =
    useAuth();
  const headline = "Welcome Back";
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [redirectTarget, setRedirectTarget] = useState("/");
  const [typedHeadline, setTypedHeadline] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRedirectTarget(params.get("redirect") || "/");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.google?.accounts?.id) {
      setGoogleReady(true);
    }
  }, []);

  useEffect(() => {
    resetAuthState();
  }, [resetAuthState]);

  useEffect(() => {
    setTypedHeadline("");
    let index = 0;

    const timer = window.setInterval(() => {
      index += 1;
      setTypedHeadline(headline.slice(0, index));

      if (index >= headline.length) {
        window.clearInterval(timer);
      }
    }, 85);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (
      !googleReady ||
      !apiConfig.googleClientId ||
      !googleButtonRef.current ||
      !window.google
    ) {
      return;
    }

    googleButtonRef.current.innerHTML = "";

    window.google.accounts.id.initialize({
      client_id: apiConfig.googleClientId,
      callback: async ({ credential }) => {
        try {
          const profile = decodeGoogleCredential(credential);
          await loginWithGoogleUser(profile);
          router.push(redirectTarget);
        } catch (authError) {
          setLocalError(
            authError instanceof Error
              ? authError.message
              : "Google sign-in failed",
          );
        }
      },
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "filled_black",
      shape: "pill",
      text: "signin_with",
      size: "large",
      width: 360,
      logo_alignment: "left",
    });
  }, [googleReady, loginWithGoogleUser, redirectTarget, router]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
    setLocalError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.identifier || !formData.password) {
      setLocalError("Please fill in all fields");
      return;
    }

    try {
      await loginUser(formData.identifier, formData.password);
      router.push(redirectTarget);
    } catch (submitError) {
      setLocalError(
        submitError instanceof Error ? submitError.message : "Login failed",
      );
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-6 text-white sm:py-10">
      {apiConfig.googleClientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setGoogleReady(true)}
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(115,0,0,0.18),transparent_22%),radial-gradient(circle_at_78%_20%,rgba(255,0,0,0.08),transparent_18%),linear-gradient(180deg,#040404_0%,#0a0606_46%,#020202_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.015)_0,transparent_20%,rgba(255,255,255,0.015)_40%,transparent_68%,rgba(255,255,255,0.015)_100%)] opacity-30" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-4 top-4 sm:left-[6%] sm:top-[8%]">
          <Logo size="lg" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 hidden items-center justify-start pl-[4%] pr-[46%] lg:flex"
        >
          <IncentraEye
            mode="track"
            trackingScope="page"
            className="scale-[1.06] md:scale-[1.16] lg:scale-[1.2]"
            title="Incentra"
            subtitle="Watch differently.
Because every scene has a story and great stories deserve more than just play and pause."
          />
        </motion.div>
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-7xl items-center gap-6 pt-16 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-0">
        <div />
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
        >
          <Card className="border-white/8 bg-[linear-gradient(180deg,rgba(16,16,16,0.94),rgba(7,7,7,0.98))] p-5 text-white shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-red-200/60">
              Credentials
            </p>
            <div className="mt-3 overflow-hidden">
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="login-robotic relative min-h-[1.2em] max-w-full text-3xl leading-none text-white sm:whitespace-nowrap sm:text-5xl"
              >
                {typedHeadline}
                <motion.span
                  aria-hidden="true"
                  className="ml-1 inline-block h-[0.9em] w-[0.08em] bg-primary align-[-0.1em]"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.h2>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/58">
              Step back into your next watchlist, late-night favorite, or fresh
              premiere.
            </p>
            <p className="mt-2 text-sm leading-7 text-white/46">
              To sign up, just enter your email and password here and continue.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/82">
                  Email or username
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/28" />
                  <Input
                    type="text"
                    name="identifier"
                    value={formData.identifier}
                    onChange={handleChange}
                    placeholder="you@example.com or your username"
                    disabled={isLoading}
                    className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/26"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/82">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/28" />
                  <Input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/26"
                  />
                </div>
              </div>

              {(error || localError) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100"
                >
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{error || localError}</span>
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                size="lg"
                className="h-14 w-full rounded-2xl border-0 bg-[linear-gradient(135deg,#5a0000,#af1111_58%,#ff4949)] text-white shadow-[0_18px_45px_rgba(128,0,0,0.38)]"
              >
                <span className="flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <EyeRush />
                      Entering Incentra...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5" />
                      Sign In
                    </>
                  )}
                </span>
              </Button>
            </form>

            <div className="mt-6">
              <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.32em] text-white/28">
                <span className="h-px flex-1 bg-white/10" />
                or continue with
                <span className="h-px flex-1 bg-white/10" />
              </div>

              {apiConfig.googleClientId ? (
                <div className="mt-5 flex justify-center">
                  <div ref={googleButtonRef} className="min-h-11" />
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4 text-sm text-white/54">
                  Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to enable Google sign-in
                  here.
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-sm text-white/46">
              Want to return to browsing?{" "}
              <Link
                href="/"
                className="font-semibold text-red-200 hover:text-white"
              >
                Go Home
              </Link>
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function decodeGoogleCredential(credential: string): GoogleIdentityProfile {
  const payload = credential.split(".")[1];

  if (!payload) {
    throw new Error("Google sign-in returned an invalid credential");
  }

  const json = JSON.parse(
    decodeURIComponent(
      atob(payload)
        .split("")
        .map(
          (character) =>
            `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
        )
        .join(""),
    ),
  ) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  if (!json.email || !json.name) {
    throw new Error(
      "Google sign-in did not include the required account details",
    );
  }

  return {
    googleId: json.sub,
    email: json.email,
    name: json.name,
    avatar: json.picture ?? "",
  };
}

function EyeRush() {
  return (
    <span className="relative mr-1 flex h-5 w-12 items-center justify-center overflow-hidden">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="absolute h-[2px] w-8 rounded-full bg-white/90"
          initial={{ x: -26, opacity: 0.15 }}
          animate={{ x: 30, opacity: [0, 0.95, 0] }}
          transition={{
            duration: 0.7,
            delay: index * 0.12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ top: `${6 + index * 5}px` }}
        />
      ))}
    </span>
  );
}

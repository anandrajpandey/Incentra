"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

interface IncentraEyeProps {
  mode?: "track" | "sweep" | "idle";
  className?: string;
  title?: string;
  subtitle?: string;
  trackingScope?: "local" | "page";
  size?: "default" | "compact";
  restingLook?: "center" | "left" | "right";
}

export function IncentraEye({
  mode = "track",
  className = "",
  title,
  subtitle,
  trackingScope = "local",
  size = "default",
  restingLook = "center",
}: IncentraEyeProps) {
  const eyeRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [shellVisible, setShellVisible] = useState(false);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });
  const restingOffset = useMemo(
    () => ({
      x: 0,
      y: 0,
    }),
    [restingLook],
  );
  const [animationState, setAnimationState] = useState({
    pupilX: restingOffset.x,
    pupilY: restingOffset.y,
    pulse: 0,
    shimmer: 0,
    pupilScale: 1,
  });
  const isCompact = size === "compact";

  const dimensions = isCompact
    ? {
        frame: "h-[5.6rem] w-[9.4rem] md:h-[6.6rem] md:w-[11.4rem]",
        shell: "h-[4.8rem] w-[8.5rem] md:h-[5.7rem] md:w-[10.4rem]",
        iris: "h-[3.15rem] w-[3.15rem] md:h-[3.72rem] md:w-[3.72rem]",
        pupil: "h-[1.34rem] w-[1.34rem] md:h-[1.58rem] md:w-[1.58rem]",
        outerSvg: "w-[8.9rem] md:w-[10.8rem]",
      }
    : {
        frame: "h-[15rem] w-[26rem] md:h-[18rem] md:w-[34rem]",
        shell: "h-[12rem] w-[23rem] md:h-[14.4rem] md:w-[29rem]",
        iris: "h-[8rem] w-[8rem] md:h-[9.45rem] md:w-[9.45rem]",
        pupil: "h-[3.45rem] w-[3.45rem] md:h-[4.04rem] md:w-[4.04rem]",
        outerSvg: "w-[23.5rem] md:w-[29.8rem]",
      };

  useEffect(() => {
    const timer = window.setTimeout(() => setShellVisible(true), 40);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const eye = eyeRef.current;
      if (!eye || mode === "idle") return;

      const rect = eye.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const normalizedX = (event.clientX - centerX) / (rect.width / 2);
      const normalizedY = (event.clientY - centerY) / (rect.height / 2);

      pointerTargetRef.current = {
        x: Math.max(-0.72, Math.min(0.72, normalizedX)),
        y: Math.max(-0.48, Math.min(0.48, normalizedY)),
      };
    };

    const resetPointer = () => {
      pointerTargetRef.current = {
        x: restingOffset.x,
        y: restingOffset.y,
      };
    };

    const target: Window | HTMLDivElement =
      trackingScope === "page" ? window : (eyeRef.current ?? window);

    target.addEventListener("pointermove", handlePointerMove as EventListener);

    if (trackingScope === "page") {
      window.addEventListener("pointerleave", resetPointer);
      window.addEventListener("blur", resetPointer);
    } else if (eyeRef.current) {
      eyeRef.current.addEventListener("pointerleave", resetPointer);
    }

    return () => {
      target.removeEventListener(
        "pointermove",
        handlePointerMove as EventListener,
      );
      if (trackingScope === "page") {
        window.removeEventListener("pointerleave", resetPointer);
        window.removeEventListener("blur", resetPointer);
      } else if (eyeRef.current) {
        eyeRef.current.removeEventListener("pointerleave", resetPointer);
      }
    };
  }, [mode, restingOffset.x, restingOffset.y, trackingScope]);

  useEffect(() => {
    const tick = (time: number) => {
      const pulse = (Math.sin(time * 0.0017) + 1) / 2;
      const shimmer = (Math.sin(time * 0.00062) + 1) / 2;
      const pupilScale = 0.96 + ((Math.sin(time * 0.0011) + 1) / 2) * 0.1;
      const nextX =
        pointerCurrentRef.current.x +
        (pointerTargetRef.current.x - pointerCurrentRef.current.x) * 0.1;
      const nextY =
        pointerCurrentRef.current.y +
        (pointerTargetRef.current.y - pointerCurrentRef.current.y) * 0.1;

      pointerCurrentRef.current = {
        x: nextX,
        y: nextY,
      };

      setAnimationState({
        pupilX: nextX,
        pupilY: nextY,
        pulse,
        shimmer,
        pupilScale,
      });

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null)
        window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const glowOpacity = 0.24 + animationState.pulse * 0.26;
  const shimmerRotation = animationState.shimmer * 360;
  const pupilTransform = `translate(calc(-50% + ${animationState.pupilX * 18}px), calc(-50% + ${animationState.pupilY * 10}px)) scale(${animationState.pupilScale})`;
  const highlightTransform = `translate(calc(-50% + ${animationState.pupilX * 18}px), calc(-50% + ${animationState.pupilY * 10}px))`;

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <div
        ref={eyeRef}
        className={`relative flex items-center justify-center ${dimensions.frame}`}
        style={{ transform: "rotate(-4.2deg)" }}
      >
        <div
          className={`pointer-events-none absolute left-1/2 top-1/2 aspect-[3/2] -translate-x-1/2 -translate-y-1/2 ${dimensions.outerSvg}`}
          style={{
            filter: "drop-shadow(0 20px 54px rgba(0,0,0,0.3))",
            opacity: shellVisible ? 1 : 0,
            scale: shellVisible ? "1" : "0.975",
            transition:
              "opacity 820ms cubic-bezier(0.22, 1, 0.36, 1), scale 900ms cubic-bezier(0.22, 1, 0.36, 1), filter 900ms ease",
          }}
        >
          <div
            className="absolute inset-0 rounded-[42%]"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, rgba(9,10,18,0) 54%, rgba(9,10,18,0.08) 74%, rgba(9,10,18,0.18) 88%, rgba(9,10,18,0.28) 100%)",
              transform: "scale(1.05)",
              filter: mode === "sweep" ? "blur(14px)" : "blur(20px)",
              opacity: mode === "sweep" ? 0.42 : 1,
            }}
          />
          <Image
            src="/eye-reference-2.png"
            alt="Incentra eye shell"
            fill
            priority
            className="object-contain"
            style={{
              opacity: 0.78,
              filter: "saturate(0.82) brightness(0.88) contrast(1.02)",
              maskImage:
                "radial-gradient(ellipse at 50% 50%, black 0%, black 58%, rgba(0,0,0,0.94) 76%, rgba(0,0,0,0.56) 90%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse at 50% 50%, black 0%, black 58%, rgba(0,0,0,0.94) 76%, rgba(0,0,0,0.56) 90%, transparent 100%)",
            }}
          />
        </div>

        <div
          className={`absolute ${dimensions.iris} rounded-full border border-white/18`}
          style={{
            background:
              "radial-gradient(circle at 50% 48%, rgba(255,164,176,0.88) 0%, rgba(255,70,92,0.94) 24%, rgba(211,24,44,0.98) 48%, rgba(92,7,14,1) 82%, rgba(20,1,3,1) 100%)",
            boxShadow: `0 0 40px rgba(255,44,64,${glowOpacity}), inset 0 12px 18px rgba(255,255,255,0.09), inset 0 -20px 28px rgba(0,0,0,0.42)`,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
        <div
          className={`absolute ${dimensions.iris} rounded-full`}
          style={{
            transform: `rotate(${shimmerRotation}deg)`,
            background:
              "conic-gradient(from 180deg at 50% 50%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.12) 45deg, rgba(255,255,255,0.02) 90deg, rgba(255,255,255,0) 360deg)",
            filter: "blur(8px)",
            mixBlendMode: "screen",
            opacity: 0.44,
            left: "50%",
            top: "50%",
            translate: "-50% -50%",
          }}
        />
        <div
          className={`absolute ${dimensions.iris} rounded-full`}
          style={{
            clipPath:
              "polygon(0% 0%, 100% 0%, 100% 42%, 82% 46%, 62% 48%, 40% 47%, 18% 44%, 0% 39%)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.08) 36%, rgba(255,255,255,0.01) 100%)",
            opacity: 0.82,
            filter: "blur(1px)",
            left: "50%",
            top: "50%",
            translate: "-50% -50%",
          }}
        />
        <div
          className={`absolute ${dimensions.pupil} rounded-full`}
          style={{
            left: "50%",
            top: "50%",
            transform: pupilTransform,
            background:
              "radial-gradient(circle at 42% 40%, rgba(56,10,16,0.22) 0%, rgba(14,2,5,0.78) 18%, rgba(0,0,0,0.97) 66%, rgba(0,0,0,1) 100%)",
            boxShadow: "0 0 24px rgba(0,0,0,0.96)",
          }}
        />
        <div
          className="absolute rounded-full bg-white/80 blur-[1px]"
          style={{
            left: `calc(50% - ${isCompact ? "0.75rem" : "1.1rem"})`,
            top: `calc(50% - ${isCompact ? "1rem" : "1.5rem"})`,
            transform: highlightTransform,
            width: isCompact ? "0.45rem" : "0.75rem",
            height: isCompact ? "0.45rem" : "0.75rem",
          }}
        />
      </div>

      {title ? (
        <div className="mt-6 text-center">
          <div className="bg-[linear-gradient(90deg,#ffffff_0%,#f6d0d0_50%,#ff5a5a_100%)] bg-clip-text text-5xl font-bold tracking-[0.28em] text-transparent md:text-7xl">
            {title}
          </div>
          {subtitle ? (
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/58 md:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

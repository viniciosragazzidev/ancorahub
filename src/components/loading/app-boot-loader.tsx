"use client";

import { AnimatedLogo } from "@/components/branding/animated-logo";

type AppBootLoaderProps = {
  isLoading: boolean;
  message?: string;
};

export function AppBootLoader({
  isLoading,
  message = "Preparando seu ambiente...",
}: AppBootLoaderProps) {
  return (
    <div
      data-visible={isLoading}
      className="app-boot-loader bg-background text-foreground"
      aria-hidden={!isLoading}
    >
      <AnimatedLogo isWaiting={isLoading} />
      <span className="text-xs font-medium text-muted-foreground animate-pulse">
        {message}
      </span>

      <style jsx>{`
        .app-boot-loader {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: grid;
          place-content: center;
          gap: 20px;
          opacity: 1;
          visibility: visible;
          transition:
            opacity 300ms ease,
            visibility 300ms ease;
        }

        .app-boot-loader[data-visible="false"] {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

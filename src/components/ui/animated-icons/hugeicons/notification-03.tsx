'use client';

import type { Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';

import { cn } from '@/lib/utils';

export interface HugeiconsNotification03IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface HugeiconsNotification03IconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const BELL_VARIANTS: Variants = {
  normal: { rotate: 0 },
  animate: { rotate: [0, -8, 8, -8, 0] },
};

const DOT_VARIANTS: Variants = {
  normal: { scale: 1, opacity: 1 },
  animate: { scale: [1, 1.4, 1], opacity: [1, 0.7, 1] },
};

const HugeiconsNotification03Icon = forwardRef<
  HugeiconsNotification03IconHandle,
  HugeiconsNotification03IconProps
>(({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
  const controls = useAnimation();
  const isControlledRef = useRef(false);

  useImperativeHandle(ref, () => {
    isControlledRef.current = true;

    return {
      startAnimation: () => controls.start('animate'),
      stopAnimation: () => controls.start('normal'),
    };
  });

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isControlledRef.current) {
        controls.start('animate');
      } else {
        onMouseEnter?.(e);
      }
    },
    [controls, onMouseEnter]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isControlledRef.current) {
        controls.start('normal');
      } else {
        onMouseLeave?.(e);
      }
    },
    [controls, onMouseLeave]
  );

  return (
    <div
      className={cn(className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={BELL_VARIANTS}
        animate={controls}
        transition={{
          duration: 0.5,
          ease: 'easeInOut',
        }}
      >
        {/* Bell body */}
        <path d="M2.52992 14.7696C2.31727 16.1636 3.268 17.1312 4.43205 17.6134C8.89481 19.4622 15.1052 19.4622 19.5679 17.6134C20.732 17.1312 21.6827 16.1636 21.4701 14.7696C21.3394 13.9129 20.6932 13.1995 20.2144 12.5029C19.5873 11.5793 19.525 10.5718 19.5249 9.5C19.5249 5.35786 16.1559 2 12 2C7.84413 2 4.47513 5.35786 4.47513 9.5C4.47503 10.5718 4.41272 11.5793 3.78561 12.5029C3.30684 13.1995 2.66061 13.9129 2.52992 14.7696Z" />
        {/* Bell clapper */}
        <path d="M8 19C8.45849 20.7252 10.0755 22 12 22C13.9245 22 15.5415 20.7252 16 19" />
        {/* Notification dot badge */}
        <motion.circle
          cx="18"
          cy="6"
          r="3"
          fill="currentColor"
          stroke="none"
          variants={DOT_VARIANTS}
          animate={controls}
          transition={{
            duration: 0.6,
            ease: 'easeInOut',
          }}
        />
      </motion.svg>
    </div>
  );
});

HugeiconsNotification03Icon.displayName = 'HugeiconsNotification03Icon';

export { HugeiconsNotification03Icon };

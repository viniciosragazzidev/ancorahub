'use client';

import type { Transition, Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';

import { cn } from '@/lib/utils';

export interface HugeiconsXCircleIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface HugeiconsXCircleIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const DEFAULT_TRANSITION: Transition = {
  duration: 0.4,
  ease: 'easeOut',
};

const CIRCLE_VARIANTS: Variants = {
  normal: {
    scale: 1,
    opacity: 1,
  },
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
  },
};

const X_VARIANTS: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
  },
};

const HugeiconsXCircleIcon = forwardRef<
  HugeiconsXCircleIconHandle,
  HugeiconsXCircleIconProps
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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Circle outline */}
        <motion.path
          d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12Z"
          variants={CIRCLE_VARIANTS}
          transition={DEFAULT_TRANSITION}
          animate={controls}
        />
        {/* X first stroke */}
        <motion.path
          d="M14.9994 15L9 9"
          variants={X_VARIANTS}
          transition={{ ...DEFAULT_TRANSITION, delay: 0.1 }}
          animate={controls}
        />
        {/* X second stroke */}
        <motion.path
          d="M9.00064 15L15 9"
          variants={X_VARIANTS}
          transition={{ ...DEFAULT_TRANSITION, delay: 0.2 }}
          animate={controls}
        />
      </svg>
    </div>
  );
});

HugeiconsXCircleIcon.displayName = 'HugeiconsXCircleIcon';

export { HugeiconsXCircleIcon };

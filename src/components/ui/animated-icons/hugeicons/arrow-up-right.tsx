'use client';

import type { Transition, Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';

import { cn } from '@/lib/utils';

export interface HugeiconsArrowUpRightIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface HugeiconsArrowUpRightIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const DEFAULT_TRANSITION: Transition = {
  duration: 0.6,
  ease: 'easeOut',
};

const ARROW_VARIANTS: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
  },
};

const HugeiconsArrowUpRightIcon = forwardRef<
  HugeiconsArrowUpRightIconHandle,
  HugeiconsArrowUpRightIconProps
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
        {/* Curved arrow body from bottom-left swooping to top */}
        <motion.path
          d="M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15"
          variants={ARROW_VARIANTS}
          transition={DEFAULT_TRANSITION}
          animate={controls}
        />
        {/* Arrowhead line pointing to the target */}
        <motion.path
          d="M16.5 7.5L6.5 17.5"
          variants={ARROW_VARIANTS}
          transition={{ ...DEFAULT_TRANSITION, delay: 0.2 }}
          animate={controls}
        />
      </svg>
    </div>
  );
});

HugeiconsArrowUpRightIcon.displayName = 'HugeiconsArrowUpRightIcon';

export { HugeiconsArrowUpRightIcon };

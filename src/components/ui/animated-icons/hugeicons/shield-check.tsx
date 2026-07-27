'use client';

import type { Transition, Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';

import { cn } from '@/lib/utils';

export interface HugeiconsShieldCheckIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface HugeiconsShieldCheckIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const DEFAULT_TRANSITION: Transition = {
  duration: 0.5,
  ease: 'easeOut',
};

const SHIELD_VARIANTS: Variants = {
  normal: {
    scale: 1,
    opacity: 1,
  },
  animate: {
    scale: [1, 1.03, 1],
    opacity: [1, 0.85, 1],
  },
};

const CHECK_VARIANTS: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
  },
};

const HugeiconsShieldCheckIcon = forwardRef<
  HugeiconsShieldCheckIconHandle,
  HugeiconsShieldCheckIconProps
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
        {/* Shield body */}
        <motion.path
          d="M18.7088 3.49534C16.8165 2.55382 14.5009 2 12 2C9.4991 2 7.1835 2.55382 5.29116 3.49534C4.36318 3.95706 3.89919 4.18792 3.4496 4.91378C3 5.63965 3 6.34248 3 7.74814V11.2371C3 16.9205 7.54236 20.0804 10.173 21.4338C10.9067 21.8113 11.2735 22 12 22C12.7265 22 13.0933 21.8113 13.8269 21.4338C16.4576 20.0804 21 16.9205 21 11.2371L21 7.74814C21 6.34249 21 5.63966 20.5504 4.91378C20.1008 4.18791 19.6368 3.95706 18.7088 3.49534Z"
          variants={SHIELD_VARIANTS}
          transition={DEFAULT_TRANSITION}
          animate={controls}
        />
        {/* Checkmark inside shield */}
        <motion.path
          d="M9 12.5C9 12.5 10.5 13.5 11.5 15C11.5 15 14 10 16 9"
          variants={CHECK_VARIANTS}
          transition={{ ...DEFAULT_TRANSITION, delay: 0.15 }}
          animate={controls}
        />
      </svg>
    </div>
  );
});

HugeiconsShieldCheckIcon.displayName = 'HugeiconsShieldCheckIcon';

export { HugeiconsShieldCheckIcon };

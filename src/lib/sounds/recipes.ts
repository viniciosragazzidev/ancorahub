/**
 * Sound recipes for ancorahub — plain objects, no imports, no audio files.
 *
 * Each recipe is a `Patch` object consumed by `playSound()` from `./player`.
 * Sounds are synthesized live via Web Audio API.
 *
 * Source style: procedural-sounds (https://procedural-sounds.vercel.app)
 * Recipes curated manually for the ancorahub notification context.
 */

import type { Patch } from "./player";

/**
 * Notification sound — clean dual-tone ping, ~419 Hz, ~0.68s.
 * Used when an incoming lead arrives.
 */
export const notificationSound: Patch = {
  layers: [
    // Primary tone — bright sine ping
    {
      type: "sine",
      frequency: { start: 419, end: 398, time: 0.38 },
      gain: 0.55,
      envelope: {
        attack: 0.004,
        hold: 0.02,
        decay: 0.28,
        sustain: 0.08,
        release: 0.22,
      },
      filter: {
        type: "lowpass",
        frequency: { start: 3200, end: 1600, time: 0.4 },
        Q: 0.8,
      },
    },
    // Harmonic layer — adds warmth at an octave up
    {
      type: "sine",
      frequency: { start: 838, end: 796, time: 0.28 },
      gain: 0.22,
      delay: 0.003,
      envelope: {
        attack: 0.006,
        hold: 0,
        decay: 0.18,
        sustain: 0,
        release: 0.12,
      },
    },
    // Subtle noise transient — click attack character
    {
      type: "noise",
      color: "pink",
      gain: 0.06,
      envelope: {
        attack: 0.001,
        hold: 0,
        decay: 0.018,
        sustain: 0,
        release: 0.008,
      },
      filter: {
        type: "bandpass",
        frequency: 2800,
        Q: 2.5,
      },
    },
  ],
};

/**
 * Tap sound — short, crisp UI click, ~0.12s.
 * Suitable for button presses and interaction feedback.
 */
export const tapSound: Patch = {
  layers: [
    {
      type: "sine",
      frequency: { start: 547, end: 420, time: 0.08 },
      gain: 0.4,
      envelope: {
        attack: 0.002,
        hold: 0,
        decay: 0.06,
        sustain: 0,
        release: 0.04,
      },
      filter: {
        type: "lowpass",
        frequency: 3000,
        Q: 0.7,
      },
    },
    {
      type: "noise",
      color: "white",
      gain: 0.08,
      envelope: {
        attack: 0.001,
        hold: 0,
        decay: 0.012,
        sustain: 0,
        release: 0.005,
      },
      filter: {
        type: "highpass",
        frequency: 1800,
        Q: 1.0,
      },
    },
  ],
};

/**
 * Error sound — descending dissonant tone, ~0.43s.
 * Suitable for error toasts or failed operations.
 */
export const errorSound: Patch = {
  layers: [
    {
      type: "sine",
      frequency: { start: 422, end: 290, time: 0.3 },
      gain: 0.5,
      envelope: {
        attack: 0.005,
        hold: 0.01,
        decay: 0.22,
        sustain: 0.05,
        release: 0.14,
      },
      filter: {
        type: "lowpass",
        frequency: 2000,
        Q: 1.2,
      },
    },
    {
      type: "sine",
      frequency: { start: 350, end: 240, time: 0.28 },
      gain: 0.28,
      delay: 0.005,
      envelope: {
        attack: 0.006,
        hold: 0,
        decay: 0.18,
        sustain: 0,
        release: 0.1,
      },
    },
  ],
};

/**
 * Warning sound — ascending cautionary ping, ~0.38s.
 * Suitable for warning toasts or alerts that need attention.
 */
export const warningSound: Patch = {
  layers: [
    {
      type: "sine",
      frequency: { start: 600, end: 709, time: 0.22 },
      gain: 0.48,
      envelope: {
        attack: 0.006,
        hold: 0.02,
        decay: 0.2,
        sustain: 0.06,
        release: 0.12,
      },
      filter: {
        type: "lowpass",
        frequency: 3500,
        Q: 0.9,
      },
    },
    {
      type: "noise",
      color: "pink",
      gain: 0.04,
      envelope: {
        attack: 0.001,
        hold: 0,
        decay: 0.015,
        sustain: 0,
        release: 0.008,
      },
      filter: {
        type: "bandpass",
        frequency: 3200,
        Q: 2.0,
      },
    },
  ],
};

/**
 * Milestone sound — three soft notes going up (sol, si, mi), ~0.55s.
 * Levels 2 and 3 of docs/design-system/FEEDBACK.md: daily goal hit, sale registered, level up.
 * Warmer than the tap and never in a loop.
 */
export const milestoneSound: Patch = {
  layers: [
    {
      type: "sine",
      frequency: 784,
      gain: 0.32,
      envelope: { attack: 0.006, hold: 0.02, decay: 0.16, sustain: 0, release: 0.08 },
      filter: { type: "lowpass", frequency: 3200, Q: 0.7 },
    },
    {
      type: "sine",
      frequency: 988,
      gain: 0.32,
      delay: 0.09,
      envelope: { attack: 0.006, hold: 0.02, decay: 0.18, sustain: 0, release: 0.1 },
      filter: { type: "lowpass", frequency: 3200, Q: 0.7 },
    },
    {
      type: "sine",
      frequency: 1319,
      gain: 0.26,
      delay: 0.18,
      envelope: { attack: 0.008, hold: 0.03, decay: 0.26, sustain: 0.04, release: 0.16 },
      filter: { type: "lowpass", frequency: 3600, Q: 0.7 },
    },
    {
      type: "sine",
      frequency: 2638,
      gain: 0.05,
      delay: 0.18,
      envelope: { attack: 0.01, hold: 0, decay: 0.2, sustain: 0, release: 0.12 },
    },
  ],
};

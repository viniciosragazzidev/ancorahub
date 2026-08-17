/**
 * Procedural sound player — standalone, zero dependencies, ~4 kb.
 *
 * Adapted from the procedural-sounds open-source project (MIT).
 * Source: https://github.com/m1ckc3s/procedural-sounds
 * Original file: lib/audio/export/snippet.ts
 *
 * Usage:
 *   import { playSound } from "@/lib/sounds/player";
 *   import { notificationSound } from "@/lib/sounds/recipes";
 *   playSound(notificationSound);
 */

// ---------------------------------------------------------------------------
// Types (mirrors lib/audio/patch.ts from procedural-sounds)
// ---------------------------------------------------------------------------

export type Waveform = "sine" | "triangle" | "square" | "sawtooth";
export type NoiseColor = "white" | "pink" | "brown";
export type Frequency = number | { start: number; end: number; time?: number };

export interface FM {
  ratio: number;
  depth: number;
}

export interface OscillatorSource {
  type: Waveform;
  frequency: Frequency;
  fm?: FM;
  detune?: number;
}

export interface NoiseSource {
  type: "noise";
  color?: NoiseColor;
}

export type Source = OscillatorSource | NoiseSource;

export interface Envelope {
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  hold?: number;
}

export interface Filter {
  type?: BiquadFilterType;
  frequency?: Frequency;
  Q?: number;
  gain?: number;
}

export interface Reverb {
  decay?: number;
  mix?: number;
  roomSize?: number;
  damping?: number;
  preDelay?: number;
}

export interface Shimmer {
  delay: number;
  feedback: number;
  wet: number;
  lowpass?: number;
}

export interface Layer extends Source {
  gain?: number;
  delay?: number;
  envelope?: Envelope;
  filter?: Filter;
  reverb?: Reverb;
  shimmer?: Shimmer;
}

export interface Patch {
  layers?: Layer[];
  gain?: number;
  delay?: number;
  envelope?: Envelope;
  filter?: Filter;
  reverb?: Reverb;
  shimmer?: Shimmer;
  // single-layer shorthand — same shape as Layer
  type?: Waveform | "noise";
  frequency?: Frequency;
  fm?: FM;
  detune?: number;
  color?: NoiseColor;
}

export interface PlayOptions {
  volume?: number;
  detune?: number;
}

// ---------------------------------------------------------------------------
// Player — literal copy of PLAYER_JS from snippet.ts (procedural-sounds MIT)
// Adapted to TypeScript with explicit types; logic is unchanged.
// ---------------------------------------------------------------------------

// AudioContext singleton shared across calls (browsers require user gesture)
let _ctx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!_ctx) {
    _ctx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return _ctx;
}

export function playSound(patch: Patch, options?: PlayOptions): void {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    const S = 0.0001;
    const t0 = ctx.currentTime;
    const volumeScale = options?.volume ?? 1;
    const globalDetune = options?.detune ?? 0;

    function noiseBuffer(seconds: number, color?: NoiseColor): AudioBuffer {
      const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      if (color === "pink") {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      } else if (color === "brown") {
        let last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      } else {
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      return buf;
    }

    function makeReverb(o: Reverb): { input: GainNode; output: GainNode } {
      const decay = o.decay ?? 0.5;
      const mix = o.mix ?? 0.3;
      const damping = o.damping ?? 0;
      const input = ctx.createGain();
      const output = ctx.createGain();
      const dry = ctx.createGain();
      dry.gain.value = 1 - mix;
      input.connect(dry);
      dry.connect(output);
      const wet = ctx.createGain();
      wet.gain.value = mix;
      input.connect(wet);
      const wetOut = ctx.createGain();
      wetOut.connect(output);
      const len = Math.ceil(ctx.sampleRate * decay * (o.roomSize ?? 1));
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.28));
        }
        if (damping > 0) {
          const c = Math.min(damping, 0.99);
          let prev = 0;
          for (let i = 0; i < len; i++) {
            prev = d[i] * (1 - c) + prev * c;
            d[i] = prev;
          }
        }
      }
      const conv = ctx.createConvolver();
      conv.buffer = buf;
      const pre = o.preDelay ?? 0;
      if (pre > 0) {
        const pd = ctx.createDelay(Math.max(pre + 0.01, 1));
        pd.delayTime.value = pre;
        wet.connect(pd);
        pd.connect(conv);
      } else {
        wet.connect(conv);
      }
      conv.connect(wetOut);
      return { input, output };
    }

    function makeShimmer(o: Shimmer): { input: GainNode; output: GainNode } {
      const input = ctx.createGain();
      const output = ctx.createGain();
      input.connect(output);
      const delay = ctx.createDelay(1);
      delay.delayTime.value = o.delay;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = o.lowpass ?? 4000;
      const fb = ctx.createGain();
      fb.gain.value = o.feedback;
      const wet = ctx.createGain();
      wet.gain.value = o.wet;
      input.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(wet);
      wet.connect(output);
      return { input, output };
    }

    const layers: Layer[] = (patch.layers ?? [patch as Layer]);

    for (const layer of layers) {
      const t = t0 + (layer.delay ?? 0);
      const rawGain = (layer.gain ?? 0.5) * volumeScale;
      const env = layer.envelope ?? {};
      const attack = env.attack ?? 0.005;
      const hold = env.hold ?? 0;
      const decay = env.decay ?? 0.1;
      const sustain = env.sustain ?? 0;
      const release = env.release ?? 0.05;
      const duration = attack + hold + decay + release;

      // Master gain for this layer
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(S, t);
      masterGain.gain.linearRampToValueAtTime(rawGain, t + attack);
      if (hold > 0) masterGain.gain.setValueAtTime(rawGain, t + attack + hold);
      masterGain.gain.linearRampToValueAtTime(rawGain * sustain + S, t + attack + hold + decay);
      masterGain.gain.linearRampToValueAtTime(S, t + duration);

      // Effects chain
      let chainOut: AudioNode = masterGain;

      if (layer.shimmer) {
        const sh = makeShimmer(layer.shimmer);
        chainOut.connect(sh.input);
        chainOut = sh.output;
      }
      if (layer.reverb) {
        const rv = makeReverb(layer.reverb);
        chainOut.connect(rv.input);
        chainOut = rv.output;
      }
      chainOut.connect(ctx.destination);

      // Filter
      let filterNode: BiquadFilterNode | null = null;
      if (layer.filter) {
        filterNode = ctx.createBiquadFilter();
        filterNode.type = layer.filter.type ?? "lowpass";
        filterNode.Q.value = layer.filter.Q ?? 1;
        filterNode.gain.value = layer.filter.gain ?? 0;
        const ff = layer.filter.frequency;
        if (ff !== undefined) {
          if (typeof ff === "number") {
            filterNode.frequency.setValueAtTime(ff, t);
          } else {
            filterNode.frequency.setValueAtTime(ff.start, t);
            filterNode.frequency.linearRampToValueAtTime(ff.end, t + (ff.time ?? duration));
          }
        }
        filterNode.connect(masterGain);
      }

      const connectTarget: AudioNode = filterNode ?? masterGain;

      // Source
      if (layer.type === "noise") {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(duration + 0.1, (layer as NoiseSource).color);
        src.connect(connectTarget);
        src.start(t);
        src.stop(t + duration + 0.1);
      } else {
        const freq = (layer as OscillatorSource).frequency ?? 440;
        const osc = ctx.createOscillator();
        osc.type = (layer.type as OscillatorType) ?? "sine";
        osc.detune.value = ((layer as OscillatorSource).detune ?? 0) + globalDetune;

        if (typeof freq === "number") {
          osc.frequency.setValueAtTime(freq, t);
        } else {
          osc.frequency.setValueAtTime(freq.start, t);
          osc.frequency.linearRampToValueAtTime(freq.end, t + (freq.time ?? duration));
        }

        // FM modulator
        const fm = (layer as OscillatorSource).fm;
        if (fm) {
          const mod = ctx.createOscillator();
          const modGain = ctx.createGain();
          const baseFreq = typeof freq === "number" ? freq : freq.start;
          mod.frequency.value = baseFreq * fm.ratio;
          modGain.gain.value = baseFreq * fm.depth;
          mod.connect(modGain);
          modGain.connect(osc.frequency);
          mod.start(t);
          mod.stop(t + duration);
        }

        osc.connect(connectTarget);
        osc.start(t);
        osc.stop(t + duration);
      }
    }
  } catch {
    // Browsers may block AudioContext without a user gesture; fail silently
  }
}

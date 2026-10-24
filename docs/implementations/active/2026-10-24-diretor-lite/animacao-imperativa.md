# Animação imperativa em src (requestAnimationFrame e animate())

Lista gerada em 2026-10-24 com `grep -rl` sobre `src` (.ts e .tsx), para a revisão de movimento reduzido da F1b item 4. Cada linha mostra a primeira ocorrência encontrada no arquivo. Não é a lista de revisão: ela só diz onde há JS imperativo.

Total: 29 arquivos (14 com requestAnimationFrame, 17 com animate(), 2 com os dois).

## Arquivos

- `src/app/(dashboard)/atendimento/mensagens/_components/message-drawer.tsx` (requestAnimationFrame, linha 116): `requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + token.length, start + token.length); });`
- `src/app/(dashboard)/atendimento/situacoes/_components/situation-drawer.tsx` (requestAnimationFrame, linha 80): `requestAnimationFrame(() => { element?.focus(); element?.setSelectionRange(start + token.length, start + token.length); });`
- `src/components/app-shell.tsx` (requestAnimationFrame, linha 123): `const frame = window.requestAnimationFrame(() => {`
- `src/components/arc/action-button/action-button.tsx` (animate(), linha 56): `animate(width, next, { ...motionTokens.spring.morph, onComplete: () => { delete slot.dataset.morphing; } });`
- `src/components/arc/animated-counter/animated-counter.tsx` (animate(), linha 58): `else animate(position, state.target, state.revealed ? motionTokens.spring.smooth : { ...reveal, delay });`
- `src/components/arc/badge/badge.tsx` (animate(), linha 64): `controls = animate(width, [from, next], { ...motionTokens.spring.morph, onComplete: settle });`
- `src/components/arc/bottom-sheet/bottom-sheet.tsx` (animate(), linha 148): `animate(y, target, { ...(stop === "closed" ? leave : settle), ...(velocity === undefined ? {} : { velocity }), onComplete: done });`
- `src/components/arc/button/button.tsx` (animate(), linha 67): `animate(width, next, { ...motionTokens.spring.morph, onComplete: () => { delete slot.dataset.morphing; } });`
- `src/components/arc/calendar/calendar.tsx` (animate(), linha 84): `const controls = [animate(opacity, 0, fade), animate(scale, 0.6, fade)];`
- `src/components/arc/chip-group/chip-group.tsx` (animate() + requestAnimationFrame, linha 93): `const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => { if (animating.current) return; height.jump("auto"); if (frame.curren`
- `src/components/arc/empty-state/empty-state.tsx` (animate(), linha 62): `controls = animate(height, [from, next], { ...motionTokens.spring.smooth, onComplete: settle });`
- `src/components/arc/expandable-card/expandable-card.tsx` (animate(), linha 87): `const controls = animate(boxWidthValue, boxWidth, widthTransition);`
- `src/components/arc/file-dropzone/file-dropzone.tsx` (animate() + requestAnimationFrame, linha 267): `const follow = () => { fit(); frame = requestAnimationFrame(follow); };`
- `src/components/arc/metric-card/metric-card.tsx` (animate(), linha 30): `if (next && measured !== null && measured !== node.textContent && !reduceMotion) animate(width, next, motionTokens.spring.morph);`
- `src/components/arc/radio-cards/radio-cards.tsx` (animate(), linha 86): `if (!placed.current && !reduced && spring) { o.jump(0); animate(o, 1, { duration: motionTokens.duration.fast, ease: standard }); } else o.jump(1);`
- `src/components/arc/skeleton/skeleton.tsx` (animate(), linha 42): `controls = animate(height, [from, next], { ...motionTokens.spring.smooth, onComplete: settle });`
- `src/components/arc/slider/slider.tsx` (animate(), linha 110): `else animate(position, state.target, thumbSpring);`
- `src/components/arc/stepper/stepper.tsx` (animate(), linha 72): `animate(height, next, motionTokens.spring.smooth);`
- `src/components/arc/switch/switch.tsx` (animate(), linha 41): `const controls = animate(scaleX, [1, 1.16, 1], { duration: 0.34, times: [0, 0.4, 1], ease: ["easeOut", "easeInOut"] });`
- `src/components/chat/live-blocks.tsx` (requestAnimationFrame, linha 38): `if (t < 1) frame = requestAnimationFrame(tick);`
- `src/components/chat/tour/lite-tour.qa.test.tsx` (requestAnimationFrame, linha 36): `vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));`
- `src/components/chat/tour/lite-tour.tsx` (requestAnimationFrame, linha 219): `frame = stable < 30 ? window.requestAnimationFrame(tick) : 0;`
- `src/components/global-search.tsx` (requestAnimationFrame, linha 68): `window.requestAnimationFrame(() => inputRef.current?.focus());`
- `src/components/lite/motion/number.tsx` (animate(), linha 53): `const controls = animate(current.current, value, {`
- `src/components/motion/count-up.tsx` (requestAnimationFrame, linha 33): `if (progress < 1) frame = requestAnimationFrame(tick);`
- `src/components/pwa-install-prompt.tsx` (requestAnimationFrame, linha 20): `const frame = window.requestAnimationFrame(() => setIsIOS(ios));`
- `src/components/splash-screen.tsx` (requestAnimationFrame, linha 34): `const show = requestAnimationFrame(() => {`
- `src/components/ui/faceted.tsx` (requestAnimationFrame, linha 98): `requestAnimationFrame(() => onOpenChange(false));`
- `src/features/journey/components/celebration-layer.tsx` (requestAnimationFrame, linha 75): `if (t < 1) frame = requestAnimationFrame(step);`

# Directed-aggressive Oreo palette mode

Use `palette_mode: directed-aggressive` only when the user explicitly requests aggressive, expressive, layered, or controlled comparison-oriented preset color. Keep `palette_mode: native` as the default for all unspecified work. A request that merely names an Oreo preset uses `directed`, not this mode.

## Structural invariants

Treat color as the only editable layer. Lock:

- silhouette and occupied voxel cells;
- block count, dimensions, seams, and component positions;
- camera, projection, scale, crop, framing, and suspension;
- opaque acrylic body, crisp planar faces, and exact `#F4F4F4` background;
- subject identity and all recognition-critical geometry.

Reject any palette variant that changes structure.

## Palette behavior

Choose one complete Oreo preset for each variant. In normal production, search all 40 presets in `oreo-palette-library.md` using the object's native color signature and the role-allocation process in `palette-standard.md`. Use a fixed preset regardless of native color only when the user explicitly names one or requests a controlled palette comparison. Do not mix tokens from different presets.

Map tokens as follows:

- largest mass: discrete voxel layers using `lobe`, `base`, and optionally `cool`;
- focal component: `accent`;
- illuminated component: `warm` or `beam`;
- quiet plane or separator: `pale` or `light`;
- recess, joint, or deepest side: `dark`.

Keep relative-gamut chroma at `Cr 0.92–1.00`. Preserve the preset's original hue relationships. A whole-preset tone shift is allowed, but per-token hue replacement is not.

## Discrete layer color grammar

This mode may relax the default one-family-per-shape rule, but never the one-color-per-plane rule. A coherent mass may use at most three chromatic tokens from the same preset when those tokens are assigned to distinct voxel layers or stepped blocks.

- Every continuous visible plane uses one spatially uniform token-derived color.
- Change color only at a real voxel layer, block boundary, step, seam, or separate component.
- Adjacent coplanar blocks that visually merge into one uninterrupted plane must share one color.
- Use two layer colors by default and three only when the structure has enough distinct tiers.
- Give each color band meaningful visual area; avoid one-cube color noise.
- Order layer colors along the object's construction, normally top-to-bottom, outside-to-inside, or front-to-back.
- Preserve face-direction lighting within each token: uniform brighter top, uniform middle front, and uniform darker side.
- Preserve `Cr` by resolving each layer token back into the sRGB gamut at its own `L` and `h`.
- A perceptual ramp is allowed only as discrete color steps across multiple layers. Never paint a continuous gradient, luminous center, or hotspot on a face.

## Surface and light

Keep the material fully opaque polished acrylic. Layer colors are solid cast-in body colors, not transparency, subsurface scattering, glass, or colored light projected onto the background.

Retain a restrained whole-face reflection. It may lift an entire source-facing plane uniformly but must not create a spatial gradient, edge outline, rim light, narrow streak, or white hotspot.

## Contrast

- Ensure the main mass contains at least one region with `L ≤ 0.72` or a dark anchor component, so a pastel preset does not wash into the background.
- Keep at least `0.18` OKLCH lightness difference between recognition-critical adjacent components.
- Use `dark` for recesses and separation when two bright layer regions meet.
- Permit white only as a deliberate preset `light` role, not as an automatic replacement for color.
- In this mode, black-white usage is optional unless it is structurally necessary.

## Comparison variants

When comparing palettes, apply every candidate to the same edit target. Use identical geometry, camera, material, lighting, background, scale, and layer-to-token mapping. Change only the selected preset.

The earlier B and D results are useful allocation references:

- B demonstrated clear separation between large layers, quiet pale layers, a warm focal component, and a dark structural anchor.
- D demonstrated the same role hierarchy with a different hue relationship.

Retain that role hierarchy while allowing any of the 40 presets to supply the actual colors. The following fixed candidates remain useful only for controlled comparisons:

- Aurora Pink: cyan/periwinkle carrier, pink lobe, hot-pink accent, deep violet anchor;
- Cyan Flame: pale cyan, bright cyan, orange accent, deep blue anchor;
- Orchid Night: violet base, magenta lobe, pink accent, near-black violet anchor;
- Lime Sorbet: pale lime, bright lime, teal accent, cyan companion, forest anchor;
- Sunset Punch: peach base, coral lobe, hot-pink accent, gold warm, periwinkle cool, plum anchor.

## Quality gate

Accept only when:

- all variants remain structurally interchangeable;
- one named preset clearly governs the complete variant;
- every continuous plane is one spatially uniform color;
- color transitions occur only across real layers, steps, seams, or separate components;
- discrete layer transitions remain saturated and in gamut;
- deep sides and recesses preserve enough contrast;
- material remains opaque and polished;
- background stays exact `#F4F4F4` and unaffected by colored light;
- no face contains a continuous gradient, transparency, blur, bloom, edge glow, or a new shape.

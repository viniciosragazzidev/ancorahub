# Voxel palette modes

## Source behavior

Use the source object or emoji's complete recognizable native colors by default. The source is the palette authority: native mode has no fixed hue whitelist, reduced preferred subset, batch palette, or red-yellow-blue fallback. Oreo-derived preset matching is an opt-in directed mode, not the production default.

In directed modes, use the complete 40-preset snapshot bundled in `oreo-palette-library.md`; never fetch or inspect an external repository at runtime. The locally bundled method transforms one complete preset in OKLCH, preserving each token's lightness hierarchy and hue relationship while scaling chroma relative to the available sRGB gamut. Do not transfer avatar gradients or shapes.

Voxel faces remain flat in every mode. Do not copy soft gradients, glow, blur, or circular composition from the avatar system.

## Mode routing

Use exactly one recorded mode:

| Mode | Trigger | Color source |
| --- | --- | --- |
| `native` | Default; no explicit palette direction | The subject or emoji's own recognizable colors |
| `directed` | User asks for Oreo, directed matching, palette matching, or names a preset | One complete preset from the 40-preset registry |
| `directed-aggressive` | User explicitly asks for aggressive, expressive, layered, or controlled comparison variants | One complete preset with discrete layer allocation |

Never silently upgrade `native` to a directed mode. A named preset selects `directed` unless the user also explicitly asks for aggressive layer coloring.

## Native mode

1. Extract the source's complete recognizable component-color relationships, including dominant, companions, accents, material colors, black, and white.
2. Map those native colors directly onto the components that carry them. Do not search the Oreo registry and do not name a preset.
3. Preserve warm/cool relationships, structural hierarchy, and functional black-white roles.
4. Use OKLCH only to correct gamut, saturation, and face-derived lightness. Do not use it to replace the source hue identity.
5. Keep one dominant chromatic family per coherent shape. This limit is per shape, not per icon: every genuinely separate component may retain its own source-native family, with no cap on the icon's total number of authentic families.
6. Keep each continuous plane spatially uniform. Derive top, front, and side values from the same native family.

Default native tone behavior:

- preserve each mapped native hue within approximately `±3°`;
- preserve face lightness unless a directional face derivation is required;
- when colors are muted, hold `L` and `h` and increase `C` by about `25–40%` within gamut;
- leave functional black and white unchanged.

Write this plan:

```text
palette_mode: native
native_signature:
  dominant: [native hue and semantic component]
  companion: [native hue and relationship, semantic component]
  accent: [native hue, semantic component] or none
  neutrals: [functional black/white regions]
mapping:
  [component or layer]: [native family or functional neutral]
tone:
  saturation_correction: [none or bounded OKLCH correction]
```

## Directed mode

Use this model only when `palette_mode: directed` or `directed-aggressive`:

1. Extract the subject's native color signature before choosing a preset.
2. Define a structure-to-role allocation using the discrete B/D-style logic: large layers, quiet layers, focal components, companions, and structural anchors.
3. Search all 40 named presets in `oreo-palette-library.md` for the relationship that best fits that signature and allocation.
4. Map subject roles to the selected preset tokens; do not pick independent swatches.
5. Preserve the subject's recognizable color identity. For emoji-derived objects, the emoji remains the semantic source of truth.
6. Keep one dominant chromatic relationship per coherent shape. Use up to three tokens from the same complete preset only on genuinely separate components or distinct structural layers.
7. Allow functional near-black and light neutral to override a colorful token when they carry structure, cutouts, text-like marks, carriers, or open surfaces more clearly.
8. Apply tone controls to the entire preset, never one token in isolation.

The authoritative local registry is `oreo-palette-library.md`. Search all 40 presets for every directed production object; the short examples in other prompt files are not a whitelist.

## Directed preset matching

Do not use one preset as the default for a whole batch of unrelated objects. Select independently from the complete 40-preset registry for each subject.

Before prompting, record a compact native color signature:

- dominant recognizable color and semantic component;
- secondary or companion color and its warm/cool relationship to the dominant;
- small focal accent, if it is semantically important;
- functional black, white, or neutral regions;
- which colors belong to genuinely separate physical components.

First define the allocation independently of hue:

- `base`, `lobe`, and optionally `cool` create the large discrete layer hierarchy;
- `pale` or `light` creates quiet layers and separators;
- `accent`, `warm`, or `beam` colors a small distinct focal component;
- `dark` or functional near-black anchors recesses and structural marks.

This is the useful behavior demonstrated by the B and D comparisons. B and D are allocation references, not default blue or green palettes.

Compare the resulting signature and role allocation against all 40 presets. Weight the match in this order:

1. dominant hue family and structural role;
2. availability of the required companion hue;
3. warm/cool polarity between dominant and companion;
4. availability of a suitable accent;
5. lightness hierarchy and a usable structural dark.

Ignore functional black and white when measuring chromatic hue distance; preserve them as functional neutrals after selection. Prefer a preset that covers the complete native relationship over one that merely contains the closest dominant swatch.

If no preset is sufficiently close, choose the nearest relationship and rotate the whole preset so its mapped body token aligns with the native dominant hue. Compute the delta from the actual mapped body token, then express it through the source library's absolute `tone.hue` control as documented in `oreo-palette-library.md`. Preserve every token's relative hue spacing, lightness order, and role. Never repair a weak match by replacing individual tokens from another preset.

Fixed-preset application is allowed only when the user explicitly names a preset or requests a controlled palette comparison.

## Directed color plan

Write this compact plan for `directed` and `directed-aggressive`:

```text
palette_mode: directed
native_signature:
  dominant: [hue family and semantic component]
  companion: [hue family, warm/cool relationship, semantic component]
  accent: [hue family, semantic component] or none
  neutrals: [functional black/white regions]
allocation:
  large_layers: [structural layers -> base/lobe/cool]
  quiet_layers: [structural layers -> pale/light]
  focal: [component -> accent/warm/beam]
  anchor: [recesses/marks -> dark or functional near-black]
palette:
  preset: [one of the complete 40 preset IDs]
  rationale: [why its complete token relationship fits]
  tone: { hue: [absolute accent hue], chroma: [0–1], lightness: [delta] }
```

Use `palette_mode: directed-aggressive` in the plan when the aggressive layer grammar is active. The plan separates allocation logic from actual hue choice. Reuse the allocation behavior learned from B/D where appropriate, but resolve `preset` and `tone` independently for each object.

## Voxel role mapping

| Voxel role | Oreo token source | Typical use |
| --- | --- | --- |
| carrier | `light`, `pale`, or `base` | White panels, cloth, wings, open faces, calm large surfaces |
| body | `lobe` or `accent` | Largest recognizable colored mass |
| focal accent | `accent` | Small high-salience semantic component |
| warm companion | `warm` | Fire, wood, food, gold, or warm secondary component |
| cool companion | `cool` | Water, glass-colored but opaque equipment, blue secondary component |
| structural dark | `dark` or functional near-black | Belts, shafts, cutouts, outlines built from blocks, pupils, tool tips |
| surface lift | `base`, `pale`, or a face-derived value | Whole-face light response; never a stripe or edge glint |

The largest mass normally uses `body` or `carrier`. Do not make a tiny accent the visual dominant merely because its token is named `accent`.

## Relative-gamut OKLCH

For a color `oklch(L C h)`, define:

```text
Cr = C / Cmax_sRGB(L, h)
C = Cr × Cmax_sRGB(L, h)
```

`Cmax_sRGB(L,h)` is the maximum in-gamut OKLCH chroma at the same lightness and hue. This keeps visual saturation comparable across red, yellow, green, blue, and purple, where the same absolute `C` does not look equally vivid.

Use these tone controls:

- `hue`: shift every chromatic token by the same angular delta from the preset accent hue;
- `chroma`: multiply every chromatic token's `Cr` by one shared scale from `0` to `1`;
- `lightness`: add one shared OKLCH `L` delta to every token;
- gamut mapping: reduce only `C` until in gamut; preserve `L` and `h`.

Default voxel tone:

- chroma scale `0.90–1.00`, default `0.96`;
- lightness shift `-0.02–0.04`, default `0`;
- preserve preset hue unless the requested subject requires a semantic hue shift.

Do not use per-token saturation correction unless repairing a clear generation error.

## Face derivation

Derive every face from the assigned preset token in `L`, `Cr`, and `h`:

- front face: token `L`, `Cr`, `h`;
- top face: `L + 0.04–0.07`, `Cr × 0.95–1.00`, same hue;
- side face: `L - 0.10–0.16`, `Cr × 0.95–1.00`, same hue;
- deep internal face, only when necessary: `L - 0.18–0.22`, `Cr × 0.92–1.00`;
- hue drift: at most `±3°`.

Resolve `C` again from the resulting face `L`, `Cr`, and `h`. Never reuse one absolute `C` across all face lightness values.

The source-facing plane may receive one broad `L + 0.02–0.04` surface lift across most or all of the face. Do not add gradients, white edges, rim light, or narrow reflection bands.

Each continuous visible plane must remain one spatially uniform color. Palette variation may occur only at a real voxel layer, block boundary, step, seam, or separate component. A color ramp may be represented as discrete layer-to-layer token changes, but never as a continuous gradient painted across one face.

## Functional black and white

- Use near-black around `oklch(0.20–0.32 0.01–0.03 h)` for structural information.
- Use light neutral around `oklch(0.94–0.98 0–0.015 h)` for carriers and open surfaces.
- Keep black and white neutral during hue shifts.
- Do not replace a recognition-critical black belt, pupil, cutout, shaft, or outline with a decorative preset hue.
- Do not add black or white as confetti; every neutral region must clarify recognition, separation, or massing.

## Complete directed preset registry

Use all 40 presets in `oreo-palette-library.md`. The registry contains the exact nine source tokens for:

- warm, red, coral, orange, peach, amber, and gold relationships;
- green, mint, jade, lime, forest, teal, lagoon, and seafoam relationships;
- blue, sky, cyan, ice, opal, periwinkle, violet, lilac, orchid, and void relationships;
- rose, berry, raspberry, candy, cotton, plum, cherry, and mixed warm-cool relationships;
- restrained pearl, cream, milk, vanilla, and near-neutral relationships.

Do not maintain a smaller preferred subset. Examples may name a preset for reproducibility, but directed production selection always searches the complete registry unless the user fixes one preset.

## Directed selection heuristics

- Build the native color signature and role allocation first, then search all 40 presets for that individual subject.
- Choose by the complete dominant-companion-accent relationship, not dominant hue alone.
- Prefer presets that already contain the required companion hue instead of mixing presets.
- For mostly white or black objects, use Moon Pearl only for restrained cool face separation and retain functional neutral structure.
- If no preset preserves the subject identity, coherently hue-shift the closest preset; do not replace individual tokens.
- If a third chromatic family is not a separate semantic component, replace it with black, white, or a value-derived face of an existing token.

## Quality gate

Accept every mode only when:

- `palette_mode` is recorded and matches the request;
- an unspecified request remains `native`;
- every continuous plane is spatially uniform;
- palette changes occur only across real voxel layers, steps, seams, or separate components;
- top and side faces preserve saturation and do not become gray;
- black and white remain functional;
- the accent stays subordinate to the main body unless the subject requires otherwise;
- color work does not change voxel occupancy, silhouette, component positions, camera, scale, framing, material, or `#F4F4F4` background.

Additionally accept `native` only when:

- the source's complete component-color relationships remain recognizable, including colors outside red, yellow, and blue;
- no Oreo preset is named or substituted;
- no fixed hue shortlist, calibration-subject palette, previous-batch palette, or batch-wide convergence replaces the source colors;
- chroma correction preserves native hue and lightness intent;
- each coherent shape stays within its native dominant family except for genuinely separate source-colored components.

Additionally accept `directed` or `directed-aggressive` only when:

- one named preset can be identified as the palette source;
- the selected preset comes from the complete 40-preset registry, not a fixed B/D default or reduced shortlist;
- the preset was selected from the individual subject's native color signature unless the user explicitly fixed the preset;
- all chromatic components map to roles within that preset or one coherent whole-preset hue shift;
- every coherent shape uses one dominant chromatic relationship, with at most three same-preset tokens confined to distinct structural layers or components;
- top and side faces preserve `Cr`;
- `directed-aggressive` follows the additional layer limits in `palette-standard-aggressive.md`.

---
name: voxel-icon
description: Generate clean, playful low-density isometric voxel icon illustrations and explicitly requested four-frame physically credible loops built from large opaque face-lit acrylic blocks on an exact #F4F4F4 background. Preserve the subject's native palette by default, with optional explicitly selected Oreo preset-directed modes. Use for voxel art, macro-voxel 3D icons, isometric block-built objects, animated voxel icon loops or GIFs, blocky editorial symbols, emoji-to-voxel objects, or a visually consistent series. Prefer this skill for isolated objects rather than dense cube grids, Minecraft scenes, smooth low-poly renders, glossy edge-lit toys, transparent glass objects, or 2D pixel art.
---

# Voxel Icon

Create a new bitmap illustration from the user's topic. Preserve the construction, camera, lighting, and graphic economy calibrated by the bundled internally generated references; do not infer their literal subjects.

## Required reading

Always read `references/style-spec.md` and `references/palette-standard.md`. Read `references/oreo-palette-library.md` only for `directed` or `directed-aggressive` palette mode. Read `references/palette-standard-aggressive.md` only for `directed-aggressive`. Read `references/loop-animation.md` only when the user explicitly requests a loop, animation, GIF, animated WebP, or four-frame motion. Load the internally generated `assets/reference-sheet.png` for camera, face lighting, and graphic color behavior. Load the internally generated `assets/macro-block-reference.png` for block density, large cuboid construction, and seam economy. Do not infer a bundled subject unless the user requests it.

## Configuration

Record the palette mode before generating:

```yaml
palette_mode: native
palette_preset: null
output_mode: still
```

- `native` is the hard default. Preserve the source object or emoji's full recognizable dominant, companion, accent, black, white, and material-color relationships. Native has no fixed hue whitelist and must not collapse subjects into a recurring red-yellow-blue set. Do not map native colors to an Oreo preset or to the calibration sheet's colors.
- `directed` is opt-in. Enable it only when the user asks for directed or Oreo-derived color, requests palette matching, or names a preset. Search the complete registry unless `palette_preset` is explicitly fixed.
- `directed-aggressive` is opt-in. Enable it only when the user explicitly asks for aggressive, expressive, layered, or comparison-oriented preset application.
- A named Oreo preset implies `directed`, not `directed-aggressive`.
- Never infer a directed mode merely because a matching preset exists. An unspecified request always remains `native`.
- `still` is the output default. Use `loop` only when the user explicitly requests motion, and follow `references/loop-animation.md`.

## Workflow

1. Extract the subject, intended use, aspect ratio, any exact text, whether the output belongs to a series, and the explicit palette mode if supplied. Default to one square RGB PNG with no text, `palette_mode: native`, and an exact `#F4F4F4` final background.
2. Treat supplied images as user inputs and the self-contained bundled sheet as a calibration reference, not an edit target, unless the user explicitly requests an edit.
3. Reduce an abstract topic to one compact, recognizable object or relationship. Keep only two or three identity cues.
4. Convert the subject onto one coarse base-module grid. Build it from a small number of large rectangular voxel blocks whose dimensions are integer multiples of that module. Merge adjacent cells into clean cuboids and suppress their internal seams. Use stepped silhouettes rather than smooth geometry. For a series, lock one projected base-module size and one camera zoom; simplify complex subjects instead of densifying the grid.
5. Write the mode-specific color plan from `references/palette-standard.md`. In `native`, map the extracted native signature directly onto components. In `directed`, add B/D-style structural allocation, one selected complete preset, whole-preset tone adjustment, and token mapping. In `directed-aggressive`, also apply the discrete layer rules.
6. Build a structured prompt using the contract below, then call the built-in image generation tool with the smallest useful reference set. After the first asset in a series is approved, include one approved same-series output as a material, base-module, and camera calibration reference for later assets; do not copy its subject.
7. Inspect the result at full size and thumbnail size. Reject smooth meshes, rounded blocks, dense tiled surfaces, 2D pixel art, busy scenery, inconsistent perspective, weak subject recognition, or colors that do not match the recorded palette mode and color plan.
8. Classify iteration feedback before editing. If the feedback concerns only color, shadow, material, or background, use the current output as the edit target and explicitly lock silhouette, voxel topology, component count, component positions, camera, scale, and framing. Do not redesign the object during a palette correction.
9. Iterate with one targeted correction. Keep the approved object unchanged while correcting color, shadow, material, or background.
10. Run `scripts/normalize-gray-background.py INPUT.png OUTPUT.png` on the accepted render. This replaces near-gray model drift with the exact `#F4F4F4` final field without rerendering the subject.
11. Verify that the final is an opaque RGB PNG, every clean background region measures `#F4F4F4`, and subject geometry, pixels, scale, framing, and edge quality remain unchanged.
12. For `output_mode: loop`, first identify the real object and write its physical motion model, rigid groups, articulated parts, fixed connections, and forward/back states as required by `references/loop-animation.md`. Generate two complete pose images from the accepted still. Name at least two visibly changing semantic regions; they may move independently or change together as consequences of one credible rigid or articulated motion. Never invent a joint, detach a fixed component, or substitute a 2D whole-frame transform for a newly generated 3D pose. Assemble the complete generated frames directly without masks, local compositing, inpainting, background normalization, color matching, or rigid post-transforms.

For `directed-aggressive`, preserve every structural invariant and use `references/palette-standard-aggressive.md`. Never enable it implicitly.

## Background normalization

Use one neutral backdrop for every working render and final asset. The model-facing prompt and final image both use a perfectly flat `#F4F4F4` field. Treat any other measured corner value, tint, gradient, vignette, alpha channel, or per-image gray drift as a defect.

Normalize the accepted render deterministically:

```bash
python scripts/normalize-gray-background.py INPUT.png OUTPUT.png
```

The script samples the flat outer border, isolates only border-connected background, preserves enclosed white regions, and composites the unchanged subject onto exact `#F4F4F4`. It outputs one opaque RGB PNG. If it refuses a non-uniform border or an edge-touching subject, correct the render instead of increasing tolerance until content disappears.

## Concept reduction

- For a concrete object, preserve its silhouette, one color signature, and one defining feature.
- For an abstract topic, choose a familiar physical metaphor before adding detail.
- Prefer one object. Allow a small paired relationship only when it carries the concept, such as pencil plus ruler for design or bars plus arrow for markets.
- Avoid text as a substitute for recognition. Add lettering only when the user supplies exact text.
- Do not invent eyes, faces, symbols, accent tiles, or internal marks that the user did not request.
- Keep appendages at least one base module thick and readable at thumbnail size.
- Assign the dominant role to the primary recognizable component. Choose companion, accent, black, and white roles by semantics rather than measured pixel area.
- Define color units before prompting. A shape is one contiguous physical mass or one coherent attached object; its top, front, side, markings, and internal regions still belong to that same shape.
- Extract the individual source emoji or real object's complete recognizable color signature before assigning colors, including every semantically distinct component color and functional black or white.
- In `native`, keep those source relationships directly. Brown, orange, green, teal, purple, pink, cyan, metallic gray, cream, and any other source hue remain valid. Use semantic OKLCH correction only to keep each native hue saturated and its face-derived values coherent; never replace it with a smaller preferred palette.
- In `directed`, use the B/D-style allocation logic without inheriting B or D's hues, search all 40 Oreo presets, and map the selected complete preset onto genuine components.
- In `directed-aggressive`, allow up to three same-preset tokens on distinct real layers or stepped blocks; never place multiple colors on one continuous plane.
- Apply any directed tone change to the whole preset. Shift hue coherently and scale relative sRGB chroma `Cr`, not absolute OKLCH `C`.
- Keep one dominant chromatic relationship per coherent shape in every mode. This is a per-shape coherence rule, not a limit on the icon's total hue range. Black, white, and value-derived faces may support it.
- Genuinely separate source-colored components may each retain their own native chromatic family whenever that relationship belongs to the original emoji or real object. Do not impose a batch-wide palette, a one-or-two-family icon cap, or colors borrowed from previously generated subjects.
- Before adding any supporting color, ask whether near-black or light neutral can carry its job more clearly. Use black for structure and recognition; use white for carriers, cutouts, wings, faces, and open surfaces.

## Prompt contract

Use this compact structure and replace bracketed text:

```text
Use case: stylized-concept
Asset type: isolated isometric voxel icon
Primary request: Build [topic] as [single object or compact relationship].
Input image: internally generated bundled reference sheet used only for voxel construction, camera, material, lighting, and visual density; do not infer its subjects or copy its composition.
Scene/backdrop: perfectly flat neutral light-gray #F4F4F4 background with generous empty space; uniform edge to edge, no warm tint, gradient, vignette, environment, horizon, or floor.
Output handling: the final canvas remains opaque RGB with exact #F4F4F4 in every clean background region; no transparency or alpha background.
Palette mode: [native | directed | directed-aggressive]. Default to native when the user does not explicitly select another mode.
Subject: one compact focal object assembled from a small number of large rectilinear blocks aligned to one coarse base module; retain [two or three identity cues].
Construction: low-density macro-voxel geometry on one coarse base-module grid. Use about 12–30 visible rectangular blocks, normally no more than 40. Make every block dimension an integer multiple of the base module. Prefer large 2×1×1, 2×2×1, or larger cuboids for body masses and hide internal coplanar seams; no smooth base mesh.
Series voxel scale: keep the projected base module at about 5–7% of the canvas short side; on a 1254×1254 image target roughly 63–88 px. Build the dominant span from about 7–12 base modules, with a hard range of 6–14. Reuse the same base module and camera zoom across the series; never introduce a finer grid for small details. Simplify or merge the subject rather than adding blocks.
Camera: orthographic three-quarter isometric view, slightly elevated, showing top, front, and one side consistently.
Composition/framing: [aspect ratio], centered suspended object occupying roughly 55–72% of the frame; preserve clear empty background beneath it.
Lighting/mood: even high-key illumination expressed as whole-face value steps plus a restrained broad area-light reflection: every top face is uniformly brighter across its full area, every front face uses one uniform middle tone, and every side face uses one uniform darker tone. The source-facing plane may catch a clean mirror-like lift across most or all of the plane, never only along its edges. Keep external shadows extremely faint and diffuse, with no readable grounding patch or colored spill.
Color system: first extract this subject's complete source-native color signature, including all semantically distinct component colors plus functional black and white. In native mode, use those colors directly without a fixed hue whitelist, batch-wide palette, or convergence toward red-yellow-blue; correct only each source hue's OKLCH saturation and face values. The one-main-color rule applies separately to each coherent shape and does not limit the whole icon's color range. In directed mode, search all 40 complete Oreo presets and map one selected relationship onto the subject's roles. In directed-aggressive mode, use that same preset with discrete layer allocation. In every mode, keep each continuous visible plane spatially uniform, preserve functional black and white, and change color only at a real layer, step, seam, or separate component.
Materials/textures: solid opaque cast-acrylic blocks with fully covering saturated body color and a restrained polished surface. Give each visible plane one clean, nearly uniform tone; the source-facing whole plane carries the broad specular highlight and mild mirror-like sheen. Keep planar faces crisp and necessary seams subtle. No background, rear edge, or neighboring block is visible through a block. No edge highlight, rim light, bright outline, point hotspot, narrow reflection stripe, strong gradient within a face, transmission, refraction, internal overlap, grain, mottling, texture map, bevel, glass, waxy plastic, or chrome-like reflection.
Text (verbatim): "[exact text]" or none.
Constraints: preserve the shared coarse base module, integer-multiple block dimensions, coherent isometric axes, simple silhouette, and thumbnail readability.
Avoid: silently switching native mode to a named preset, unnecessary second or third chromatic families when black or white can carry the role, decorative rainbow palettes, inconsistent base-module scale across a series, refining the grid to fit detail, obvious cast shadow, contact shadow, grounding patch, reflected light spill, floor plane, pedestal, gray-background drift, transparent canvas, warm background, cream tint, gradient, vignette, 2D pixel art, Minecraft environment, toy-brick studs, rounded voxels, smooth mesh, low-poly triangles, outlines, transparent or translucent object material, glass, internal transmission, edge highlights, rim highlights, white block outlines, point highlights, narrow reflection streaks, cloudy frosted resin, waxy toy plastic, chrome or metallic reflections, surface texture, scenery, dense detail, logo, watermark.
```

## Quality gate

Accept only when all are true:

- Every visible form reads as a small assembly of large rectilinear voxel blocks aligned to one coarse base-module grid.
- Every block dimension is an integer multiple of the shared base module; no local micro-voxel grid is allowed.
- Large masses use merged cuboids with internal coplanar seams hidden. The result does not read as a tiled cube surface.
- In a series, projected base-module size stays within roughly ±10% of the locked scale and camera zoom remains consistent.
- The dominant span normally uses 7–12 base modules and never escapes the 6–14 hard range.
- The subject normally uses 12–30 visible blocks and does not exceed 40 without explicit user approval.
- The same three isometric axes govern the whole subject.
- The silhouette is stepped, compact, and recognizable without text.
- Every internal mark supports a requested identity cue; no accidental face-like accents appear.
- Top, front, and side faces have consistent hue-preserving value steps; any specular lift is broad, restrained, and covers most or all of one source-facing plane.
- Blocks read as opaque polished cast acrylic: the body completely blocks the background and rear geometry, while a restrained whole-face area-light reflection provides the clear mirror-like surface finish without edge shine.
- The recorded `palette_mode` matches the request; an unspecified request resolves to `native`.
- In `native`, the source emoji or real object's complete recognizable component-color relationships remain direct color sources; no named preset, fixed hue shortlist, calibration-subject palette, or batch palette replaces them.
- In `directed`, one named complete preset governs the chromatic components and was selected from the full 40-preset registry unless the user fixed it.
- In `directed-aggressive`, at most three same-preset tokens appear only on distinct real voxel layers, steps, seams, or separate components.
- Every coherent shape has one dominant chromatic relationship and every continuous plane has one spatially uniform color; functional black and white may support it.
- Every continuous plane is spatially uniform; palette changes occur only at real voxel layers, steps, seams, or separate components.
- Multiple colored regions on one shape must follow the selected mode and occupy distinct structural layers; otherwise keep the dominant family or replace them with functional black or white. Semantic themes such as design, palettes, charts, or rainbows do not override this limit.
- Black carries structural or recognition information; white carries open or carrier surfaces. Neither appears as arbitrary decoration.
- Derived face shades keep hue within about 3° of their base and do not count as additional palette families.
- Chromatic faces preserve the native family's saturation in `native`, or stay within roughly 92–105% of their preset token's relative sRGB chroma `Cr` in directed modes; side faces must not become gray or muddy.
- The primary recognizable component carries the dominant family unless recognition requires a deliberate exception.
- Do not calculate or gate generation on subject-area, background-area, or palette-area percentages.
- The final RGB PNG uses exact `#F4F4F4` in every clean background region with no warm cast, vignette, per-image gray drift, or alpha channel.
- The object is visibly suspended with clean empty background beneath it; any external shadow is extremely faint and diffuse, never a readable contact or grounding shadow.
- When pixel inspection is practical, compare clean corner patches with a clean patch below the object: keep their mean RGB values within 3 levels per channel and keep the background red-blue difference within 3 levels.
- The composition remains legible as a small icon.
- In a palette-only revision, the silhouette, occupied voxel cells, component relationships, camera, and framing remain unchanged from the edit target.
- The result does not reproduce any bundled calibration subject unless the user requests it.

## Targeted corrections

- If the result is a smooth model with a voxel texture, request geometry rebuilt from large rectilinear blocks aligned to the coarse base module.
- If it looks like 2D pixel art, restore the elevated orthographic view and require three visible face directions.
- If it resembles Minecraft, remove terrain, sky, props, pixel textures, and game-world lighting.
- If the subject is noisy or grid-like, merge adjacent cells into larger cuboids, hide coplanar seams, remove secondary blocks, and simplify internal marks.
- If base-module sizes vary between assets, return every asset to the locked projected module and camera zoom; rebuild the more complex object with fewer, larger blocks rather than a denser grid.
- If the dominant span exceeds 14 modules or visible pieces exceed 40, reduce the structure before generating again.
- If recognition is weak, strengthen only the two defining cues rather than adding general detail.
- If it looks like matte or waxy plastic, keep the body opaque and add a restrained broad area-light reflection across most or all of the source-facing planar face; do not add edge shine, narrow reflection lines, strong gradients, or molded bevels.
- If it looks transparent, translucent, or glass-like, eliminate all transmission, refraction, visible rear edges, and background bleed. Preserve the clear shine only on the outer surface.
- If each block has a bright border or corner hotspot, remove it. Restore one flat tone per face, with the complete top/front/side plane carrying the lighting difference.
- If it looks grounded, remove every contact shadow and reduce any remaining cast shadow until it is barely perceptible, soft, and incapable of defining a floor.
- If native colors look muted, preserve their native `L` and `h` while increasing family chroma by about 25–40% within gamut. If directed colors look muted, increase the whole preset's relative sRGB chroma scale by `0.08–0.15`, capped at `Cr = 1`. Do not compensate by increasing brightness.
- In a saturation-only revision, keep each large face within `ΔL ≤ 0.02` and hue drift within `±2°` of the edit target. Keep black and white unchanged.
- If one coherent shape contains several unrelated chromatic families that are not present in the source, keep its meaningful native family and replace only the invented hues with black, white, or a value-derived face. Never remove a source-authentic color from a genuinely separate component.
- If a continuous face contains a gradient, quantize it to one solid token-derived color. Move any intended color progression onto separate voxel layers or stepped blocks without changing geometry.
- If the result feels bland or weakly defined, add black for edges, stripes, arrows, pupils, or tool tips; add white for carriers, panels, wings, cutouts, or large calm surfaces.
- If color feedback causes a new silhouette, new component, removed component, or changed layout, discard the revision and repeat as a strict recolor edit of the previous output.
- If the final background drifts from `#F4F4F4`, run the gray normalizer on the accepted render; do not regenerate or recolor the object.

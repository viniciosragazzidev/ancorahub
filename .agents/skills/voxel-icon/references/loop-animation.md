# Four-frame voxel loop

Use this workflow only when the user explicitly requests a loop, animated icon,
GIF, animated WebP, or four-frame motion. Generate and approve the still image
first. Use that approved still as the visual source for complete generated
keyframes.

## Physical motion analysis

Identify what the object actually is and how it can move in the real world
before designing keyframes. Do not start from a generic requirement to move
two pieces. Record the object's structure first:

```yaml
motion_analysis:
  motion_model: rigid rocking around a supported edge
  rigid_groups: [crown_bill_button]
  articulated_parts: []
  fixed_connections: [bill_to_crown, button_to_crown]
  moving_parts: [crown_region, bill_region]
  forward_state: whole connected cap pitches upward in 3D
  back_state: whole connected cap pitches downward in 3D
```

- Choose a motion model that the named object can really perform: motion about
  a hinge or axle, elastic bending while continuously connected, sliding on a
  support, or a rigid object's change of three-dimensional orientation.
- Treat `rigid_groups` as indivisible assemblies. Every component named in
  `fixed_connections` must remain connected, with no new gap, floating part,
  duplication, disappearance, or invented joint.
- Use `articulated_parts` only for actual joints or flexible regions. Do not
  detach a cap bill, vessel handle, button, axle, knob, leaf, or other fixed
  component merely to create visible motion.
- Name at least two visible semantic regions in `moving_parts`. They may move
  independently, or they may change together because one physically credible
  motion changes their orientation, occlusion, foreshortening, or visible-face
  proportions. They do not need invented independent joints.
- Keep the camera, orthographic projection, canvas, scale, and framing fixed.
  A rigid object may pitch, yaw, roll, or flip in three-dimensional space when
  that is a credible motion. The resulting keyframe must show newly generated
  3D face visibility and occlusion; a 2D whole-image rotation, translation,
  scale, or bob is never a substitute.

For example, animate a billed cap as one rigid connected assembly that pitches
forward and back. The crown and bill both change visible-face proportions while
the bill and top button remain attached. Never pull the bill or button away
from the crown.

## Loop contract

Record one loop plan before producing frames:

```yaml
output_mode: loop
loop:
  frame_count: 4
  duration_ms: 300
  motion: physical_3d
  motion_model: hinged lid with linked indicator
  rigid_groups: [container_body, lid]
  articulated_parts: [lid_hinge, indicator_slider]
  fixed_connections: [lid_to_hinge, hinge_to_body]
  moving_parts: [lid_panel, indicator_marker]
  forward_state: lid opens while indicator slides right
  back_state: lid closes past rest while indicator slides left
  sequence: [rest, forward, rest, back]
```

- Keep `output_mode: still` as the default.
- Use exactly four frames in the sequence
  `rest → forward → rest → back`.
- Keep each frame at 300 ms unless the user explicitly requests another
  duration.
- Name at least two visibly changing semantic regions. They may be independently
  articulated or coupled by one real rigid-body or flexible motion.
- A credible rigid whole-object 3D orientation change is valid when it changes
  at least two named regions through face visibility, occlusion, or
  foreshortening. A post-generation 2D whole-image rotation, translation,
  scale, or bob is invalid.
- Choose one coordinated motion idea that clarifies the object. Do not animate
  every part.
- Keep motion discrete and readable. Do not add motion blur, smear frames,
  speed lines, particles, or camera movement.

## Voxel style lock

Before generating poses, record the invariants inherited from the approved
still:

```yaml
style_lock:
  identity: approved subject and defining cues
  construction: coarse voxel topology and component count
  palette: approved native or directed color plan
  material: opaque face-lit cast acrylic
  camera: approved orthographic isometric view
  composition: canvas size, object scale, position, and framing
  background: exact flat "#F4F4F4"
```

Keep every style-lock value unchanged across the loop. Only the named moving
parts may change pose. Preserve the same three isometric axes and shared
base-module scale in every frame.

## Generate complete keyframes

Plan one coordinated, physically credible action across at least two visible
semantic regions, such as a lid opening while an indicator moves, a connected
cap pitching so its crown and bill change face visibility together, or a rigid
vessel rocking so its body and attached handles change occlusion together.
Generate exactly two additional complete poses from the approved still: one
`forward` pose and one `back` pose. Each pose prompt must restate the motion
model, rigid groups, articulated parts, fixed connections, both moving regions,
their exact states, and the voxel style lock. Explicitly request physically
correct 3D orientation, occlusion, foreshortening, and visible-face changes.

Use every accepted generated pose as a complete frame. Do not mask, composite,
inpaint, recolor, repair, normalize the background, or transform any region
after generation. If a complete pose introduces unacceptable drift, regenerate
the complete pose rather than repairing it locally.

## Assemble the generated-frame loop

Pass the approved complete images directly to the assembler:

```bash
python scripts/build-generated-loop.py \
  BASE.png POSE_FORWARD.png POSE_BACK.png OUTPUT_DIR \
  --moving-part bell_caps \
  --moving-part long_hand \
  --duration-ms 300
```

The script rejects a plan with fewer than two uniquely named visible semantic
regions and copies the source PNG files without changing their pixels. It arranges the
complete frames as `base → forward → base → back`, then writes a contact sheet,
a lossless animated WebP, a GIF fallback, and a manifest containing source and
frame hashes. Prefer animated WebP for product use and keep GIF as the
compatibility artifact.

## Frame invariants

- Every source must be a complete opaque RGB PNG on the same canvas.
- Keep frames 0 and 2 byte-identical copies of the approved base PNG.
- Keep frames 1 and 3 byte-identical copies of their generated pose PNGs.
- Preserve every recorded voxel style-lock value.
- Verify that at least two recorded semantic regions visibly change, whether
  independently or as coupled consequences of the same real motion.
- Verify every `fixed_connections` relationship in both generated poses. Record
  any disconnected, hovering, duplicated, missing, or newly invented component
  explicitly during review.
- Verify that rigid objects show real 3D face-visibility and occlusion changes,
  not a post-generation 2D transform.
- Return to the starting state cleanly. Avoid an unintended pause caused by
  duplicating the final and first pose.
- Do not use masks, local compositing, inpainting, background normalization,
  color matching, or post-generation transforms.
- Evaluate the complete generated frames at actual speed because full-frame
  lighting, geometry, or background drift reads as flicker.

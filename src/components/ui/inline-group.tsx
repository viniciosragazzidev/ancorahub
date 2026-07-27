import { useRender } from "@base-ui/react/use-render"
import { mergeProps } from "@base-ui/react/merge-props"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// ── InlineGroup ──────────────────────────────────────────────────────────────
//
// Aligns children in a single horizontal row with configurable:
//   - horizontal alignment  (justify)
//   - vertical alignment    (align)
//   - gap                   (gap — follows the design system spacing scale)
//   - wrapping              (wrap)
//
// Use InlineGroupItem to individually align a specific child or to expand it
// to fill all available width.
//
// Usage:
//   <InlineGroup justify="between" align="center" gap="md">
//     <span>Label</span>
//     <InlineGroupItem align="end" expand>
//       <Button>Action</Button>
//     </InlineGroupItem>
//   </InlineGroup>

const inlineGroupVariants = cva("flex flex-row", {
  variants: {
    /** Horizontal distribution of children */
    justify: {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    },
    /** Vertical alignment of all children */
    align: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      baseline: "items-baseline",
      stretch: "items-stretch",
    },
    /**
     * Gap between children — mapped to the design system spacing scale:
     *   xs  -> --size-spacing-01 (4px)
     *   sm  -> --size-spacing-02 (8px)
     *   md  -> --size-spacing-03 (12px)
     *   lg  -> --size-spacing-04 (16px)
     *   xl  -> --size-spacing-05 (24px)
     *   2xl -> --size-spacing-06 (32px)
     */
    gap: {
      none: "gap-0",
      xs: "gap-1",    // 4px  — --size-spacing-01
      sm: "gap-2",    // 8px  — --size-spacing-02
      md: "gap-3",    // 12px — --size-spacing-03
      lg: "gap-4",    // 16px — --size-spacing-04
      xl: "gap-6",    // 24px — --size-spacing-05
      "2xl": "gap-8", // 32px — --size-spacing-06
    },
    /** Allow children to wrap onto the next line when they exceed max width */
    wrap: {
      wrap: "flex-wrap",
      nowrap: "flex-nowrap",
      "wrap-reverse": "flex-wrap-reverse",
    },
  },
  defaultVariants: {
    justify: "start",
    align: "center",
    gap: "sm",
    wrap: "nowrap",
  },
})

type InlineGroupProps = useRender.ComponentProps<"div"> &
  VariantProps<typeof inlineGroupVariants>

function InlineGroup({
  className,
  justify,
  align,
  gap,
  wrap,
  render,
  ...props
}: InlineGroupProps) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          inlineGroupVariants({ justify, align, gap, wrap }),
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "inline-group" },
  })
}

// ── InlineGroupItem ──────────────────────────────────────────────────────────
//
// Wraps an individual child inside an InlineGroup to:
//   - override its vertical alignment independently of the group
//   - expand it to fill all remaining horizontal space (expand)

const inlineGroupItemVariants = cva("flex", {
  variants: {
    /** Override vertical alignment for this specific item */
    align: {
      start: "self-start",
      center: "self-center",
      end: "self-end",
      baseline: "self-baseline",
      stretch: "self-stretch",
    },
    /** Expand to fill all available horizontal space in the group */
    expand: {
      true: "flex-1 min-w-0",
      false: "",
    },
  },
  defaultVariants: {
    expand: false,
  },
})

type InlineGroupItemProps = useRender.ComponentProps<"div"> &
  VariantProps<typeof inlineGroupItemVariants>

function InlineGroupItem({
  className,
  align,
  expand,
  render,
  ...props
}: InlineGroupItemProps) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          inlineGroupItemVariants({ align, expand }),
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "inline-group-item" },
  })
}

export {
  InlineGroup,
  InlineGroupItem,
  inlineGroupVariants,
  inlineGroupItemVariants,
}

"use client"

import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/lib/utils"
import { buttonVariants, type ButtonVariants } from "./button-variants"

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: ButtonPrimitive.Props & ButtonVariants) {
  if (React.isValidElement(render)) {
    const renderElement = render as React.ReactElement<{ className?: string }>;
    return React.cloneElement(renderElement, {
      className: cn(buttonVariants({ variant, size, className }), renderElement.props.className),
      ...props,
    });
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={!render}
      {...props}
    />
  )
}

export { Button, buttonVariants }

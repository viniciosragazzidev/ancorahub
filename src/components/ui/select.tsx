"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  type SelectProps,
  type SelectTriggerProps,
  type SelectValueProps,
  type SelectContentProps,
  type SelectItemProps,
} from "@/components/motion/select";
import {
  MorphSelect,
  MorphSelectTrigger,
  MorphSelectValue,
  MorphSelectContent,
  MorphSelectItem,
  type MorphSelectProps,
  type MorphSelectTriggerProps,
  type MorphSelectValueProps,
  type MorphSelectContentProps,
  type MorphSelectItemProps,
} from "@/components/motion/select-morph";

function SelectGroup({ className, children, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("p-1", className)} {...props}>
      {children}
    </div>
  );
}

function SelectLabel({ className, children, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("px-2.5 py-1.5 text-xs font-semibold text-muted-foreground", className)} {...props}>
      {children}
    </div>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  );
}

function SelectScrollUpButton() {
  return null;
}

function SelectScrollDownButton() {
  return null;
}

export type SelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type AppSelectProps = {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  size?: "sm" | "default";
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-label"?: string;
};

function AppSelect({
  name,
  id,
  value: controlledValue,
  defaultValue,
  onValueChange,
  options,
  placeholder = "Selecione...",
  disabled,
  required,
  size = "default",
  className,
  triggerClassName,
  contentClassName,
  "aria-label": ariaLabel,
}: AppSelectProps) {
  const [internalValue, setInternalValue] = React.useState<string>(
    controlledValue ?? defaultValue ?? ""
  );

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = (val: string) => {
    if (controlledValue === undefined) {
      setInternalValue(val);
    }
    onValueChange?.(val);
  };

  return (
    <div className={cn("relative inline-block w-full", className)}>
      {name ? <input type="hidden" name={name} value={currentValue} required={required} /> : null}
      <Select
        value={currentValue}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          size={size}
          aria-label={ariaLabel}
          className={triggerClassName}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  AppSelect,
  MorphSelect,
  MorphSelectContent,
  MorphSelectItem,
  MorphSelectTrigger,
  MorphSelectValue,
};

export type {
  SelectProps,
  SelectTriggerProps,
  SelectValueProps,
  SelectContentProps,
  SelectItemProps,
  MorphSelectProps,
  MorphSelectTriggerProps,
  MorphSelectValueProps,
  MorphSelectContentProps,
  MorphSelectItemProps,
};

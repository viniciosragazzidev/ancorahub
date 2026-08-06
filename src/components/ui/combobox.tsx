"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type AppComboboxProps = {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  size?: "sm" | "default";
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-label"?: string;
};

export function AppCombobox({
  name,
  id,
  value: controlledValue,
  defaultValue,
  onValueChange,
  options,
  placeholder = "Selecione uma opção...",
  searchPlaceholder = "Pesquisar...",
  emptyText = "Nenhuma opção encontrada.",
  disabled = false,
  required = false,
  size = "default",
  className,
  triggerClassName,
  contentClassName,
  "aria-label": ariaLabel,
}: AppComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [internalValue, setInternalValue] = React.useState<string>(
    controlledValue ?? defaultValue ?? ""
  );

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  const selectedOption = options.find((opt) => opt.value === currentValue);

  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) return options;
    const lower = query.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(lower));
  }, [options, query]);

  const handleSelect = (val: string) => {
    const nextVal = val === currentValue ? "" : val;
    if (controlledValue === undefined) {
      setInternalValue(nextVal);
    }
    onValueChange?.(nextVal);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={cn("relative inline-block w-full", className)}>
      {name ? <input type="hidden" name={name} value={currentValue} required={required} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          aria-label={ariaLabel}
          disabled={disabled}
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              size={size === "sm" ? "sm" : "default"}
              className={cn(
                "w-full justify-between font-normal shadow-none border-input bg-card dark:bg-input/30",
                !selectedOption && "text-muted-foreground",
                triggerClassName
              )}
            >
              <span className="truncate">
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent
          align="start"
          className={cn("w-[220px] p-2 border-border bg-popover text-popover-foreground shadow-xl", contentClassName)}
        >
          <div className="relative mb-2 flex items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filteredOptions.length === 0 ? (
              <p className="p-2 text-center text-xs text-muted-foreground">{emptyText}</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === currentValue;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground text-left",
                      isSelected && "bg-accent/70 font-semibold text-primary",
                      opt.disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected ? <Check className="size-3.5 text-primary shrink-0" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch(
    {
      checked: controlled,
      defaultChecked,
      onCheckedChange,
      disabled,
      id,
      className,
      ...rest
    },
    ref
  ) {
    const [uncontrolled, setUncontrolled] = React.useState(!!defaultChecked);
    const isControlled = controlled !== undefined;
    const checked = isControlled ? controlled : uncontrolled;

    const toggle = () => {
      if (disabled) return;
      const next = !checked;
      if (!isControlled) setUncontrolled(next);
      onCheckedChange?.(next);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2447] focus-visible:ring-offset-2",
          checked ? "bg-[#0B2447]" : "bg-gray-300",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        {...rest}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform",
            checked ? "translate-x-5" : "translate-x-1"
          )}
        />
      </button>
    );
  }
);

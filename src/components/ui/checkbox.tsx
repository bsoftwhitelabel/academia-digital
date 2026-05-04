"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, onCheckedChange, onChange, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        onChange={(e) => {
          onChange?.(e);
          onCheckedChange?.(e.target.checked);
        }}
        className={cn(
          "h-5 w-5 cursor-pointer rounded border border-gray-300 text-[#0B2447]",
          "focus:ring-2 focus:ring-[#0B2447] focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "accent-[#0B2447]",
          className
        )}
        {...props}
      />
    );
  }
);

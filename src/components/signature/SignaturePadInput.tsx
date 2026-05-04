"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SignaturePadInputHandle {
  getDataUrl(): string | null;
  clear(): void;
  isEmpty(): boolean;
}

export interface SignaturePadInputProps {
  onChange?: (isEmpty: boolean) => void;
  className?: string;
  height?: number;
  testId?: string;
}

export const SignaturePadInput = forwardRef<SignaturePadInputHandle, SignaturePadInputProps>(
  function SignaturePadInput({ onChange, className, height = 180, testId }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);

      padRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(11, 36, 71)",
      });
      padRef.current.addEventListener("endStroke", () => {
        const empty = padRef.current?.isEmpty() ?? true;
        setIsEmpty(empty);
        onChange?.(empty);
      });

      return () => {
        padRef.current?.off();
      };
    }, [onChange]);

    useImperativeHandle(
      ref,
      () => ({
        getDataUrl() {
          if (!padRef.current || padRef.current.isEmpty()) return null;
          return padRef.current.toDataURL("image/png");
        },
        clear() {
          padRef.current?.clear();
          setIsEmpty(true);
          onChange?.(true);
        },
        isEmpty() {
          return padRef.current?.isEmpty() ?? true;
        },
      }),
      [onChange]
    );

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="overflow-hidden rounded-md border border-gray-300 shadow-inner">
          <canvas
            ref={canvasRef}
            data-testid={testId}
            className="block w-full touch-none"
            style={{ height: `${height}px`, width: "100%" }}
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              padRef.current?.clear();
              setIsEmpty(true);
              onChange?.(true);
            }}
            disabled={isEmpty}
          >
            Limpar
          </Button>
        </div>
      </div>
    );
  }
);

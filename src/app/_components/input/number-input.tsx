"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useCallback } from "react";
import type { InputHTMLAttributes } from "react";

interface NumberInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "type" | "value" | "onChange" | "min" | "max"
  > {
  minValue: number;
  maxValue: number;
  defaultValue: number;
  selectedValue: number;
  onChange: (value: number) => void;
  label?: string;
}

export default function NumberInput({
  minValue,
  maxValue,
  defaultValue,
  selectedValue,
  onChange,
  label = "Number input with plus/minus buttons",
  className,
  ...inputProps
}: NumberInputProps) {
  // Handle direct input changes
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= minValue && value <= maxValue) {
        onChange(value);
      }
    },
    [minValue, maxValue, onChange],
  );

  // Handle increment/decrement
  const handleIncrement = useCallback(() => {
    if (selectedValue < maxValue) {
      onChange(selectedValue + 1);
    }
  }, [selectedValue, maxValue, onChange]);

  const handleDecrement = useCallback(() => {
    if (selectedValue > minValue) {
      onChange(selectedValue - 1);
    }
  }, [selectedValue, minValue, onChange]);

  const buttonClass =
    "text-secondary hover:bg-primary-100 hover:text-foreground flex aspect-square h-full items-center justify-center border-primary-300 shadow-sm bg-light text-sm transition-colors disabled:pointer-events-none disabled:bg-light";

  return (
    <div className="w-full">
      <div className="*:not-first:mt-2">
        <div className="focus-within:ring-ring flex h-12 w-full items-center overflow-hidden rounded-xl text-sm transition-colors focus-within:ring-2">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={selectedValue <= minValue}
            className={`${buttonClass} enabled:border-r`}
            aria-label="Decrease value"
          >
            <MinusIcon size={16} aria-hidden="true" />
          </button>
          <input
            type="number"
            value={selectedValue}
            onChange={handleInputChange}
            min={minValue}
            max={maxValue}
            className="bg-background h-full w-full px-3 py-2 text-center tabular-nums text-dark focus:outline-none"
            aria-label={label}
            {...inputProps}
          />
          <button
            type="button"
            onClick={handleIncrement}
            disabled={selectedValue >= maxValue}
            className={`${buttonClass} enabled:border-l`}
            aria-label="Increase value"
          >
            <PlusIcon size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useCallback, useState, useEffect } from "react";
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
  selectedValue,
  onChange,
  label = "Number input with plus/minus buttons",
  ...inputProps
}: NumberInputProps) {
  // Track the input value separately to handle empty state
  const [inputValue, setInputValue] = useState(selectedValue.toString());

  // Sync inputValue with selectedValue when it changes externally
  useEffect(() => {
    setInputValue(selectedValue.toString());
  }, [selectedValue]);

  // Handle direct input changes
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;

      // If input is empty, just update the display value
      if (rawValue === "") {
        setInputValue("");
        return;
      }

      // Remove leading zeros but keep a single zero if that's the only digit
      const trimmed = rawValue.replace(/^0+(?=\d)/, "");
      const numericValue = parseInt(trimmed, 10);

      // Update the display value to show the trimmed version
      setInputValue(trimmed);

      // Only update the actual value if it's a valid number within range
      if (!isNaN(numericValue) && numericValue >= minValue && numericValue <= maxValue) {
        onChange(numericValue);
      }
    },
    [minValue, maxValue, onChange],
  );

  // Handle input blur - set to 0 if empty, otherwise validate the current value
  const handleInputBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;

      if (rawValue === "") {
        // If input is empty, set to 0 and update display
        onChange(0);
        setInputValue("0");
        return;
      }

      const numericValue = parseInt(rawValue, 10);

      // If invalid or out of range, reset to current selectedValue
      if (isNaN(numericValue) || numericValue < minValue || numericValue > maxValue) {
        setInputValue(selectedValue.toString());
        return;
      }

      // Ensure the display value matches the actual value (remove leading zeros)
      const trimmedValue = numericValue.toString();
      setInputValue(trimmedValue);
    },
    [minValue, maxValue, onChange, selectedValue],
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
    "text-primary-50 bg-transparent hover:text-black flex aspect-square h-10 rounded-full items-center justify-center border-primary-300 shadow-sm bg-light text-sm transition-colors disabled:pointer-events-none disabled:opacity-50";

  return (
    <div className="w-42">
      <div className="flex gap-2 h-12 w-full items-center overflow-hidden rounded-xl text-sm transition-colors">
        <button
            type="button"
            onClick={handleDecrement}
            disabled={selectedValue <= minValue}
            className={`${buttonClass}`}
            aria-label="Decrease value"
          >
            <MinusIcon size={16} aria-hidden="true" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            min={minValue}
            max={maxValue}
            className="bg-background text-base h-full w-16 px-4 py-2 text-center text-dark focus:outline-none rounded-xl"
            aria-label={label}
            {...inputProps}
          />
          <button
            type="button"
            onClick={handleIncrement}
            disabled={selectedValue >= maxValue}
            className={`${buttonClass}`}
            aria-label="Increase value"
          >
            <PlusIcon size={16} aria-hidden="true" />
          </button>
      </div>
    </div>
  );
}

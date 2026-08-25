"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpNumberProps {
  value: number | string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  formatter?: (val: number) => string;
}

export function CountUpNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 750,
  className = "",
  formatter,
}: CountUpNumberProps) {
  // Parse numeric target
  let numericTarget = 0;
  let hasNumeric = false;

  if (typeof value === "number") {
    numericTarget = value;
    hasNumeric = !isNaN(numericTarget);
  } else if (typeof value === "string") {
    // If it's a string, try to parse digits out or extract currency/percentage
    const cleanStr = value.replace(/[^0-9.-]/g, "");
    if (cleanStr && !isNaN(Number(cleanStr))) {
      numericTarget = Number(cleanStr);
      hasNumeric = true;
    }
  }

  const [displayValue, setDisplayValue] = useState<number>(numericTarget);
  const prevTargetRef = useRef<number>(numericTarget);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hasNumeric) return;

    const startVal = prevTargetRef.current;
    const endVal = numericTarget;
    prevTargetRef.current = endVal;

    if (startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    const startTime = performance.now();

    const updateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic: 1 - Math.pow(1 - progress, 3)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updateCount);
      } else {
        setDisplayValue(endVal);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateCount);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [numericTarget, duration, hasNumeric]);

  if (!hasNumeric) {
    return <span className={className}>{value}</span>;
  }

  const formattedOutput = formatter
    ? formatter(displayValue)
    : displayValue.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formattedOutput}
      {suffix}
    </span>
  );
}

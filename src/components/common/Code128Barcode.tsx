"use client";

import { encodeCode128B } from "@/lib/code128";

interface Code128BarcodeProps {
  value: string;
  height?: number;
  moduleWidth?: number;
  className?: string;
}

// Renders a real, scannable Code 128 barcode as inline SVG <rect> bars —
// not a CSS background, so it survives Chrome's "Background graphics" print
// toggle and Save-as-PDF, and the bar widths are derived from the encoded
// value itself (not decorative).
export default function Code128Barcode({ value, height = 48, moduleWidth = 2, className }: Code128BarcodeProps) {
  let modules: string;
  try {
    modules = encodeCode128B(value);
  } catch {
    return (
      <div className={className} style={{ fontSize: 10, color: "#b91c1c", fontWeight: 700 }}>
        Unable to render barcode for &quot;{value}&quot;
      </div>
    );
  }

  // ISO/IEC 15417 requires a quiet zone of at least 10 modules on each side.
  const quietModules = 10;
  const totalModules = modules.length + quietModules * 2;
  const totalWidth = totalModules * moduleWidth;

  const bars: { x: number; width: number }[] = [];
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === "1") {
      let j = i;
      while (j < modules.length && modules[j] === "1") j++;
      bars.push({ x: (quietModules + i) * moduleWidth, width: (j - i) * moduleWidth });
      i = j;
    } else {
      i++;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={`Barcode ${value}`}
    >
      <rect x={0} y={0} width={totalWidth} height={height} fill="#ffffff" />
      {bars.map((bar, idx) => (
        <rect key={idx} x={bar.x} y={0} width={bar.width} height={height} fill="#000000" />
      ))}
    </svg>
  );
}

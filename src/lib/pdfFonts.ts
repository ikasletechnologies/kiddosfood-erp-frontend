// Unicode font for jsPDF reports. jsPDF's built-in fonts (helvetica etc.)
// only cover WinAnsi, so "₹" came out as a stray glyph ("¹") and every line
// containing it was spaced out character by character. Noto Sans
// (SIL Open Font License, public/fonts/OFL.txt) includes ₹ and is embedded
// instead. Loaded on demand and cached for the session.

const FONT_FAMILY = "NotoSans";
const FILES: Array<{ style: "normal" | "bold"; file: string }> = [
  { style: "normal", file: "NotoSans-Regular.ttf" },
  { style: "bold", file: "NotoSans-Bold.ttf" },
];

let cache: Promise<Record<string, string>> | null = null;

async function loadFonts(): Promise<Record<string, string>> {
  const entries = await Promise.all(FILES.map(async ({ style, file }) => {
    const res = await fetch(`/fonts/${file}`);
    if (!res.ok) throw new Error(`Font ${file} could not be loaded (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
    }
    return [style, btoa(binary)] as const;
  }));
  return Object.fromEntries(entries);
}

/**
 * Registers Noto Sans (normal + bold) on a jsPDF document and returns the
 * font family to pass to doc.setFont(). Falls back to "helvetica" if the
 * font files can't be loaded — callers should then avoid "₹" (see
 * `rupee` below).
 */
export async function loadUnicodeFont(doc: any): Promise<{ family: string; rupee: string }> {
  try {
    if (!cache) cache = loadFonts();
    const fonts = await cache;
    for (const { style, file } of FILES) {
      doc.addFileToVFS(file, fonts[style]);
      doc.addFont(file, FONT_FAMILY, style);
    }
    return { family: FONT_FAMILY, rupee: "₹" };
  } catch (e) {
    cache = null; // allow a retry on the next export
    console.error("PDF font load failed; falling back to helvetica", e);
    return { family: "helvetica", rupee: "Rs." };
  }
}

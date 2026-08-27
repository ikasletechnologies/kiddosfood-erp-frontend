// Code 128 (Subset B) encoder — ISO/IEC 15417.
//
// PATTERNS[0..106] is the standard Code 128 symbol table: 103 data symbols
// (values 0-102, i.e. ASCII 32-127 minus 32 in Subset B), START A/B/C
// (103/104/105) and STOP (106). Each entry is the bar/space pattern read as
// a binary string of 1s (black module) and 0s (white module) — 11 modules
// per symbol, 13 for STOP. Values cross-checked against the published
// Start-B pattern (11010010000) and Stop pattern (1100011101011).
const PATTERNS = [
  11011001100, 11001101100, 11001100110, 10010011000, 10010001100,
  10001001100, 10011001000, 10011000100, 10001100100, 11001001000,
  11001000100, 11000100100, 10110011100, 10011011100, 10011001110,
  10111001100, 10011101100, 10011100110, 11001110010, 11001011100,
  11001001110, 11011100100, 11001110100, 11101101110, 11101001100,
  11100101100, 11100100110, 11101100100, 11100110100, 11100110010,
  11011011000, 11011000110, 11000110110, 10100011000, 10001011000,
  10001000110, 10110001000, 10001101000, 10001100010, 11010001000,
  11000101000, 11000100010, 10110111000, 10110001110, 10001101110,
  10111011000, 10111000110, 10001110110, 11101110110, 11010001110,
  11000101110, 11011101000, 11011100010, 11011101110, 11101011000,
  11101000110, 11100010110, 11101101000, 11101100010, 11100011010,
  11101111010, 11001000010, 11110001010, 10100110000, 10100001100,
  10010110000, 10010000110, 10000101100, 10000100110, 10110010000,
  10110000100, 10011010000, 10011000010, 10000110100, 10000110010,
  11000010010, 11001010000, 11110111010, 11000010100, 10001111010,
  10100111100, 10010111100, 10010011110, 10111100100, 10011110100,
  10011110010, 11110100100, 11110010100, 11110010010, 11011011110,
  11011110110, 11110110110, 10101111000, 10100011110, 10001011110,
  10111101000, 10111100010, 11110101000, 11110100010, 10111011110,
  10111101110, 11101011110, 11110101110, 11010000100, 11010010000,
  11010011100, 1100011101011,
] as const;

const START_B = 104;
const STOP = 106;

/** Subset B covers ASCII 32 (space) through 127 (DEL). */
export function isCode128BEncodable(value: string): boolean {
  return /^[\x20-\x7F]*$/.test(value) && value.length > 0;
}

/**
 * Encodes `value` as Code 128 Subset B and returns the full module string
 * (quiet-zone-free): one character per module, '1' = black bar, '0' = white
 * space, ready to be drawn as contiguous rects.
 */
export function encodeCode128B(value: string): string {
  if (!isCode128BEncodable(value)) {
    throw new Error(`"${value}" contains characters outside Code 128 Subset B (ASCII 32-127)`);
  }

  const values = [START_B];
  for (let i = 0; i < value.length; i++) {
    values.push(value.charCodeAt(i) - 32);
  }

  // Standard Code 128 checksum: start value (unweighted) + each data value
  // weighted by its 1-based position, mod 103.
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i;
  }
  checksum %= 103;

  values.push(checksum, STOP);

  return values.map(v => PATTERNS[v].toString()).join('');
}

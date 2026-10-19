/**
 * Derives initials from a gym name for the avatar fallback (AC-198).
 *
 * Rules:
 * - Split on whitespace; take the first letter of each word.
 * - Up to 2 letters, uppercased.
 * - Requires no network request and has no external dependency.
 *
 * Examples:
 *   "MegaSTONE Climbing Gym"   → "MC"
 *   "CORNER 角攀岩館"           → "C角" (first char of each word, up to 2)
 *   "double8 岩究所"            → "D岩"
 *   "RedRock 紅石攀岩"          → "R紅"
 *   "奇岩攀岩館"                → "奇" (single word → single initial)
 */
export function getGymInitials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((word) => {
      // Use Array.from so multi-byte Unicode characters (CJK) count as one unit
      const chars = Array.from(word);
      return chars[0] ?? '';
    })
    .join('')
    .toUpperCase();
  return initials || '?';
}

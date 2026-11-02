const GENERIC_BANK_WORDS = new Set([
  'payment',
  'transfer',
  'deposit',
  'pos',
  'debit',
  'ach',
  'online',
]);

/**
 * Merchant text a bank rule can match. Trims, collapses spaces, and drops
 * trailing store numbers. Returns null when the text is too short or generic.
 */
export function toRuleMatchText(
  description: string | null | undefined,
): string | null {
  if (description == null) {
    return null;
  }
  let text = String(description).replace(/\s+/g, ' ').trim();
  if (!text) {
    return null;
  }
  let previous = '';
  while (text !== previous) {
    previous = text;
    text = text
      .replace(/\s+(?:store|location)\.?\s*#?\s*\d+\s*$/i, '')
      .replace(/\s*#\s*\d+\s*$/i, '')
      .replace(/\s+\d+\s*$/i, '')
      .trim();
  }
  if (text.length < 4 || GENERIC_BANK_WORDS.has(text.toLowerCase())) {
    return null;
  }
  return text;
}

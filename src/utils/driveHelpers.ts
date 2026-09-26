/**
 * Computes a list of drive letters to scan starting from primaryLetter
 * up to fallbackCount letters forward (e.g. 'D' + 5 => ['D', 'E', 'F', 'G', 'H', 'I']).
 */
export function getDriveSequence(primaryLetter: string = 'D', fallbackCount: number = 5): string[] {
  const cleanLetter = (primaryLetter || 'D').toUpperCase().replace(/[^A-Z]/g, '') || 'D';
  const startCode = cleanLetter.charCodeAt(0);
  const validStart = startCode >= 65 && startCode <= 90 ? startCode : 68; // 68 = 'D'
  const count = Math.max(0, Math.min(20, typeof fallbackCount === 'number' ? fallbackCount : 5));

  const sequence: string[] = [];
  for (let i = 0; i <= count; i++) {
    const charCode = validStart + i;
    if (charCode <= 90) { // Up to 'Z'
      sequence.push(String.fromCharCode(charCode));
    }
  }

  return sequence.length > 0 ? sequence : [cleanLetter];
}

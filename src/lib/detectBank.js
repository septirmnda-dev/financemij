/**
 * Deteksi rekening bank dari teks CSV/Excel berdasarkan nomor rekening terdaftar.
 * Mencari nomor rekening yang terdaftar di dalam teks file (header/metadata).
 * @param {string} text - Isi file (CSV text)
 * @param {Array} bankAccounts - Daftar rekening terdaftar
 * @returns {object|null} Rekening yang cocok, atau null
 */
export function detectBankAccount(text, bankAccounts) {
  if (!text || !bankAccounts || bankAccounts.length === 0) return null;
  // Ambil 2000 karakter pertama (header/metadata biasanya di awal)
  const header = text.slice(0, 2000);
  // Cari nomor rekening terdaftar yang muncul di teks
  for (const b of bankAccounts) {
    if (b.account_number && header.includes(b.account_number)) {
      return b;
    }
  }
  // Fallback: cari pola "No. rekening" atau "Nomor Rekening" lalu ekstrak angka
  const rekeningMatch = header.match(/(?:no\.?\s*rekening|nomor\s*rekening|account)\s*[:\s]*(\d[\d\s-]{5,30})/i);
  if (rekeningMatch) {
    const num = rekeningMatch[1].replace(/[\s-]/g, "");
    const match = bankAccounts.find((b) => b.account_number === num || b.account_number?.endsWith(num) || num.endsWith(b.account_number || ""));
    if (match) return match;
  }
  return null;
}
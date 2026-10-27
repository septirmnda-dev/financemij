/**
 * Auto-mapping engine: memetakan keterangan mutasi bank ke kategori
 * berdasarkan kata kunci (keywords) yang dikonfigurasi per kategori.
 *
 * Logika: cari kata kunci terpanjang yang cocok (match paling spesifik menang).
 * Hanya kategori dengan arah (direction) yang sama dengan mutasi yang dipertimbangkan.
 */

/**
 * Mencari kategori terbaik untuk sebuah mutasi berdasarkan kata kunci.
 * @param {string} description - Keterangan/deskripsi mutasi bank
 * @param {string} direction - Arah mutasi: "masuk" atau "keluar"
 * @param {Array} categories - Daftar kategori dengan field keywords
 * @returns {object|null} Kategori yang cocok, atau null jika tidak ada match
 */
export function autoMapMutation(description, direction, categories) {
  const desc = (description || "").toUpperCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const cat of categories) {
    if (cat.direction !== direction) continue;
    const keywords = cat.keywords || [];
    for (const kw of keywords) {
      const k = (kw || "").toUpperCase().trim();
      if (k && desc.includes(k) && k.length > bestScore) {
        bestScore = k.length;
        bestMatch = cat;
      }
    }
  }

  return bestMatch;
}

/**
 * Mendapatkan kategori default berdasarkan arah mutasi (fallback).
 * @param {string} direction - "masuk" atau "keluar"
 * @param {Array} categories - Daftar kategori
 * @returns {object|null} Kategori default
 */
export function getDefaultCategory(direction, categories) {
  if (direction === "masuk") {
    return (
      categories.find((c) => c.direction === "masuk" && c.type === "pendapatan") ||
      categories.find((c) => c.direction === "masuk" && c.type === "lainnya")
    );
  }
  return categories.find((c) => c.direction === "keluar" && c.type === "lainnya");
}
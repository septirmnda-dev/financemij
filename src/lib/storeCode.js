import { base44 } from "@/api/base44Client";

export const PLATFORMS = ["Shopee", "Lazada", "Tiktok"];

/**
 * Mencari Kode Toko yang cocok di dalam keterangan mutasi.
 * Kode dicocokkan sebagai kata utuh (word boundary), kode terpanjang menang.
 */
export function matchStoreCode(description, storeCodes) {
  const desc = (description || "").toUpperCase();
  if (!desc) return null;
  let best = null;
  let bestLen = 0;
  for (const sc of storeCodes || []) {
    const code = (sc.code || "").toUpperCase().trim();
    if (code.length < 2) continue;
    const safe = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${safe}\\b`).test(desc) && code.length > bestLen) {
      bestLen = code.length;
      best = sc;
    }
  }
  return best;
}

/**
 * Mengambil kategori platform (mis. "Shopee") yang sudah ada.
 * Tidak lagi membuat kategori otomatis — Kode Biaya/Sub Biaya hanya
 * bertambah lewat Tambah Kode Biaya / Tambah Sub Biaya di menu Kategori.
 */
export async function ensurePlatformCategory(platform, categories) {
  return (
    (categories || []).find(
      (c) => c.direction === "masuk" && (c.name || "").toLowerCase() === (platform || "").toLowerCase()
    ) || null
  );
}
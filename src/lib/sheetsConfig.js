// Spreadsheet Google yang sudah ada dan menerima data dari web.
// ID diambil dari URL: docs.google.com/spreadsheets/d/<ID>/edit

/** ALL MUTASI REKENING PT DAN PENAMPUNG — satu tab per rekening, satu baris per tanggal. */
export const MUTASI_SPREADSHEET_ID = "1TvrL8koWZQx1nuwghb4WpEjZ2zipqvcVL69JRflMtqs";

/** BIAYA ADMIN REK PT MIJ DAN PT SGL — blok kolom per rekening (nomor rekening di baris 1). */
export const ADMIN_SPREADSHEET_ID = "1VyZBeI7lVZfVgY7BSAcVIpNXDOfpvcMY-lGsGZ_JIQc";

/**
 * Pola keterangan mutasi KELUAR yang dicatat ke spreadsheet biaya admin.
 * "PAJAK" hanya bila keterangannya persis "PAJAK"/"TAX" atau pajak bunga, agar
 * pembayaran pajak perusahaan (PPh/PPN) tidak ikut tercatat sebagai biaya admin.
 */
export const ADMIN_PATTERNS = [
  /BIAYA\s*ADM/i,
  /BIAYA\s*TXN/i,
  /BIAYA\s*TRANSFER/i,
  /BIAYA\s*PROVISI/i,
  /MONTHLY\s*CARD\s*CHARGE/i,
  /\bADM(IN)?\s*FEE\b/i,
  /PAJAK\s*BUNGA/i,
  /^\s*(PAJAK|TAX)\s*$/i,
];

/**
 * Spreadsheet petty cash. Baris baru ditambahkan di bawah tab periode terbaru:
 * - tabFormat "month-year": tab bernama "Okt 2026", "Nov 2026", …
 * - tabFormat "month": tab bernama "Okt", "Nov", … (file per tahun)
 * opsColumn: isi kolom G dengan "ops" bila transaksi ditandai Operasional.
 * Hanya transaksi perusahaan yang namanya cocok dengan PETTY_CASH_COMPANY_MATCH yang dikirim.
 */
export const PETTY_CASH_TARGETS = [
  {
    key: "pettycash-mij",
    label: "PETTY CASH PT MIJ",
    spreadsheetId: "1Maya9Spz3s8Dj1YMIyS75GAQMmFj9A4k35UOy4i4zuM",
    tabFormat: "month-year",
    opsColumn: true,
  },
  {
    key: "hf-pettycash-mij-2026",
    label: "[HF] REKAP PETTY CASH PT MIJ 2026",
    spreadsheetId: "1ATBqUrBhW2OkW83g2W2IshDXbgDfoA9gTZsdhZUlBsw",
    tabFormat: "month",
    opsColumn: false,
  },
];

export const PETTY_CASH_COMPANY_MATCH = /\bMIJ\b/i;

/**
 * Data yang dibuat di web SEBELUM tanggal ini dianggap sudah ada di spreadsheet
 * (dulu diisi manual), jadi tidak dikirim ulang. Berlaku untuk petty cash dan biaya admin.
 */
export const SHEET_SYNC_SINCE = "2026-10-29";

export function isAdminFee(description, direction) {
  if (direction !== "keluar") return false;
  const d = String(description || "");
  return ADMIN_PATTERNS.some((re) => re.test(d));
}

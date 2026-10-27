import * as XLSX from "xlsx";

/**
 * Unduh data sebagai file Excel (.xlsx).
 * headers: array nama kolom, rows: array of array nilai (angka tetap angka).
 */
export function downloadXlsx({ filename, sheetName = "Data", headers, rows }) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h, i) => {
    const maxLen = Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? "").length));
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}
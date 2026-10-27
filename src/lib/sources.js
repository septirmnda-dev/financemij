/**
 * Pemetaan otomatis kolom "Sumber" dari nama perusahaan.
 */
export const SUMBER_LIST = [
  { code: "MIJ", company: "PT Moncer Indonesia Jaya", keywords: ["moncer", "mij"] },
  { code: "KICAU", company: "PT Kicau Mania Nusantara", keywords: ["kicau"] },
  { code: "PARADISE", company: "PT Paradise Fishing Indonesia", keywords: ["paradise"] },
  { code: "MR JOZZ", company: "PT Mister Jozz Indonesia", keywords: ["jozz"] },
  { code: "PUSPUS", company: "PT Puspus Satwa Prima", keywords: ["puspus", "satwa prima"] },
];

export function sumberOf(companyName) {
  const name = (companyName || "").toLowerCase();
  if (!name) return "";
  const hit = SUMBER_LIST.find((s) => s.keywords.some((k) => name.includes(k)));
  return hit ? hit.code : "";
}

/** Team penanggung jawab sesuai asal data. */
export function teamOf(source) {
  if (source === "pettycash") return "Petty Cash";
  if (source === "ads") return "Komcards";
  return "Laporan";
}
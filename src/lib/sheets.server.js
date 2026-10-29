// Sinkron data web → Google Sheets yang sudah ada (server only).
// Token diambil dari konektor Google Sheets bersama (base44/connectors/googlesheets.jsonc),
// jadi pemanggil wajib sudah lolos requireUser.
import {
  ADMIN_SPREADSHEET_ID,
  MUTASI_SPREADSHEET_ID,
  PETTY_CASH_COMPANY_MATCH,
  PETTY_CASH_TARGETS,
  SHEET_SYNC_SINCE,
  isAdminFee,
} from "@/lib/sheetsConfig";

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Klien Sheets API ───────────────────────────────────────────────────────

export async function getSheetsClient(base44) {
  let accessToken;
  try {
    ({ accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets"));
  } catch (_e) {
    accessToken = null;
  }
  if (!accessToken) {
    throw new Error("Konektor Google Sheets belum dihubungkan di pengaturan aplikasi Base44");
  }

  const call = async (path, { method = "GET", query, body } = {}) => {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query || {})) {
      for (const one of [].concat(v)) url.searchParams.append(k, one);
    }
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Google Sheets: ${msg}`);
    }
    return json;
  };

  return {
    /** [{ sheetId, title, rowCount, columnCount }] */
    async tabs(spreadsheetId) {
      const json = await call(`/${spreadsheetId}`, {
        query: { fields: "sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))" },
      });
      return (json.sheets || []).map((s) => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title,
        rowCount: s.properties.gridProperties?.rowCount || 0,
        columnCount: s.properties.gridProperties?.columnCount || 0,
      }));
    },
    /** Nilai mentah (angka tanggal = serial) untuk beberapa range sekaligus. */
    async batchGet(spreadsheetId, ranges) {
      const json = await call(`/${spreadsheetId}/values:batchGet`, {
        query: { ranges, valueRenderOption: "UNFORMATTED_VALUE", majorDimension: "ROWS" },
      });
      return (json.valueRanges || []).map((r) => r.values || []);
    },
    async batchUpdateValues(spreadsheetId, data) {
      if (data.length === 0) return;
      await call(`/${spreadsheetId}/values:batchUpdate`, {
        method: "POST",
        body: { valueInputOption: "USER_ENTERED", data },
      });
    },
    async batchUpdate(spreadsheetId, requests) {
      if (requests.length === 0) return;
      await call(`/${spreadsheetId}:batchUpdate`, { method: "POST", body: { requests } });
    },
  };
}

// ── Utilitas ───────────────────────────────────────────────────────────────

const quoteTab = (title) => `'${String(title).replace(/'/g, "''")}'`;

function colLetter(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "2026-10-29" → serial tanggal Google Sheets (hari sejak 1899-12-30). */
function toSerial(isoDate) {
  const [y, m, d] = String(isoDate).slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

/** Sel tanggal dari sheet (serial atau teks "14 Oct 2026" / "14 Okt 2026") → serial. */
function cellToSerial(cell) {
  if (typeof cell === "number") return Math.floor(cell);
  const m = String(cell || "").trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/);
  if (!m) return null;
  const key = m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase();
  let mon = MONTHS_EN.indexOf(key);
  if (mon < 0) mon = MONTHS_ID.indexOf(key);
  if (mon < 0) return null;
  return toSerial(`${m[3]}-${String(mon + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`);
}

/** Record dibuat setelah sinkron otomatis aktif (yang lama sudah diisi manual di sheet). */
const isNewRecord = (r) => (r.created_date || "").slice(0, 10) >= SHEET_SYNC_SINCE;

const isBlank = (v) => v === undefined || v === null || String(v).trim() === "";

/** Indeks baris (0-based) terakhir yang berisi di salah satu kolom, mulai dari minRow. */
function lastFilledRow(rows, minRow) {
  for (let i = rows.length - 1; i >= minRow; i--) {
    if ((rows[i] || []).some((v) => !isBlank(v))) return i;
  }
  return minRow - 1;
}

/** Pastikan tab punya cukup baris; tambah baris kosong di bawah bila perlu. */
function ensureRowsRequest(tab, neededRowCount) {
  if (neededRowCount <= tab.rowCount) return [];
  return [{ appendDimension: { sheetId: tab.sheetId, dimension: "ROWS", length: neededRowCount - tab.rowCount + 20 } }];
}

/** Salin format (Rp, tanggal, warna) dari baris contoh ke baris baru. */
function copyFormatRequest(tab, fromRow0, toRow0Start, toRow0End, col0Start, col0End) {
  if (fromRow0 < 0) return [];
  return [{
    copyPaste: {
      source: { sheetId: tab.sheetId, startRowIndex: fromRow0, endRowIndex: fromRow0 + 1, startColumnIndex: col0Start, endColumnIndex: col0End },
      destination: { sheetId: tab.sheetId, startRowIndex: toRow0Start, endRowIndex: toRow0End, startColumnIndex: col0Start, endColumnIndex: col0End },
      pasteType: "PASTE_FORMAT",
    },
  }];
}

/** Ambil semua record entity yang cocok, mengikuti cursor. */
async function filterAll(entity, query) {
  const out = [];
  let page = await entity.filter(query, { limit: 1000 });
  out.push(...(page.items || []));
  while (page.next_cursor) {
    page = await entity.filter(query, { cursor: page.next_cursor, limit: 1000 });
    out.push(...(page.items || []));
  }
  return out;
}

// ── ALL MUTASI REKENING: total masuk/keluar harian ─────────────────────────

/** Calon nama tab untuk sebuah rekening, urut prioritas. */
function mutasiTabCandidates(bank) {
  const digits = String(bank.account_number || "").replace(/\D/g, "");
  const names = [];
  if (bank.sheet_name?.trim()) names.push(bank.sheet_name.trim());
  if (digits.length === 10) names.push(`${digits.slice(0, 3)}-${digits.slice(3)}`); // BCA: 164-5678666
  if (digits) names.push(digits);
  if (bank.account_number) names.push(String(bank.account_number).trim());
  if (bank.account_name) names.push(`${bank.bank_name} ${bank.account_name}`.trim()); // mis. "BCA Farid"
  return names;
}

/**
 * Tulis ulang kolom Pemasukan (CR) & Pengeluaran (DB) untuk tanggal-tanggal tertentu,
 * dihitung dari semua mutasi rekening (dari database) pada tanggal itu. Idempoten.
 */
async function syncDailyTotals(sheets, bank, dates, mutations) {
  const uniq = [...new Set(dates)].sort();
  if (uniq.length === 0) return { tab: null, updated: 0, missing: [] };

  const tabs = await sheets.tabs(MUTASI_SPREADSHEET_ID);
  const byTitle = new Map(tabs.map((t) => [t.title.trim().toLowerCase(), t]));
  const tab = mutasiTabCandidates(bank).map((n) => byTitle.get(n.toLowerCase())).find(Boolean);
  if (!tab) {
    throw new Error(
      `Tab untuk rekening ${bank.bank_name} ${bank.account_number} tidak ditemukan di ALL MUTASI REKENING — isi "Nama Tab Spreadsheet" di menu Perusahaan`
    );
  }

  const totals = new Map(uniq.map((d) => [d, { cr: 0, db: 0 }]));
  for (const m of mutations) {
    const t = totals.get(m.date);
    if (!t) continue;
    if (m.amount > 0) t.cr += m.amount;
    else t.db += -m.amount;
  }

  const [colA] = await sheets.batchGet(MUTASI_SPREADSHEET_ID, [`${quoteTab(tab.title)}!A1:A${tab.rowCount}`]);
  const rowBySerial = new Map();
  colA.forEach((r, i) => {
    const serial = cellToSerial(r?.[0]);
    if (serial != null && !rowBySerial.has(serial)) rowBySerial.set(serial, i + 1);
  });

  const data = [];
  const missing = [];
  for (const d of uniq) {
    const row = rowBySerial.get(toSerial(d));
    if (!row) { missing.push(d); continue; }
    const t = totals.get(d);
    data.push({ range: `${quoteTab(tab.title)}!C${row}:D${row}`, values: [[round2(t.cr), round2(t.db)]] });
  }
  await sheets.batchUpdateValues(MUTASI_SPREADSHEET_ID, data);
  return { tab: tab.title, updated: data.length, missing };
}

const round2 = (n) => Math.round(n * 100) / 100;

// ── BIAYA ADMIN REK: tambah baris di blok rekening ─────────────────────────

async function findAdminBlock(sheets, accountNumber) {
  const digits = String(accountNumber || "").replace(/\D/g, "");
  const tabs = await sheets.tabs(ADMIN_SPREADSHEET_ID);
  const headers = await sheets.batchGet(ADMIN_SPREADSHEET_ID, tabs.map((t) => `${quoteTab(t.title)}!1:3`));
  for (let i = 0; i < tabs.length; i++) {
    const [row1 = [], , row3 = []] = headers[i];
    const col = row1.findIndex((v) => String(v ?? "").replace(/\D/g, "") === digits && digits);
    if (col < 0) continue;
    // Lebar blok = kolom header berurutan (Tanggal, Nominal, Keterangan[, No. Rekening])
    let width = 0;
    while (width < 4 && !isBlank(row3[col + width])) width++;
    const hasAccountCol = width === 4 && /rekening/i.test(String(row3[col + 3]));
    return { tab: tabs[i], col, width: hasAccountCol ? 4 : 3, hasAccountCol };
  }
  return null;
}

async function appendAdminFees(base44, sheets, bank, mutations) {
  const fees = mutations
    .filter((m) => isNewRecord(m) && !m.admin_sheet_synced && isAdminFee(m.description, m.direction))
    .sort((a, b) => (a.date + (a.trans_time || "")).localeCompare(b.date + (b.trans_time || "")));
  if (fees.length === 0) return { tab: null, appended: 0 };

  const block = await findAdminBlock(sheets, bank.account_number);
  if (!block) {
    throw new Error(`Nomor rekening ${bank.account_number} tidak ditemukan di baris 1 spreadsheet BIAYA ADMIN REK`);
  }
  const { tab, col, width, hasAccountCol } = block;
  const first = colLetter(col);
  const last = colLetter(col + width - 1);
  const [body] = await sheets.batchGet(ADMIN_SPREADSHEET_ID, [`${quoteTab(tab.title)}!${first}1:${last}${tab.rowCount}`]);
  const lastRow0 = Math.max(lastFilledRow(body, 3), 2); // data mulai baris 4 (index 3)
  const startRow0 = lastRow0 + 1;
  const endRow0 = startRow0 + fees.length;

  await sheets.batchUpdate(ADMIN_SPREADSHEET_ID, [
    ...ensureRowsRequest(tab, endRow0),
    ...copyFormatRequest(tab, lastRow0 >= 3 ? lastRow0 : -1, startRow0, endRow0, col, col + width),
  ]);
  const values = fees.map((m) => {
    const row = [toSerial(m.date), Math.abs(m.amount), m.description || ""];
    if (hasAccountCol) row.push(String(bank.account_number));
    return row;
  });
  await sheets.batchUpdateValues(ADMIN_SPREADSHEET_ID, [
    { range: `${quoteTab(tab.title)}!${first}${startRow0 + 1}:${last}${endRow0}`, values },
  ]);

  await Promise.all(fees.map((m) => base44.entities.Mutation.update(m.id, { admin_sheet_synced: true })));
  return { tab: tab.title, appended: fees.length };
}

/**
 * Sinkron satu rekening untuk rentang tanggal: total harian ke ALL MUTASI REKENING
 * dan biaya admin baru ke BIAYA ADMIN REK. Mengembalikan ringkasan + pesan galat per bagian.
 */
export async function syncBankAccount(base44, bankAccountId, from, to) {
  const bank = await base44.entities.BankAccount.get(bankAccountId);
  const mutations = await filterAll(
    base44.entities.Mutation,
    { bank_account_id: bankAccountId, date: { $gte: from, $lte: to } },
  );
  const result = { daily: null, admin: null, errors: [] };
  if (mutations.length === 0) return result;
  const sheets = await getSheetsClient(base44);

  // Hanya sampai tanggal mutasi terakhir, agar baris tanggal yang belum ada datanya tetap kosong
  const lastDate = mutations.reduce((a, m) => (m.date > a ? m.date : a), "");
  const dates = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${lastDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  try {
    result.daily = await syncDailyTotals(sheets, bank, dates, mutations);
  } catch (e) {
    result.errors.push(e.message);
  }
  try {
    result.admin = await appendAdminFees(base44, sheets, bank, mutations);
  } catch (e) {
    result.errors.push(e.message);
  }
  return result;
}

// ── PETTY CASH: tambah baris di tab periode terbaru ────────────────────────

function latestPeriodTab(tabs, tabFormat) {
  const re = tabFormat === "month"
    ? new RegExp(`^(${MONTHS_ID.join("|")})$`)
    : new RegExp(`^(${MONTHS_ID.join("|")}) (\\d{4})$`);
  let best = null;
  let bestKey = -1;
  for (const t of tabs) {
    const m = t.title.trim().match(re);
    if (!m) continue;
    const key = (m[2] ? Number(m[2]) : 0) * 12 + MONTHS_ID.indexOf(m[1]);
    if (key > bestKey) { best = t; bestKey = key; }
  }
  return best;
}

async function appendPettyCash(sheets, target, rows) {
  const tabs = await sheets.tabs(target.spreadsheetId);
  const tab = latestPeriodTab(tabs, target.tabFormat);
  if (!tab) throw new Error(`${target.label}: tab periode (mis. "Okt 2026") tidak ditemukan`);

  const [ab] = await sheets.batchGet(target.spreadsheetId, [`${quoteTab(tab.title)}!A1:B${tab.rowCount}`]);
  const lastRow0 = Math.max(lastFilledRow(ab, 1), 0); // baris 1 = header
  const startRow0 = lastRow0 + 1;
  const endRow0 = startRow0 + rows.length;
  const lastCol = target.opsColumn ? 7 : 6;

  await sheets.batchUpdate(target.spreadsheetId, [
    ...ensureRowsRequest(tab, endRow0),
    ...copyFormatRequest(tab, lastRow0 >= 1 ? lastRow0 : -1, startRow0, endRow0, 0, lastCol),
  ]);

  const values = rows.map((r, i) => {
    const n = startRow0 + i + 1; // nomor baris sheet (1-based)
    const sisa = n === 2 ? `=C${n}-D${n}` : `=(E${n - 1}+C${n})-D${n}`;
    const row = [
      toSerial(r.date),
      r.description || "",
      r.direction === "masuk" ? r.amount : "",
      r.direction === "keluar" ? r.amount : "",
      sisa,
      r.source || "",
    ];
    if (target.opsColumn) row.push(r.is_ops ? "ops" : "");
    return row;
  });
  await sheets.batchUpdateValues(target.spreadsheetId, [
    { range: `${quoteTab(tab.title)}!A${startRow0 + 1}:${colLetter(lastCol - 1)}${endRow0}`, values },
  ]);
  return tab.title;
}

/** Kirim transaksi petty cash yang belum tercatat ke tiap spreadsheet petty cash. */
export async function syncPettyCash(base44) {
  const companies = await base44.entities.Company.list();
  const companyIds = (companies || []).filter((c) => PETTY_CASH_COMPANY_MATCH.test(c.name || "")).map((c) => c.id);
  if (companyIds.length === 0) return { results: [], errors: [] };

  const all = await filterAll(base44.entities.PettyCash, { company_id: { $in: companyIds } });
  all.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.created_date || "").localeCompare(b.created_date || ""));

  const sheets = await getSheetsClient(base44);
  const results = [];
  const errors = [];
  const syncedById = new Map(all.map((r) => [r.id, new Set(r.synced_sheets || [])]));

  for (const target of PETTY_CASH_TARGETS) {
    const pending = all.filter((r) => isNewRecord(r) && !syncedById.get(r.id).has(target.key));
    if (pending.length === 0) continue;
    try {
      const tab = await appendPettyCash(sheets, target, pending);
      pending.forEach((r) => syncedById.get(r.id).add(target.key));
      results.push({ label: target.label, tab, appended: pending.length });
    } catch (e) {
      errors.push(`${target.label}: ${e.message}`);
    }
  }

  const changed = all.filter((r) => syncedById.get(r.id).size !== (r.synced_sheets || []).length);
  await Promise.all(changed.map((r) => base44.entities.PettyCash.update(r.id, { synced_sheets: [...syncedById.get(r.id)] })));
  return { results, errors };
}

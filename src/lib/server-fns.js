import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getServerInfo = createServerFn({ method: "GET" }).handler(async () => ({
  renderedAt: new Date().toISOString(),
}));

function normalizeDate(d) {
  if (!d) return new Date().toISOString().slice(0, 10);
  const date = new Date(d);
  if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return String(d);
}

export const parseMutationFile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      file_url: z.string(),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44().asServiceRole;
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: data.file_url,
      json_schema: {
        type: "object",
        properties: {
          mutations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "Tanggal transaksi" },
                description: { type: "string", description: "Keterangan/deskripsi transaksi" },
                amount: {
                  type: "number",
                  description: "Nominal transaksi, positif untuk uang masuk/kredit, negatif untuk uang keluar/debit",
                },
                direction: {
                  type: "string",
                  description: "'masuk' untuk kredit/masuk, 'keluar' untuk debit/keluar",
                },
                balance: { type: "number", description: "Saldo setelah transaksi jika tersedia" },
              },
            },
          },
        },
      },
    });

    if (result.status === "error") {
      throw new Error(result.details || "Gagal membaca file");
    }

    const rows = result.output?.mutations || [];
    return rows.map((r) => {
      let amount = Number(r.amount) || 0;
      let direction = (r.direction || "").toLowerCase().includes("keluar")
        ? "keluar"
        : (r.direction || "").toLowerCase().includes("masuk")
          ? "masuk"
          : "";
      if (amount < 0) direction = direction || "keluar";
      if (amount > 0 && !direction) direction = "masuk";
      if (amount === 0 && !direction) direction = "masuk";
      return {
        date: normalizeDate(r.date),
        description: r.description || "",
        amount,
        direction,
        balance_after: r.balance != null ? Number(r.balance) : undefined,
      };
    });
  });

// ── Parser CSV langsung (untuk file CSV bank: BCA, BRI, Mandiri) ──────────
// Lebih andal daripada ExtractDataFromUploadedFile untuk angka: tidak ada
// risiko LLM salah baca format currency koma/titik.

function parseCsvText(text, separator) {
  const sep = separator || ",";
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === sep) { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch !== "\r") field += ch;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function parseAmount(str) {
  if (!str) return 0;
  let s = String(str).toUpperCase().replace(/CR|DR|DB/g, "").trim();
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  return parseFloat(s) || 0;
}

function parseDate(str) {
  if (!str) return new Date().toISOString().slice(0, 10);
  const s = String(str).trim();
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

const MONTHS_EN = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

function parseMandiriDate(str) {
  if (!str) return new Date().toISOString().slice(0, 10);
  const m = String(str).match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (m) {
    const mon = MONTHS_EN[m[2].toLowerCase()];
    if (mon !== undefined) return `${m[3]}-${String(mon + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return parseDate(str);
}

function detectCsvFormat(text) {
  const header = text.slice(0, 3000).toUpperCase();
  if (header.includes("NOREK") && header.includes("TGL_TRAN") && header.includes("MUTASI_DEBET")) return "bri";
  if (header.includes("ACCOUNTNO") && header.includes("POSTDATE") && header.includes("CREDIT AMOUNT")) return "mandiri";
  return "bca";
}

function extractPeriodEndDate(text) {
  const lines = text.split("\n").slice(0, 25);
  for (const line of lines) {
    const m = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:s\.?\s*d|sampai|sd|-|–)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (m) return parseDate(m[2]);
  }
  return null;
}

/** Ekstrak jam (HH:MM) dari sel tanggal, mis. "21/10/2026 00.51" → "00:51". */
function extractTime(str) {
  const m = String(str || "").match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return "";
  const h = Number(m[1]);
  if (h > 23) return "";
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

// ── BCA ────────────────────────────────────────────────────────────────────
function extractBCA(text) {
  const periodEnd = extractPeriodEndDate(text);
  const today = new Date().toISOString().slice(0, 10);
  const pendDate = periodEnd || today;

  let rows = parseCsvText(text, ",");
  rows = rows.map((row) => {
    if (row.length === 1 && row[0].includes(",")) {
      const reParsed = parseCsvText(row[0], ",");
      if (reParsed.length > 0 && reParsed[0].length > 1) return reParsed[0];
    }
    return row;
  });

  const mutations = [];
  for (const row of rows) {
    if (row.length < 3) continue;
    const firstCell = (row[0] || "").trim();
    if (firstCell.includes("No. rekening") || firstCell.includes("Nama ")) continue;
    if (firstCell.includes("Periode") || firstCell.includes("Kode Mata Uang")) continue;
    if (firstCell.includes("Informasi Rekening") || firstCell.includes("Tanggal Transaksi")) continue;
    if (firstCell.includes("Tanggal") && row.length < 4) continue;
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}/.test(firstCell) && !/^\d{4}-\d{2}-\d{2}/.test(firstCell)) continue;

    let date = parseDate(firstCell);
    const description = (row[1] || "").trim();

    // PEND → gunakan tanggal akhir periode (atau hari ini)
    if (description.toUpperCase().includes("PEND")) {
      date = pendDate;
    }

    let amountStr = "";
    let balanceStr = "";
    let direction = "";
    for (let j = 2; j < row.length; j++) {
      const cell = (row[j] || "").trim().toUpperCase();
      if (cell.includes("CR") || cell.includes("DB") || cell.includes("DR")) {
        amountStr = cell;
        direction = cell.includes("CR") ? "masuk" : "keluar";
        if (j + 1 < row.length) balanceStr = (row[j + 1] || "").trim();
        break;
      }
    }
    if (!amountStr) {
      for (let j = 2; j < row.length; j++) {
        const cell = (row[j] || "").trim();
        if (/[\d.,]+/.test(cell) && cell) { amountStr = cell; break; }
      }
    }
    if (!amountStr) continue;

    const amount = parseAmount(amountStr);
    if (amount === 0) continue;
    if (!direction) direction = amount > 0 ? "masuk" : "keluar";
    const signedAmount = direction === "keluar" ? -Math.abs(amount) : Math.abs(amount);
    const balance = balanceStr ? parseAmount(balanceStr) : undefined;

    mutations.push({ date, description, amount: signedAmount, direction, balance_after: balance, time: extractTime(firstCell) });
  }
  return mutations;
}

// ── BRI (IBIZ) ─────────────────────────────────────────────────────────────
function extractBRI(text) {
  const rows = parseCsvText(text, ",");
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some((c) => c.toUpperCase().includes("TGL_TRAN"))) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return [];
  const header = rows[headerIdx].map((h) => h.toUpperCase().trim());
  const colDate = header.indexOf("TGL_TRAN");
  const colCustom = header.indexOf("REMARK_CUSTOM");
  const colRemark = header.indexOf("TRREMK");
  const colDesk = header.indexOf("DESK_TRAN");
  const colDebet = header.indexOf("MUTASI_DEBET");
  const colKredit = header.indexOf("MUTASI_KREDIT");
  const colSaldo = header.indexOf("SALDO_AKHIR_MUTASI");

  const mutations = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;
    const dateStr = row[colDate];
    if (!dateStr || dateStr.length < 10) continue;
    const date = dateStr.slice(0, 10);
    const description = (row[colCustom] || row[colRemark] || row[colDesk] || "").trim();
    const kredit = parseAmount(row[colKredit]);
    const debet = parseAmount(row[colDebet]);
    let amount, direction;
    if (kredit > 0) { amount = kredit; direction = "masuk"; }
    else if (debet > 0) { amount = debet; direction = "keluar"; }
    else continue;
    const balance = colSaldo >= 0 ? parseAmount(row[colSaldo]) : undefined;
    const signedAmount = direction === "keluar" ? -amount : amount;
    mutations.push({ date, description, amount: signedAmount, direction, balance_after: balance, time: extractTime(dateStr) });
  }
  return mutations;
}

// ── Mandiri ────────────────────────────────────────────────────────────────
function extractMandiri(text) {
  const rows = parseCsvText(text, ";");
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colDate = header.indexOf("postdate");
  const colRemarks = header.indexOf("remarks");
  const colAddDesc = header.indexOf("additionaldesc");
  const colCredit = header.indexOf("credit amount");
  const colDebit = header.indexOf("debit amount");
  const colBalance = header.indexOf("close balance");

  const mutations = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;
    const dateStr = row[colDate];
    if (!dateStr) continue;
    const date = parseMandiriDate(dateStr);
    const description = (row[colRemarks] || row[colAddDesc] || "").trim().replace(/\s+/g, " ");
    const credit = parseAmount(row[colCredit]);
    const debit = parseAmount(row[colDebit]);
    let amount, direction;
    if (credit > 0) { amount = credit; direction = "masuk"; }
    else if (debit > 0) { amount = debit; direction = "keluar"; }
    else continue;
    const balance = colBalance >= 0 ? parseAmount(row[colBalance]) : undefined;
    const signedAmount = direction === "keluar" ? -amount : amount;
    mutations.push({ date, description, amount: signedAmount, direction, balance_after: balance, time: extractTime(dateStr) });
  }
  return mutations;
}

function extractMutationsFromCsv(text) {
  const format = detectCsvFormat(text);
  if (format === "bri") return extractBRI(text);
  if (format === "mandiri") return extractMandiri(text);
  return extractBCA(text);
}

export const parseCsvFile = createServerFn({ method: "POST" })
  .validator(z.object({ file_url: z.string() }))
  .handler(async ({ data, context }) => {
    // 1. Coba parse CSV langsung (andal untuk angka & format BCA)
    try {
      const response = await fetch(data.file_url);
      if (response.ok) {
        const text = await response.text();
        const mutations = extractMutationsFromCsv(text);
        if (mutations.length > 0) return mutations;
      }
    } catch (_e) {
      // Fall through ke LLM
    }

    // 2. Fallback: ExtractDataFromUploadedFile (untuk Excel / format non-standar)
    const base44 = context.getBase44().asServiceRole;
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: data.file_url,
      json_schema: {
        type: "object",
        properties: {
          mutations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "Tanggal transaksi" },
                description: { type: "string", description: "Keterangan/deskripsi transaksi" },
                amount: {
                  type: "number",
                  description: "Nominal transaksi, positif untuk uang masuk/kredit, negatif untuk uang keluar/debit",
                },
                direction: {
                  type: "string",
                  description: "'masuk' untuk kredit/masuk, 'keluar' untuk debit/keluar",
                },
                balance: { type: "number", description: "Saldo setelah transaksi jika tersedia" },
              },
            },
          },
        },
      },
    });

    if (result.status === "error") throw new Error(result.details || "Gagal membaca file");

    const rows = result.output?.mutations || [];
    return rows.map((r) => {
      let amount = Number(r.amount) || 0;
      let direction = (r.direction || "").toLowerCase().includes("keluar") ? "keluar"
        : (r.direction || "").toLowerCase().includes("masuk") ? "masuk" : "";
      if (amount < 0) direction = direction || "keluar";
      if (amount > 0 && !direction) direction = "masuk";
      if (amount === 0 && !direction) direction = "masuk";
      return {
        date: normalizeDate(r.date),
        description: r.description || "",
        amount,
        direction,
        balance_after: r.balance != null ? Number(r.balance) : undefined,
      };
    });
  });

// ── Impor mutasi + auto-mapping ke FinanceNote ─────────────────────────────

const MutationImportInput = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  direction: z.enum(["masuk", "keluar"]),
  balance_after: z.number().optional(),
  trans_time: z.string().optional(),
  auto_category_id: z.string().optional(),
  auto_category_name: z.string().optional(),
  auto_category_type: z.string().optional(),
});

export const importMutations = createServerFn({ method: "POST" })
  .validator(
    z.object({
      bank_account_id: z.string(),
      company_id: z.string(),
      source_file: z.string().optional().default(""),
      mutations: z.array(MutationImportInput),
    })
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();

    // 0. Dedup: buang mutasi yang sudah ada di database atau dobel di dalam file
    const keyOf = (m) =>
      [
        m.date,
        m.amount.toFixed(2),
        (m.description || "").trim().toUpperCase(),
        m.balance_after != null ? m.balance_after.toFixed(2) : "",
      ].join("|");
    const dates = data.mutations.map((m) => m.date);
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));
    let existingPage = null;
    try {
      existingPage = await base44.entities.Mutation.filter(
        { bank_account_id: data.bank_account_id, date: { $gte: minDate, $lte: maxDate } },
        { limit: 1000 }
      );
    } catch (_e) {
      // abaikan: tetap impor tanpa dedup bila query gagal
    }
    const seen = new Set(((existingPage && existingPage.items) || []).map((r) => keyOf(r)));
    const fresh = [];
    for (const m of data.mutations) {
      const k = keyOf(m);
      if (seen.has(k)) continue;
      seen.add(k);
      fresh.push(m);
    }
    const skipped = data.mutations.length - fresh.length;

    // 1. Buat semua mutasi
    const mutationRecords = fresh.map((m) => ({
      bank_account_id: data.bank_account_id,
      company_id: data.company_id,
      date: m.date,
      amount: m.amount,
      direction: m.direction,
      description: m.description,
      balance_after: m.balance_after,
      mapped: !!m.auto_category_id,
      source_file: data.source_file,
      trans_time: m.trans_time || "",
    }));

    const createdMutations = await base44.entities.Mutation.bulkCreate(mutationRecords);

    // 2. Buat FinanceNote untuk mutasi yang terpetakan otomatis
    const notesToCreate = [];
    for (let i = 0; i < createdMutations.length; i++) {
      const m = fresh[i];
      const created = createdMutations[i];
      if (m.auto_category_id) {
        notesToCreate.push({
          mutation_id: created.id,
          bank_account_id: data.bank_account_id,
          company_id: data.company_id,
          date: m.date,
          amount: m.amount,
          direction: m.direction,
          category_id: m.auto_category_id,
          category_name: m.auto_category_name || "",
          category_type: m.auto_category_type || "",
          description: m.description,
        });
      }
    }

    if (notesToCreate.length > 0) {
      await base44.entities.FinanceNote.bulkCreate(notesToCreate);
    }

    return {
      total: createdMutations.length,
      skipped,
      auto_mapped: notesToCreate.length,
      manual: createdMutations.length - notesToCreate.length,
    };
  });
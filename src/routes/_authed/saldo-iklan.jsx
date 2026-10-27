import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Megaphone, Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight, Upload, Loader2, Check } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { AdDialog } from "@/components/ads/AdDialog";

export const Route = createFileRoute("/_authed/saldo-iklan")({ component: SaldoIklanPage });

const parseAdDateTime = (s) => {
  const str = String(s || "").trim();
  const ymd = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  const t = str.match(/(\d{1,2})[:.](\d{2})/);
  const time = t ? `${t[1].padStart(2, "0")}:${t[2]}` : "";
  if (ymd) return { date: `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`, time };
  const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return { date: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, time };
};

const parseAdAmount = (s) => {
  let str = String(s ?? "").toUpperCase().replace(/RP/g, "").trim();
  if (!str) return 0;
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  if (lastComma > lastDot) str = str.replace(/\./g, "").replace(",", ".");
  else str = str.replace(/,/g, "");
  const n = parseFloat(str.replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
};

const detectAdPlatform = (desc) => {
  const d = (desc || "").toUpperCase();
  if (d.includes("FACEBK") || d.includes("FACEBOOK")) return "Meta";
  if (d.includes("TIKTOK")) return "TikTok";
  if (d.includes("GOOGLE")) return "Google";
  if (d.includes("SHOPEE")) return "Shopee";
  return "";
};

const CARD_COMPANY_RULES = [
  { pattern: "JOZZ", match: "MISTER JOZZ" },
  { pattern: "MONCER", match: "MONCER" },
  { pattern: "PANCING", match: "PARADISE" },
  { pattern: "PARADISE", match: "PARADISE" },
  { pattern: "BURUNG", match: "KICAU" },
  { pattern: "KICAU", match: "KICAU" },
  { pattern: "PUSPUS", match: "PUSPUS" },
];

const detectCardCompany = (card, companies) => {
  const c = String(card || "").toUpperCase();
  for (const rule of CARD_COMPANY_RULES) {
    if (c.includes(rule.pattern)) {
      const found = (companies || []).find((x) => (x.name || "").toUpperCase().includes(rule.match));
      if (found) return found.id;
    }
  }
  return "";
};

function SaldoIklanPage() {
  const [refs, setRefs] = useState(null);
  const [rows, setRows] = useState(null);
  const [perPlatform, setPerPlatform] = useState([]);
  const [filters, setFilters] = useState({ company_id: "", from: "", to: "" });
  const [dialog, setDialog] = useState(null);
  const [tick, setTick] = useState(0);
  const [importPanel, setImportPanel] = useState(false);
  const [importRows, setImportRows] = useState(null);
  const [importCompany, setImportCompany] = useState("");
  const [importing, setImporting] = useState(false);

  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    (async () => {
      const [companies, categories, media] = await Promise.all([
        base44.entities.Company.list(),
        base44.entities.Category.list(),
        base44.entities.TransactionType.filter({ group: "media" }),
      ]);
      setRefs({ companies: companies || [], categories: categories || [], media: media || [] });
    })();
  }, []);

  useEffect(() => {
    if (refs === null) return;
    let active = true;
    let inFlight = false;

    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const query = {};
        if (filters.company_id) query.company_id = filters.company_id;
        if (filters.from || filters.to) {
          query.date = {};
          if (filters.from) query.date.$gte = filters.from;
          if (filters.to) query.date.$lte = filters.to;
        }
        const [page, masukAgg, keluarAgg] = await Promise.all([
          base44.entities.AdBalance.filter(query, { sort: "-date", limit: 300 }),
          base44.entities.AdBalance.aggregate({ query: { ...query, direction: "masuk" }, groupBy: "platform", sum: "amount" }),
          base44.entities.AdBalance.aggregate({ query: { ...query, direction: "keluar" }, groupBy: "platform", sum: "amount" }),
        ]);
        if (!active) return;
        const map = {};
        const touch = (name) => {
          const key = name || "—";
          if (!map[key]) map[key] = { platform: key, masuk: 0, keluar: 0 };
          return map[key];
        };
        (masukAgg.rows || []).forEach((r) => { touch(r.platform).masuk = r.sum_amount || 0; });
        (keluarAgg.rows || []).forEach((r) => { touch(r.platform).keluar = r.sum_amount || 0; });
        const list = Object.values(map)
          .map((r) => ({ ...r, saldo: r.masuk - r.keluar }))
          .sort((a, b) => a.platform.localeCompare(b.platform));
        setPerPlatform(list);
        // Tampil ASC sesuai tanggal & jam impor
        setRows(
          (page.items || []).slice().sort(
            (a, b) =>
              `${a.date || ""} ${a.trans_time || ""}`.localeCompare(`${b.date || ""} ${b.trans_time || ""}`) ||
              (a.created_date || "").localeCompare(b.created_date || "")
          )
        );
      } finally {
        inFlight = false;
      }
    };

    const timer = setTimeout(load, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [filters, refs, tick]);

  const remove = async (row) => {
    if (!confirm("Hapus transaksi saldo iklan ini?")) return;
    await base44.entities.AdBalance.delete(row.id);
    toast.success("Transaksi saldo iklan dihapus");
    reload();
  };

  const handleAdImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const rows = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const lines = text.split("\n");
        if (lines.length === 0) throw new Error("File kosong");
        const header = lines[0].split(";").map((h) => h.trim().toLowerCase());
        const colDate = header.findIndex((h) => h.includes("tanggal transaksi"));
        const colDesc = header.findIndex((h) => h.includes("deskripsi"));
        const colDebit = header.findIndex((h) => h === "debit");
        const colCredit = header.findIndex((h) => h === "credit");
        const colCard = header.findIndex((h) => h === "kartu");
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(";");
          const t = parseAdDateTime(cells[colDate]);
          if (!t) continue;
          const debit = colDebit >= 0 ? parseAdAmount(cells[colDebit]) : 0;
          const credit = colCredit >= 0 ? parseAdAmount(cells[colCredit]) : 0;
          if (!debit && !credit) continue;
          rows.push({
            date: t.date,
            trans_time: t.time,
            description: (cells[colDesc] || "").trim(),
            amount: credit > 0 ? credit : debit,
            direction: credit > 0 ? "masuk" : "keluar",
            card: colCard >= 0 ? (cells[colCard] || "").trim() : "",
          });
        }
      } else {
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        for (const sheetName of wb.SheetNames) {
          const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false });
          if (!grid || grid.length === 0) continue;
          const headerIdx = grid.findIndex((row) => (row || []).some((c) => String(c || "").toLowerCase().includes("tanggal transaksi")));
          if (headerIdx === -1) continue;
          const header = grid[headerIdx].map((h) => String(h || "").trim().toLowerCase());
          const colDate = header.findIndex((h) => h.includes("tanggal transaksi"));
          const colDesc = header.findIndex((h) => h.includes("deskripsi"));
          const colDebit = header.findIndex((h) => h === "debit");
          const colCredit = header.findIndex((h) => h === "credit");
          for (let i = headerIdx + 1; i < grid.length; i++) {
            const cells = grid[i] || [];
            const t = parseAdDateTime(cells[colDate]);
            if (!t) continue;
            const debit = colDebit >= 0 ? parseAdAmount(cells[colDebit]) : 0;
            const credit = colCredit >= 0 ? parseAdAmount(cells[colCredit]) : 0;
            if (!debit && !credit) continue;
            rows.push({
              date: t.date,
              trans_time: t.time,
              description: String(cells[colDesc] || "").trim(),
              amount: credit > 0 ? credit : debit,
              direction: credit > 0 ? "masuk" : "keluar",
              card: sheetName,
            });
          }
        }
      }
      rows.sort((a, b) => `${a.date} ${a.trans_time}`.localeCompare(`${b.date} ${b.trans_time}`));
      if (rows.length === 0) { toast.error("Tidak ada baris terbaca"); return; }
      setImportRows(rows);
      setImportCompany(companies[0]?.id || "");
      toast.success(`${rows.length} baris terbaca, siap diimpor`);
    } catch (err) {
      toast.error("Gagal membaca file: " + (err.message || "error"));
    }
  };

  const runAdImport = async () => {
    if (!importRows?.length || !importCompany) return;
    setImporting(true);
    try {
      const dates = importRows.map((r) => r.date);
      const minDate = dates.reduce((a, b) => (a < b ? a : b));
      const maxDate = dates.reduce((a, b) => (a > b ? a : b));
      let existing = [];
      try {
        const page = await base44.entities.AdBalance.filter({ date: { $gte: minDate, $lte: maxDate } }, { limit: 1000 });
        existing = page.items || [];
      } catch (_e) { /* abaikan */ }
      const keyOf = (r) => [r.date, Number(r.amount).toFixed(2), (r.description || "").trim().toUpperCase(), r.card || ""].join("|");
      const seen = new Set(existing.map(keyOf));
      const fresh = [];
      for (const r of importRows) {
        const k = keyOf(r);
        if (seen.has(k)) continue;
        seen.add(k);
        fresh.push(r);
      }
      const records = fresh.map((r) => ({
        company_id: detectCardCompany(r.card, companies) || importCompany,
        date: r.date,
        trans_time: r.trans_time,
        platform: detectAdPlatform(r.description),
        direction: r.direction,
        amount: Math.abs(r.amount),
        card: r.card,
        description: r.description,
        media: "",
        parent_id: "",
        parent_name: "",
        category_id: "",
        category_name: "",
      }));
      for (let i = 0; i < records.length; i += 200) {
        await base44.entities.AdBalance.bulkCreate(records.slice(i, i + 200));
      }
      toast.success(
        `${records.length} transaksi saldo iklan diimpor${fresh.length < importRows.length ? `, ${importRows.length - fresh.length} duplikat dilewati` : ""}`
      );
      setImportRows(null);
      setImportPanel(false);
      reload();
    } catch (err) {
      toast.error("Gagal impor: " + (err.message || "error"));
    } finally {
      setImporting(false);
    }
  };

  if (refs === null || rows === null) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;
  }

  const { companies = [], categories = [], media = [] } = refs;
  const uniqueCards = importRows ? [...new Set(importRows.map((r) => r.card || "(tanpa kartu)"))] : [];
  const totalMasuk = perPlatform.reduce((s, r) => s + r.masuk, 0);
  const totalKeluar = perPlatform.reduce((s, r) => s + r.keluar, 0);
  const saldo = totalMasuk - totalKeluar;

  return (
    <div>
      <PageHeader
        title="Saldo Iklan"
        subtitle="Top up dan pemakaian saldo iklan per platform (Team Komcards)"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setImportPanel((p) => !p); setImportRows(null); }}>
              <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
            <Button onClick={() => setDialog({})}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Transaksi
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Perusahaan</label>
          <Select value={filters.company_id || "all"} onValueChange={(v) => setFilters({ ...filters, company_id: v === "all" ? "" : v })}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Dari</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="h-9 rounded-lg border bg-white px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Sampai</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="h-9 rounded-lg border bg-white px-3 text-sm" />
        </div>
      </div>

      {importPanel && (
        <div className="mb-4 space-y-4 rounded-xl border bg-white p-5">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">File Rincian Mutasi (XLSX multi-sheet atau CSV)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleAdImportFile}
              className="text-sm file:mr-3 file:rounded-lg file:border file:border-input file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Semua sheet digabung jadi satu dan diurut ASC sesuai tanggal &amp; jam. Kartu diambil dari nama sheet.
            </p>
          </div>
          {importRows && (
            <>
              <div>
                <p className="text-sm font-medium">
                  {importRows.length} baris dari {uniqueCards.length} kartu, siap diimpor
                </p>
                <div className="mt-1.5 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                  {uniqueCards.map((c) => (
                    <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{c}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Perusahaan jika kartu tidak terdeteksi otomatis</label>
                  <Select value={importCompany || "none"} onValueChange={(v) => setImportCompany(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={runAdImport} disabled={importing || !importCompany}>
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Impor {importRows.length} Transaksi
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total Top Up</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ArrowUpRight className="h-5 w-5" /></div>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(totalMasuk)}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Pemakaian Iklan</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500"><ArrowDownRight className="h-5 w-5" /></div>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(totalKeluar)}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Saldo Iklan</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Megaphone className="h-5 w-5" /></div>
          </div>
          <p className={`mt-3 text-2xl font-semibold tabular-nums ${saldo < 0 ? "text-rose-500" : "text-emerald-600"}`}>{formatCurrency(saldo)}</p>
        </div>
      </div>

      {perPlatform.length > 0 && (
        <div className="mb-6 rounded-xl border bg-white">
          <div className="border-b px-5 py-4">
            <h2 className="text-base font-semibold">Saldo per Platform</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead className="text-right">Top Up</TableHead>
                <TableHead className="text-right">Pemakaian</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perPlatform.map((r) => (
                <TableRow key={r.platform}>
                  <TableCell className="text-sm font-medium">{r.platform}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-emerald-600">{formatCurrency(r.masuk)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-rose-500">{formatCurrency(r.keluar)}</TableCell>
                  <TableCell className={`text-right text-sm font-semibold tabular-nums ${r.saldo < 0 ? "text-rose-500" : "text-emerald-600"}`}>
                    {formatCurrency(r.saldo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Megaphone} title="Belum ada transaksi saldo iklan" description="Catat top up dan pemakaian saldo iklan untuk melihat saldonya." />
      ) : (
        <div className="rounded-xl border bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Tanggal</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Kartu</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Media</TableHead>
                  <TableHead>Kode Biaya</TableHead>
                  <TableHead>Sub Biaya</TableHead>
                  <TableHead className="text-right">Top Up</TableHead>
                  <TableHead className="text-right">Pemakaian</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">{formatDate(row.date)}</TableCell>
                    <TableCell className="text-sm font-medium">{row.platform || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.card || "—"}</TableCell>
                    <TableCell className="text-sm">{row.description || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.media || "—"}</TableCell>
                    <TableCell className="text-sm">{row.parent_name || "—"}</TableCell>
                    <TableCell className="text-sm">{row.category_name || "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-emerald-600">
                      {row.direction === "masuk" ? formatCurrency(row.amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-rose-500">
                      {row.direction === "keluar" ? formatCurrency(row.amount) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(row)}>
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <AdDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        companies={companies}
        categories={categories}
        mediaList={media}
        initial={dialog && dialog.id ? dialog : null}
        onSaved={reload}
      />
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, TrendingDown, Wallet, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authed/arus-kas")({ component: ArusKasPage });

/** Ambil nilai bucket bulan dari baris hasil agregasi. */
function bucketOf(row) {
  const key = Object.keys(row).find(
    (k) => k !== "count" && !k.startsWith("sum_") && !k.startsWith("avg_") && !k.startsWith("min_") && !k.startsWith("max_")
  );
  return key ? String(row[key] || "") : "";
}

function monthLabel(key) {
  const d = new Date(`${key}-01T00:00:00Z`);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
}

function ArusKasPage() {
  const [companies, setCompanies] = useState(null);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ company_id: "", from: "", to: "" });
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    (async () => {
      const [c, cats] = await Promise.all([
        base44.entities.Company.list(),
        base44.entities.Category.list(),
      ]);
      setCompanies(c || []);
      setCategories(cats || []);
    })();
  }, []);

  useEffect(() => {
    if (companies === null) return;
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
        const [masukAgg, keluarAgg, catAgg] = await Promise.all([
          base44.entities.FinanceNote.aggregate({
            query: { ...query, direction: "masuk" },
            dateBucket: { field: "date", unit: "month" },
            sum: "amount",
          }),
          base44.entities.FinanceNote.aggregate({
            query: { ...query, direction: "keluar" },
            dateBucket: { field: "date", unit: "month" },
            sum: "amount",
          }),
          base44.entities.FinanceNote.aggregate({ query, groupBy: "category_id", sum: "amount" }),
        ]);
        if (!active) return;

        const months = {};
        const push = (rows, dir) => {
          (rows || []).forEach((r) => {
            const key = bucketOf(r).slice(0, 7);
            if (key.length !== 7) return;
            if (!months[key]) months[key] = { key, masuk: 0, keluar: 0 };
            months[key][dir] += Math.abs(r.sum_amount || 0);
          });
        };
        push(masukAgg.rows, "masuk");
        push(keluarAgg.rows, "keluar");

        const monthly = Object.values(months).sort((a, b) => (a.key < b.key ? 1 : -1));
        setState({ loading: false, monthly, catRows: catAgg.rows || [] });
      } catch (e) {
        if (active) setState({ loading: false, monthly: [], catRows: [] });
      } finally {
        inFlight = false;
      }
    };

    const timer = setTimeout(load, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [filters, companies]);

  if (companies === null || state.loading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;
  }

  const { monthly = [], catRows = [] } = state;

  const categoryMap = {};
  categories.forEach((c) => { categoryMap[c.id] = c; });

  const kodeMap = {};
  catRows.forEach((r) => {
    const cat = categoryMap[r.category_id];
    const id = cat ? (cat.parent_id || cat.id) : "lain";
    const name = cat ? (cat.parent_id ? (categoryMap[cat.parent_id]?.name || "Lainnya") : cat.name) : "Lainnya";
    if (!kodeMap[id]) kodeMap[id] = { id, name, net: 0 };
    kodeMap[id].net += r.sum_amount || 0;
  });
  const kodeRows = Object.values(kodeMap).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const totalMasuk = monthly.reduce((s, m) => s + m.masuk, 0);
  const totalKeluar = monthly.reduce((s, m) => s + m.keluar, 0);
  const net = totalMasuk - totalKeluar;

  const exportCsv = () => {
    const headers = ["Periode", "Arus Kas Masuk", "Arus Kas Keluar", "Arus Kas Bersih"];
    const rows = monthly.map((m) => [
      monthLabel(m.key),
      m.masuk.toFixed(2),
      m.keluar.toFixed(2),
      (m.masuk - m.keluar).toFixed(2),
    ]);
    const kodeHeaders = ["Kode Biaya", "Arus Kas Bersih"];
    const kodeCsv = kodeRows.map((k) => [k.name.replace(/;/g, ","), k.net.toFixed(2)]);
    const csv = [headers, ...rows, [], kodeHeaders, ...kodeCsv]
      .map((r) => r.map((c) => String(c)).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-arus-kas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Laporan Arus Kas"
        subtitle="Arus kas masuk & keluar dari catatan finance"
        action={
          <Button variant="outline" onClick={exportCsv} disabled={monthly.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export Excel
          </Button>
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Arus Kas Masuk</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><TrendingUp className="h-5 w-5" /></div>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(totalMasuk)}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Arus Kas Keluar</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500"><TrendingDown className="h-5 w-5" /></div>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(totalKeluar)}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Arus Kas Bersih</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Wallet className="h-5 w-5" /></div>
          </div>
          <p className={`mt-3 text-2xl font-semibold tabular-nums ${net < 0 ? "text-rose-500" : "text-emerald-600"}`}>
            {formatCurrency(net)}
          </p>
        </div>
      </div>

      {monthly.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Belum ada arus kas" description="Petakan mutasi ke kategori untuk melihat laporan arus kas." />
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white">
            <div className="border-b px-5 py-4">
              <h2 className="text-base font-semibold">Arus Kas per Bulan</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Kas Masuk</TableHead>
                  <TableHead className="text-right">Kas Keluar</TableHead>
                  <TableHead className="text-right">Arus Kas Bersih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthly.map((m) => {
                  const mNet = m.masuk - m.keluar;
                  return (
                    <TableRow key={m.key}>
                      <TableCell className="text-sm font-medium">{monthLabel(m.key)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-emerald-600">{formatCurrency(m.masuk)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-rose-500">{formatCurrency(m.keluar)}</TableCell>
                      <TableCell className={`text-right text-sm font-semibold tabular-nums ${mNet < 0 ? "text-rose-500" : "text-emerald-600"}`}>
                        {formatCurrency(mNet)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {kodeRows.length > 0 && (
            <div className="rounded-xl border bg-white">
              <div className="border-b px-5 py-4">
                <h2 className="text-base font-semibold">Arus Kas per Kode Biaya</h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode Biaya</TableHead>
                    <TableHead className="text-right">Arus Kas Bersih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kodeRows.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="text-sm font-medium">{k.name}</TableCell>
                      <TableCell className={`text-right text-sm font-semibold tabular-nums ${k.net < 0 ? "text-rose-500" : "text-emerald-600"}`}>
                        {formatCurrency(k.net)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
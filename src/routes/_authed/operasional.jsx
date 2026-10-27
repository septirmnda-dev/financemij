import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Wallet, TrendingDown, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { sumberOf, teamOf } from "@/lib/sources";

export const Route = createFileRoute("/_authed/operasional")({ component: OperasionalPage });

function OperasionalPage() {
  const [refs, setRefs] = useState(null);
  const [state, setState] = useState({ loading: true });
  const [filters, setFilters] = useState({ company_id: "", from: "", to: "" });

  useEffect(() => {
    (async () => {
      const [companies, banks, categories] = await Promise.all([
        base44.entities.Company.list(),
        base44.entities.BankAccount.list(),
        base44.entities.Category.list(),
      ]);
      setRefs({ companies: companies || [], banks: banks || [], categories: categories || [] });
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
        // Hanya catatan yang ditandai OPS / Plot OPS yang masuk Operasional
        const noteQuery = { is_ops: true };
        const cashQuery = { direction: "keluar" };
        const adQuery = { direction: "keluar" };

        if (filters.company_id) {
          noteQuery.company_id = filters.company_id;
          cashQuery.company_id = filters.company_id;
          adQuery.company_id = filters.company_id;
        }
        if (filters.from || filters.to) {
          noteQuery.date = {};
          cashQuery.date = {};
          adQuery.date = {};
          if (filters.from) {
            noteQuery.date.$gte = filters.from;
            cashQuery.date.$gte = filters.from;
            adQuery.date.$gte = filters.from;
          }
          if (filters.to) {
            noteQuery.date.$lte = filters.to;
            cashQuery.date.$lte = filters.to;
            adQuery.date.$lte = filters.to;
          }
        }

        const [notesResult, catAgg, cashResult, adResult] = await Promise.all([
          base44.entities.FinanceNote.filter(noteQuery, { sort: "-date", limit: 300 }),
          base44.entities.FinanceNote.aggregate({ query: noteQuery, groupBy: "category_id", sum: "amount" }),
          base44.entities.PettyCash.filter(cashQuery, { sort: "-date", limit: 300 }),
          base44.entities.AdBalance.filter(adQuery, { sort: "-date", limit: 300 }),
        ]);
        if (!active) return;

        const categoryMap = {};
        refs.categories.forEach((c) => { categoryMap[c.id] = c; });
        const companyMap = {};
        refs.companies.forEach((c) => { companyMap[c.id] = c; });

        const kodeOf = (id) => {
          const cat = categoryMap[id];
          if (!cat) return "—";
          return cat.parent_id ? (categoryMap[cat.parent_id]?.name || "—") : cat.name;
        };

        const noteRows = (notesResult.items || []).map((n) => ({
          id: n.id,
          date: n.date,
          description: n.description || n.category_name || "—",
          kodeBiaya: kodeOf(n.category_id),
          subBiaya: n.category_name || "—",
          media: n.media || "",
          team: teamOf("bank"),
          sumber: sumberOf(companyMap[n.company_id]?.name),
          amount: Math.abs(n.amount || 0),
        }));

        const cashRows = (cashResult.items || []).map((p) => ({
          id: `cash-${p.id}`,
          date: p.date,
          description: p.description || p.category_name || "Kas kecil",
          kodeBiaya: p.parent_name || "—",
          subBiaya: p.category_name || "—",
          media: "",
          team: teamOf("pettycash"),
          sumber: sumberOf(companyMap[p.company_id]?.name),
          amount: Math.abs(p.amount || 0),
        }));

        const adRows = (adResult.items || []).map((a) => ({
          id: `ads-${a.id}`,
          date: a.date,
          description: a.description || a.platform || "Iklan",
          kodeBiaya: a.parent_name || "—",
          subBiaya: a.category_name || "—",
          media: a.media || "",
          team: teamOf("ads"),
          sumber: sumberOf(companyMap[a.company_id]?.name),
          amount: Math.abs(a.amount || 0),
        }));

        const rows = [...noteRows, ...cashRows, ...adRows]
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

        const totals = {};
        const addTotal = (name, amount) => {
          const key = name || "—";
          totals[key] = (totals[key] || 0) + Math.abs(amount || 0);
        };
        (catAgg.rows || []).forEach((r) => addTotal(kodeOf(r.category_id), r.sum_amount));
        cashRows.forEach((r) => addTotal(r.kodeBiaya, r.amount));
        adRows.forEach((r) => addTotal(r.kodeBiaya, r.amount));

        const categoryTotals = Object.entries(totals)
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total);
        const grandTotal = categoryTotals.reduce((s, c) => s + c.total, 0);

        setState({ loading: false, rows, categoryTotals, grandTotal });
      } catch (e) {
        if (active) setState({ loading: false, rows: [], categoryTotals: [], grandTotal: 0 });
      } finally {
        inFlight = false;
      }
    };

    const timer = setTimeout(load, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [filters, refs]);

  if (refs === null || state.loading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;
  }

  const { companies } = refs;
  const { rows = [], categoryTotals = [], grandTotal = 0 } = state;

  const exportCsv = () => {
    const headers = ["Tanggal", "Keterangan", "Kode Biaya", "Sub Biaya", "Media", "Jumlah Item", "Harga Satuan", "Total", "Ket.", "Team", "Sumber", "Nominal"];
    const csvRows = rows.map((r) => [
      r.date || "",
      (r.description || "").replace(/;/g, ","),
      (r.kodeBiaya || "").replace(/;/g, ","),
      (r.subBiaya || "").replace(/;/g, ","),
      (r.media || "").replace(/;/g, ","),
      1,
      Number(r.amount || 0).toFixed(2),
      "",
      "",
      r.team,
      r.sumber,
      Number(r.amount || 0).toFixed(2),
    ]);
    const csv = [headers, ...csvRows].map((r) => r.map((c) => String(c)).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-operasional-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Laporan Operasional"
        subtitle="Pengeluaran operasional dari mutasi bank (OPS/Plot OPS), petty cash & saldo iklan"
        action={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export Excel
          </Button>
        }
      />

      <div className="sticky top-0 z-20 bg-background mb-4 flex flex-wrap items-end gap-3 pb-2">
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total Operasional</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500"><TrendingDown className="h-5 w-5" /></div>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(grandTotal)}</p>
        </div>
        {categoryTotals.slice(0, 3).map((c) => (
          <div key={c.name} className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm text-muted-foreground">{c.name}</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Wallet className="h-5 w-5" /></div>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(c.total)}</p>
          </div>
        ))}
      </div>

      {categoryTotals.length > 0 && (
        <div className="mb-6 rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-base font-semibold">Rincian per Kode Biaya</h2>
          <div className="space-y-2">
            {categoryTotals.map((c) => {
              const pct = grandTotal > 0 ? (c.total / grandTotal) * 100 : 0;
              return (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 text-sm font-medium">{c.name}</div>
                  <div className="h-6 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-rose-400" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-32 shrink-0 text-right text-sm font-semibold tabular-nums">{formatCurrency(c.total)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Belum ada data operasional"
          description="Tandai OPS atau Plot OPS pada pemetaan mutasi, atau catat pemakaian Petty Cash / Saldo Iklan."
        />
      ) : (
        <div className="rounded-xl border bg-white">
          <div className="border-b px-5 py-4">
            <h2 className="text-base font-semibold">Detail Catatan Operasional</h2>
          </div>
          <div className="max-h-[65vh] overflow-y-auto [&>div]:overflow-visible">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white [&_th]:bg-white">
                <TableRow>
                  <TableHead className="w-28">Tanggal</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Kode Biaya</TableHead>
                  <TableHead>Sub Biaya</TableHead>
                  <TableHead>Media</TableHead>
                  <TableHead className="text-right">Jumlah Item</TableHead>
                  <TableHead className="text-right">Harga Satuan</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Ket.</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell className="text-sm">{r.kodeBiaya}</TableCell>
                    <TableCell className="text-sm font-medium">{r.subBiaya}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.media || "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">1</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatCurrency(r.amount)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatCurrency(r.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    <TableCell className="text-sm">{r.team}</TableCell>
                    <TableCell className="text-sm">{r.sumber || "—"}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums text-rose-500">{formatCurrency(r.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
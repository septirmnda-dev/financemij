import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Percent, FileSpreadsheet, Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { downloadXlsx } from "@/lib/exportXlsx";
import { sumberOf } from "@/lib/sources";

export const Route = createFileRoute("/_authed/ppn-masukan")({ component: PpnMasukanPage });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const monthLabel = (ym) => {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1] || m} ${y}`;
};

function PpnMasukanPage() {
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
        const query = { has_ppn: true };
        if (filters.company_id) query.company_id = filters.company_id;
        if (filters.from || filters.to) {
          query.date = {};
          if (filters.from) query.date.$gte = filters.from;
          if (filters.to) query.date.$lte = filters.to;
        }
        const [page, agg, monthAgg] = await Promise.all([
          base44.entities.FinanceNote.filter(query, { sort: "-date", limit: 300 }),
          base44.entities.FinanceNote.aggregate({ query, sum: ["ppn_amount", "amount"] }),
          base44.entities.FinanceNote.aggregate({
            query,
            dateBucket: { field: "date", unit: "month" },
            sum: ["ppn_amount"],
          }),
        ]);
        if (!active) return;
        const row = agg.rows?.[0] || {};
        setState({
          loading: false,
          rows: page.items || [],
          totalPpn: row.sum_ppn_amount || 0,
          totalGross: Math.abs(row.sum_amount || 0),
          count: row.count || 0,
          months: (monthAgg.rows || []).map((r) => ({ key: String(r.date).slice(0, 7), ppn: r.sum_ppn_amount || 0, count: r.count || 0 })),
        });
      } catch (e) {
        if (active) setState({ loading: false, rows: [], totalPpn: 0, totalGross: 0, count: 0, months: [] });
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

  const { companies, banks, categories } = refs;
  const { rows = [], totalPpn = 0, totalGross = 0, count = 0, months = [] } = state;
  const bankMap = {};
  banks.forEach((b) => { bankMap[b.id] = b; });
  const companyMap = {};
  companies.forEach((c) => { companyMap[c.id] = c; });
  const parentNameOf = (id) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return "";
    return cat.parent_id ? (categories.find((c) => c.id === cat.parent_id)?.name || "") : cat.name;
  };
  // DPP = nominal catatan dikurangi PPN
  const dppOf = (n) => Math.max(0, Math.abs(n.amount || 0) - (n.ppn_amount || 0));

  const exportXlsx = () => {
    downloadXlsx({
      filename: `ppn-masukan-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: "PPN Masukan",
      headers: ["Tanggal", "Sumber", "Perusahaan", "Bank", "Keterangan", "Kode Biaya", "Sub Biaya", "Media", "DPP", "PPN", "Total"],
      rows: rows
        .slice()
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
        .map((n) => {
          const bank = bankMap[n.bank_account_id];
          const company = companyMap[n.company_id]?.name || "";
          return [
            n.date || "", sumberOf(company), company,
            bank ? `${bank.bank_name} - ${bank.account_number}` : "",
            n.description || "", parentNameOf(n.category_id), n.category_name || "", n.media || "",
            dppOf(n), n.ppn_amount || 0, Math.abs(n.amount || 0),
          ];
        }),
    });
  };

  return (
    <div>
      <PageHeader
        title="PPN Masukan"
        subtitle="Daftar PPN dari catatan pengeluaran yang sudah dipetakan"
        action={
          <Button variant="outline" onClick={exportXlsx} disabled={rows.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
          </Button>
        }
      />

      <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-end gap-3 bg-background pb-2">
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

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total PPN Masukan</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600"><Percent className="h-5 w-5" /></div>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(totalPpn)}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total DPP</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Receipt className="h-5 w-5" /></div>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(Math.max(0, totalGross - totalPpn))}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-muted-foreground">Jumlah Transaksi PPN</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{count}</p>
        </div>
      </div>

      {months.length > 0 && (
        <div className="mb-6 rounded-xl border bg-white p-5">
          <h2 className="mb-3 text-base font-semibold">Rekap PPN per Bulan</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {months.slice().sort((a, b) => b.key.localeCompare(a.key)).map((m) => (
              <div key={m.key} className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">{monthLabel(m.key)} · {m.count} transaksi</p>
                <p className="text-sm font-semibold tabular-nums">{formatCurrency(m.ppn)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="Belum ada PPN Masukan"
          description="Centang PPN dan isi nominalnya saat memetakan mutasi uang keluar."
        />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto rounded-xl border bg-white [&>div]:overflow-visible">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white [&_th]:bg-white">
              <TableRow>
                <TableHead className="w-28">Tanggal</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Kode Biaya / Sub Biaya</TableHead>
                <TableHead>Media</TableHead>
                <TableHead className="text-right">DPP</TableHead>
                <TableHead className="text-right">PPN</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((n) => {
                const company = companyMap[n.company_id]?.name || "";
                return (
                  <TableRow key={n.id}>
                    <TableCell className="text-sm">{formatDate(n.date)}</TableCell>
                    <TableCell className="text-xs font-medium">{sumberOf(company) || "—"}</TableCell>
                    <TableCell className="text-sm">{company || "—"}</TableCell>
                    <TableCell className="text-sm">
                      <Link to="/mutasi/$id" params={{ id: n.mutation_id }} className="hover:underline">{n.description || "Lihat mutasi"}</Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="block text-xs text-muted-foreground">{parentNameOf(n.category_id)}</span>
                      {n.category_name || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{n.media || "—"}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatCurrency(dppOf(n))}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums text-purple-700">{formatCurrency(n.ppn_amount || 0)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
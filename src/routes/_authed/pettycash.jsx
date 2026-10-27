import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Coins, Plus, Pencil, Trash2, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { PettyCashDialog } from "@/components/pettycash/PettyCashDialog";
import { downloadXlsx } from "@/lib/exportXlsx";

export const Route = createFileRoute("/_authed/pettycash")({ component: PettyCashPage });

function PettyCashPage() {
  const [refs, setRefs] = useState(null);
  const [rows, setRows] = useState(null);
  const [filters, setFilters] = useState({ company_id: "", from: "", to: "" });
  const [dialog, setDialog] = useState(null);
  const [tick, setTick] = useState(0);

  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    (async () => {
      const [companies, categories] = await Promise.all([
        base44.entities.Company.list(),
        base44.entities.Category.list(),
      ]);
      setRefs({ companies: companies || [], categories: categories || [] });
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
        // Ambil semua transaksi untuk hitung Sisa Uang (saldo berjalan) per perusahaan
        const page = await base44.entities.PettyCash.list({ sort: "-date", limit: 1000 });
        if (!active) return;
        setRows(page.items || []);
      } finally {
        inFlight = false;
      }
    };

    const timer = setTimeout(load, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [refs, tick]);

  const remove = async (row) => {
    if (!confirm("Hapus transaksi kas ini?")) return;
    await base44.entities.PettyCash.delete(row.id);
    toast.success("Transaksi kas dihapus");
    reload();
  };

  if (refs === null || rows === null) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;
  }

  const { companies = [], categories = [] } = refs;
  const companyMap = {};
  companies.forEach((c) => { companyMap[c.id] = c; });

  // Saldo berjalan (Sisa Uang) per perusahaan, urut kronologis
  const sisaMap = {};
  const asc = rows.slice().sort(
    (a, b) => (a.date || "").localeCompare(b.date || "") || (a.created_date || "").localeCompare(b.created_date || "")
  );
  {
    let running = 0;
    let lastCompany = null;
    asc.forEach((r) => {
      if (r.company_id !== lastCompany) { running = 0; lastCompany = r.company_id; }
      running += (r.direction === "masuk" ? 1 : -1) * (r.amount || 0);
      sisaMap[r.id] = running;
    });
  }

  // Tampilan sesuai template: urut naik sesuai tanggal
  const visible = asc.filter((r) => {
    if (filters.company_id && r.company_id !== filters.company_id) return false;
    if (filters.from && r.date < filters.from) return false;
    if (filters.to && r.date > filters.to) return false;
    return true;
  });
  const totals = visible.reduce(
    (t, r) => { t[r.direction === "masuk" ? "masuk" : "keluar"] += r.amount || 0; return t; },
    { masuk: 0, keluar: 0 }
  );
  const saldo = totals.masuk - totals.keluar;

  const exportXlsx = () => {
    downloadXlsx({
      filename: `petty-cash-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: "Petty Cash",
      headers: ["Tanggal", "Keterangan", "Uang Masuk", "Uang Keluar", "Sisa Uang", "Jenis Uang", "Operasional", "Kode Biaya", "Sub Biaya", "Perusahaan"],
      rows: visible.map((r) => [
        r.date || "",
        r.description || "",
        r.direction === "masuk" ? Number(r.amount || 0) : "",
        r.direction === "keluar" ? Number(r.amount || 0) : "",
        Number(sisaMap[r.id] || 0),
        r.source || "",
        r.is_ops ? "ops" : "",
        r.parent_name || "",
        r.category_name || "",
        companyMap[r.company_id]?.name || "",
      ]),
    });
  };

  return (
    <div>
      <PageHeader
        title="Petty Cash"
        subtitle="Kas kecil — pengisian dan pemakaian kas tunai"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportXlsx} disabled={visible.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export Excel
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Pengisian Kas</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ArrowUpRight className="h-5 w-5" /></div>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(totals.masuk || 0)}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Pemakaian Kas</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500"><ArrowDownRight className="h-5 w-5" /></div>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(totals.keluar || 0)}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Saldo Kas</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Coins className="h-5 w-5" /></div>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatCurrency(saldo)}</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Coins} title="Belum ada transaksi kas" description="Catat pengisian dan pemakaian kas kecil di sini." />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto rounded-xl border bg-white [&>div]:overflow-visible">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white [&_th]:bg-white">
              <TableRow>
                <TableHead className="w-28">Tanggal</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Uang Masuk</TableHead>
                <TableHead className="text-right">Uang Keluar</TableHead>
                <TableHead className="text-right">Sisa Uang</TableHead>
                <TableHead className="w-32">Jenis Uang</TableHead>
                <TableHead className="w-28">Operasional</TableHead>
                <TableHead>Kode Biaya / Sub Biaya</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{formatDate(row.date)}</TableCell>
                  <TableCell className="text-sm">{row.description || "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-emerald-600">
                    {row.direction === "masuk" ? formatCurrency(row.amount) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-rose-500">
                    {row.direction === "keluar" ? formatCurrency(row.amount) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(sisaMap[row.id] || 0)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.source || "—"}</TableCell>
                  <TableCell className="text-sm">{row.is_ops ? <span className="text-xs text-muted-foreground">ops</span> : ""}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.parent_name ? <span className="block text-xs">{row.parent_name}</span> : null}
                    {row.category_name || "—"}
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
      )}

      <PettyCashDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        companies={companies}
        categories={categories}
        initial={dialog && dialog.id ? dialog : null}
        onSaved={reload}
      />
    </div>
  );
}
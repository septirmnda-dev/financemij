import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { downloadXlsx } from "@/lib/exportXlsx";
import { sumberOf } from "@/lib/sources";

export const Route = createFileRoute("/_authed/catatan")({ component: CatatanPage });

function CatatanPage() {
  const [refs, setRefs] = useState(null);
  const [notes, setNotes] = useState(null);
  const [filters, setFilters] = useState({ company_id: "", parent_id: "", category_id: "", from: "", to: "" });
  const [selected, setSelected] = useState({});

  useEffect(() => {
    (async () => {
      const [banks, companies, categories] = await Promise.all([
        base44.entities.BankAccount.list(),
        base44.entities.Company.list(),
        base44.entities.Category.list(),
      ]);
      setRefs({ banks: banks || [], companies: companies || [], categories: categories || [] });
    })();
  }, []);

  useEffect(() => {
    if (!refs) return;
    let active = true;
    setSelected({});
    (async () => {
      const query = {};
      if (filters.company_id) query.company_id = filters.company_id;
      if (filters.category_id) {
        query.category_id = filters.category_id;
      } else if (filters.parent_id) {
        const subIds = refs.categories.filter((c) => c.parent_id === filters.parent_id).map((c) => c.id);
        query.category_id = { $in: subIds.length > 0 ? subIds : [filters.parent_id] };
      }
      if (filters.from || filters.to) {
        query.date = {};
        if (filters.from) query.date.$gte = filters.from;
        if (filters.to) query.date.$lte = filters.to;
      }
      try {
        const result = await base44.entities.FinanceNote.filter(query, { sort: "-date", limit: 300 });
        if (active) setNotes(result.items || []);
      } catch (e) {
        if (active) setNotes([]);
      }
    })();
    return () => { active = false; };
  }, [filters, refs]);

  if (refs === null) return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;

  const { banks = [], companies = [], categories = [] } = refs;

  const bankMap = {};
  banks.forEach((b) => { bankMap[b.id] = b; });
  const companyMap = {};
  companies.forEach((c) => { companyMap[c.id] = c; });

  const kodeBiayaList = categories.filter((c) => !c.parent_id);
  const subBiayaList = categories.filter((c) => c.parent_id && (!filters.parent_id || c.parent_id === filters.parent_id));
  const parentNameOf = (id) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return "—";
    return cat.parent_id ? (categories.find((c) => c.id === cat.parent_id)?.name || "—") : cat.name;
  };

  const selectedRows = (notes || []).filter((n) => selected[n.id]);
  const allSelected = (notes || []).length > 0 && selectedRows.length === notes.length;

  const exportSelected = () => {
    if (selectedRows.length === 0) { toast.error("Centang data yang mau di-export dulu"); return; }
    downloadXlsx({
      filename: `catatan-finance-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: "Catatan Finance",
      headers: ["Tanggal", "Sumber", "Perusahaan", "Bank", "Keterangan", "Kode Biaya", "Sub Biaya", "Media", "PPN", "Nominal"],
      rows: selectedRows
        .slice()
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
        .map((n) => {
          const bank = bankMap[n.bank_account_id];
          const company = companyMap[n.company_id]?.name || "";
          return [
            n.date || "",
            sumberOf(company),
            company,
            bank ? `${bank.bank_name} - ${bank.account_number}` : "",
            n.description || "",
            parentNameOf(n.category_id),
            n.category_name || "",
            n.media || "",
            n.has_ppn ? Number(n.ppn_amount || 0) : "",
            Math.abs(n.amount || 0),
          ];
        }),
    });
  };

  return (
    <div>
      <PageHeader
        title="Catatan Finance"
        subtitle="Semua catatan pemetaan mutasi ke Kode Biaya & Sub Biaya"
        action={
          <Button variant="outline" onClick={exportSelected} disabled={selectedRows.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export Excel ({selectedRows.length})
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
          <label className="mb-1 block text-xs text-muted-foreground">Jenis (Kode Biaya)</label>
          <Select
            value={filters.parent_id || "all"}
            onValueChange={(v) => setFilters({ ...filters, parent_id: v === "all" ? "" : v, category_id: "" })}
          >
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {kodeBiayaList.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Jenis Transaksi (Sub Biaya)</label>
          <Select value={filters.category_id || "all"} onValueChange={(v) => setFilters({ ...filters, category_id: v === "all" ? "" : v })}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {subBiayaList.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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

      {notes === null ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>
      ) : notes.length === 0 ? (
        <EmptyState icon={FileText} title="Belum ada catatan" description="Petakan mutasi ke kategori untuk membuat catatan finance." />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto rounded-xl border bg-white [&>div]:overflow-visible">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white [&_th]:bg-white">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => {
                      if (v) {
                        const all = {};
                        notes.forEach((n) => { all[n.id] = true; });
                        setSelected(all);
                      } else {
                        setSelected({});
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="w-28">Tanggal</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Kode Biaya / Sub Biaya</TableHead>
                <TableHead>Media</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((n) => {
                const bank = bankMap[n.bank_account_id];
                return (
                  <TableRow key={n.id} data-state={selected[n.id] ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={!!selected[n.id]}
                        onCheckedChange={(v) => setSelected((prev) => ({ ...prev, [n.id]: v ? true : false }))}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(n.date)}</TableCell>
                    <TableCell className="text-xs font-medium">{sumberOf(companyMap[n.company_id]?.name) || "—"}</TableCell>
                    <TableCell className="text-sm">
                      <span className="block text-xs text-muted-foreground">{parentNameOf(n.category_id)}</span>
                      {n.category_name || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{n.media || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {n.description || "—"}
                      {n.has_ppn ? <span className="ml-1.5 text-xs text-purple-600">PPN {formatCurrency(n.ppn_amount || 0)}</span> : null}
                    </TableCell>
                    <TableCell className="text-right"><Amount value={n.amount} /></TableCell>
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
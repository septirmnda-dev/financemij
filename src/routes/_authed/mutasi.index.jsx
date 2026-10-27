import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Receipt, ArrowUpRight, ArrowDownRight, Filter, Pencil, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { Amount } from "@/components/Amount";
import { MutationMapDialog } from "@/components/mutasi/MutationMapDialog";

export const Route = createFileRoute("/_authed/mutasi/")({ component: MutasiPage });

/** Urut tampil: tanggal terbaru di atas, jam terbaru di atas (sesuai urutan data impor). */
const sortByNewest = (items) =>
  (items || []).slice().sort(
    (a, b) => (b.date || "").localeCompare(a.date || "") || (b.trans_time || "").localeCompare(a.trans_time || "")
  );

function MutasiPage() {
  const navigate = useNavigate();
  const [banks, setBanks] = useState(null);
  const [companies, setCompanies] = useState(null);
  const [mutations, setMutations] = useState(null);
  const [filters, setFilters] = useState({ company_id: "", bank_account_id: "", direction: "", mapped: "", date_from: "", date_to: "", search: "" });
  const [editMutation, setEditMutation] = useState(null);

  useEffect(() => {
    (async () => {
      const [b, c] = await Promise.all([
        base44.entities.BankAccount.list(),
        base44.entities.Company.list(),
      ]);
      setBanks(b || []);
      setCompanies(c || []);
    })();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const query = {};
      if (filters.company_id) query.company_id = filters.company_id;
      if (filters.bank_account_id) query.bank_account_id = filters.bank_account_id;
      if (filters.direction) query.direction = filters.direction;
      if (filters.mapped === "mapped") query.mapped = true;
      if (filters.mapped === "unmapped") query.mapped = false;
      if (filters.date_from || filters.date_to) {
        query.date = {};
        if (filters.date_from) query.date.$gte = filters.date_from;
        if (filters.date_to) query.date.$lte = filters.date_to;
      }
      if (filters.search) query.description = { $regex: filters.search, $options: "i" };
      try {
        const page = await base44.entities.Mutation.filter(query, { sort: "-date", limit: 200 });
        if (active) setMutations(sortByNewest(page.items));
      } catch (e) {
        if (active) setMutations([]);
      }
    })();
    return () => { active = false; };
  }, [filters]);

  if (banks === null) return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;

  const bankMap = {};
  (banks || []).forEach((b) => { bankMap[b.id] = b; });
  const companyMap = {};
  (companies || []).forEach((c) => { companyMap[c.id] = c; });

  return (
    <div>
      <PageHeader title="Mutasi Bank" subtitle="Daftar mutasi dari semua rekening" />

      <div className="sticky top-0 z-20 bg-background mb-4 flex flex-wrap items-end gap-3 pb-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Cari</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Cari keterangan..."
              className="h-9 w-56 rounded-md border border-input bg-transparent pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Perusahaan</label>
          <Select value={filters.company_id || "all"} onValueChange={(v) => setFilters({ ...filters, company_id: v === "all" ? "" : v, bank_account_id: "" })}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {(companies || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rekening</label>
          <Select value={filters.bank_account_id || "all"} disabled={!filters.company_id} onValueChange={(v) => setFilters({ ...filters, bank_account_id: v === "all" ? "" : v })}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Pilih perusahaan dulu" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {(banks || []).filter((b) => !filters.company_id || b.company_id === filters.company_id).map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Arah</label>
          <Select value={filters.direction || "all"} onValueChange={(v) => setFilters({ ...filters, direction: v === "all" ? "" : v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="masuk">Masuk</SelectItem>
              <SelectItem value="keluar">Keluar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Status</label>
          <Select value={filters.mapped || "all"} onValueChange={(v) => setFilters({ ...filters, mapped: v === "all" ? "" : v })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="unmapped">Belum Dipetakan</SelectItem>
              <SelectItem value="mapped">Sudah Dipetakan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Dari Tanggal</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Sampai Tanggal</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {mutations === null ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>
      ) : mutations.length === 0 ? (
        <EmptyState icon={Receipt} title="Belum ada mutasi" description="Impor mutasi dari bank untuk melihat data di sini." />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto rounded-xl border bg-white [&>div]:overflow-visible">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white [&_th]:bg-white">
              <TableRow>
                <TableHead className="w-28">Tanggal</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mutations.map((m) => {
                const bank = bankMap[m.bank_account_id];
                return (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate({ to: "/mutasi/$id", params: { id: m.id } })}>
                    <TableCell className="text-sm">{formatDate(m.date)}</TableCell>
                    <TableCell className="text-sm">
                      <span className="text-xs text-muted-foreground">{bank ? `${bank.bank_name} - ${bank.account_number}` : "—"}</span>
                    </TableCell>
                    <TableCell className="text-sm">{m.description || "(tanpa keterangan)"}</TableCell>
                    <TableCell className="text-right"><Amount value={m.amount} /></TableCell>
                    <TableCell>
                      {m.mapped ? <Badge className="bg-emerald-100 text-emerald-700" variant="secondary">Dipetakan</Badge> : <Badge className="bg-amber-100 text-amber-700" variant="secondary">Belum</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setEditMutation(m); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <MutationMapDialog
        mutation={editMutation}
        open={!!editMutation}
        onOpenChange={(o) => !o && setEditMutation(null)}
        onUpdated={() => {
          // Refresh mutations list to update mapped status
          const query = {};
          if (filters.company_id) query.company_id = filters.company_id;
          if (filters.bank_account_id) query.bank_account_id = filters.bank_account_id;
          if (filters.direction) query.direction = filters.direction;
          if (filters.mapped === "mapped") query.mapped = true;
          if (filters.mapped === "unmapped") query.mapped = false;
          if (filters.date_from || filters.date_to) {
            query.date = {};
            if (filters.date_from) query.date.$gte = filters.date_from;
            if (filters.date_to) query.date.$lte = filters.date_to;
          }
          if (filters.search) query.description = { $regex: filters.search, $options: "i" };
          base44.entities.Mutation.filter(query, { sort: "-date", limit: 200 })
            .then((page) => setMutations(sortByNewest(page.items)))
            .catch(() => {});
        }}
      />
    </div>
  );
}
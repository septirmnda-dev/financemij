import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Building2, Plus, Pencil, Trash2, Landmark, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/perusahaan")({ component: PerusahaanPage });

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#84cc16"];

function PerusahaanPage() {
  const [companies, setCompanies] = useState(null);
  const [banks, setBanks] = useState(null);
  const [companyDialog, setCompanyDialog] = useState(null);
  const [bankDialog, setBankDialog] = useState(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [c, b] = await Promise.all([
      base44.entities.Company.list(),
      base44.entities.BankAccount.list(),
    ]);
    setCompanies(c || []);
    setBanks(b || []);
  };

  useEffect(() => {
    load();
    const unsubC = base44.entities.Company.subscribe(() => load());
    const unsubB = base44.entities.BankAccount.subscribe(() => load());
    return () => { unsubC(); unsubB(); };
  }, []);

  const saveCompany = async () => {
    const { id, name, color } = companyDialog;
    if (!name?.trim()) { toast.error("Nama perusahaan wajib diisi"); return; }
    if (id) {
      await base44.entities.Company.update(id, { name, color });
      toast.success("Perusahaan diperbarui");
    } else {
      await base44.entities.Company.create({ name, color: color || COLORS[0] });
      toast.success("Perusahaan ditambahkan");
    }
    setCompanyDialog(null);
    load();
  };

  const deleteCompany = async (c) => {
    if (!confirm(`Hapus ${c.name}? Semua rekening & mutasi terkait juga akan dihapus.`)) return;
    const cBanks = (banks || []).filter((b) => b.company_id === c.id);
    for (const b of cBanks) {
      await base44.entities.Mutation.deleteMany({ bank_account_id: b.id });
      await base44.entities.BankAccount.delete(b.id);
    }
    await base44.entities.Company.delete(c.id);
    toast.success("Perusahaan dihapus");
    load();
  };

  const saveBank = async () => {
    const { id, company_id, bank_name, account_number, account_name, opening_balance, sheet_name } = bankDialog;
    if (!company_id) { toast.error("Pilih perusahaan"); return; }
    if (!bank_name?.trim()) { toast.error("Nama bank wajib diisi"); return; }
    if (!account_number?.trim()) { toast.error("Nomor rekening wajib diisi"); return; }
    const payload = {
      company_id,
      bank_name: bank_name.trim(),
      account_number: account_number.trim(),
      account_name: account_name?.trim() || "",
      opening_balance: Number(opening_balance) || 0,
      sheet_name: sheet_name?.trim() || "",
    };
    if (id) {
      await base44.entities.BankAccount.update(id, payload);
      toast.success("Rekening diperbarui");
    } else {
      await base44.entities.BankAccount.create(payload);
      toast.success("Rekening ditambahkan");
    }
    setBankDialog(null);
    load();
  };

  const deleteBank = async (b) => {
    if (!confirm(`Hapus rekening ${b.bank_name} - ${b.account_number}?`)) return;
    await base44.entities.Mutation.deleteMany({ bank_account_id: b.id });
    await base44.entities.BankAccount.delete(b.id);
    toast.success("Rekening dihapus");
    load();
  };

  if (companies === null) return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;

  const q = search.trim().toLowerCase();
  const matchBank = (b) =>
    (b.bank_name || "").toLowerCase().includes(q) ||
    (b.account_number || "").toLowerCase().includes(q) ||
    (b.account_name || "").toLowerCase().includes(q);

  const rows = companies
    .map((c) => {
      const all = (banks || []).filter((b) => b.company_id === c.id);
      const nameMatch = !q || (c.name || "").toLowerCase().includes(q);
      return { company: c, banks: nameMatch ? all : all.filter(matchBank) };
    })
    .filter((r) => !q || (r.company.name || "").toLowerCase().includes(q) || r.banks.length > 0);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background pb-3">
      <PageHeader
        title="Perusahaan"
        subtitle="Kelola perusahaan & rekening bank"
        action={
          <Button onClick={() => setCompanyDialog({ name: "", color: COLORS[0] })}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Perusahaan
          </Button>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari perusahaan, nomor rekening, atau bank..."
            className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Belum ada perusahaan"
          description="Tambahkan perusahaan untuk mulai mengelola rekening dan mutasi."
          action={<Button onClick={() => setCompanyDialog({ name: "", color: COLORS[0] })}><Plus className="mr-2 h-4 w-4" /> Tambah Perusahaan</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={Building2} title="Tidak ditemukan" description="Tidak ada perusahaan atau rekening yang cocok dengan pencarian." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map(({ company: c, banks: cBanks }) => (
            <div key={c.id} className="rounded-xl border bg-white p-3.5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.color || "#10b981"}20`, color: c.color || "#10b981" }}>
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{cBanks.length} rekening</p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCompanyDialog({ id: c.id, name: c.name, color: c.color })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteCompany(c)}>
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                {cBanks.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">Belum ada rekening</p>
                ) : (
                  cBanks.map((b) => (
                    <div key={b.id} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Landmark className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{b.bank_name} · {b.account_number}</p>
                        <p className="text-[11px] text-muted-foreground">{b.account_name || "—"}</p>
                      </div>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setBankDialog({ id: b.id, company_id: c.id, bank_name: b.bank_name, account_number: b.account_number, account_name: b.account_name, opening_balance: b.opening_balance, sheet_name: b.sheet_name })}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteBank(b)}>
                          <Trash2 className="h-3 w-3 text-rose-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={() => setBankDialog({ company_id: c.id, bank_name: "", account_number: "", account_name: "", opening_balance: 0 })}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Rekening
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!companyDialog} onOpenChange={(o) => !o && setCompanyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{companyDialog?.id ? "Edit Perusahaan" : "Tambah Perusahaan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nama Perusahaan</Label>
              <Input value={companyDialog?.name || ""} onChange={(e) => setCompanyDialog({ ...companyDialog, name: e.target.value })} placeholder="PT Contoh Sejahtera" />
            </div>
            <div>
              <Label>Warna</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setCompanyDialog({ ...companyDialog, color: c })} className={`h-8 w-8 rounded-full transition ${companyDialog?.color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button onClick={saveCompany}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bankDialog} onOpenChange={(o) => !o && setBankDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bankDialog?.id ? "Edit Rekening" : "Tambah Rekening"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Perusahaan</Label>
              <Select value={bankDialog?.company_id || ""} onValueChange={(v) => setBankDialog({ ...bankDialog, company_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih perusahaan" /></SelectTrigger>
                <SelectContent>
                  {(companies || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nama Bank</Label>
              <Input value={bankDialog?.bank_name || ""} onChange={(e) => setBankDialog({ ...bankDialog, bank_name: e.target.value })} placeholder="BCA / Mandiri / BNI / BRI" />
            </div>
            <div>
              <Label>Nomor Rekening</Label>
              <Input value={bankDialog?.account_number || ""} onChange={(e) => setBankDialog({ ...bankDialog, account_number: e.target.value })} placeholder="1234567890" />
            </div>
            <div>
              <Label>Atas Nama</Label>
              <Input value={bankDialog?.account_name || ""} onChange={(e) => setBankDialog({ ...bankDialog, account_name: e.target.value })} placeholder="PT Contoh Sejahtera" />
            </div>
            <div>
              <Label>Saldo Awal</Label>
              <Input type="number" value={bankDialog?.opening_balance || 0} onChange={(e) => setBankDialog({ ...bankDialog, opening_balance: e.target.value })} />
            </div>
            <div>
              <Label>Nama Tab Spreadsheet (opsional)</Label>
              <Input value={bankDialog?.sheet_name || ""} onChange={(e) => setBankDialog({ ...bankDialog, sheet_name: e.target.value })} placeholder="Otomatis: 164-5678666 / nomor rekening" />
              <p className="mt-1 text-[11px] text-muted-foreground">Tab di ALL MUTASI REKENING, mis. &quot;BCA Farid&quot;. Kosongkan bila nama tab = nomor rekening.</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button onClick={saveBank}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
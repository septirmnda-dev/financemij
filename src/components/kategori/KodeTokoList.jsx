import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, Store, Search } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PLATFORMS } from "@/lib/storeCode";

const PLATFORM_COLORS = {
  Shopee: "bg-orange-100 text-orange-700",
  Lazada: "bg-indigo-100 text-indigo-700",
  Tiktok: "bg-slate-800 text-white",
};

const normalizeAcc = (v) => String(v || "").replace(/\D/g, "").replace(/^0+/, "");

export function KodeTokoList() {
  const [items, setItems] = useState(null);
  const [banks, setBanks] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    const list = await base44.entities.StoreCode.list();
    setItems(list || []);
  };

  useEffect(() => {
    load();
    base44.entities.BankAccount.list().then((b) => setBanks(b || []));
    base44.entities.Company.list().then((c) => setCompanies(c || []));
    const unsub = base44.entities.StoreCode.subscribe(() => load());
    return unsub;
  }, []);

  const companyMap = {};
  companies.forEach((c) => { companyMap[c.id] = c; });

  const bankByAccount = {};
  banks.forEach((b) => {
    const key = normalizeAcc(b.account_number);
    if (key && !bankByAccount[key]) bankByAccount[key] = b;
  });

  // Deteksi otomatis bank & perusahaan dari nomor rekening
  const detectAccount = (accountNumber) => {
    const key = normalizeAcc(accountNumber);
    if (!key) return null;
    const bank = bankByAccount[key];
    if (!bank) return null;
    const company = companyMap[bank.company_id];
    return { bank, company, label: `${bank.bank_name}${company ? ` · ${company.name}` : ""}` };
  };

  const save = async () => {
    const { id, platform, code, account_number } = dialog;
    if (!platform) { toast.error("Pilih platform"); return; }
    if (!code?.trim()) { toast.error("Kode Toko wajib diisi"); return; }
    const payload = { platform, code: code.trim().toUpperCase(), account_number: (account_number || "").trim() };
    if (id) {
      await base44.entities.StoreCode.update(id, payload);
      toast.success("Kode Toko diperbarui");
    } else {
      await base44.entities.StoreCode.create(payload);
      toast.success("Kode Toko ditambahkan");
    }
    setDialog(null);
    load();
  };

  const remove = async (item) => {
    if (!confirm(`Hapus Kode Toko "${item.code}"?`)) return;
    await base44.entities.StoreCode.delete(item.id);
    toast.success("Kode Toko dihapus");
    load();
  };

  if (items === null) return <div className="py-12 text-center text-sm text-muted-foreground">Memuat...</div>;

  const q = search.trim().toLowerCase();
  const filtered = items.filter(
    (i) =>
      !q ||
      (i.code || "").toLowerCase().includes(q) ||
      (i.account_number || "").toLowerCase().includes(q) ||
      (i.platform || "").toLowerCase().includes(q)
  );

  const grouped = PLATFORMS.map((p) => ({
    platform: p,
    rows: filtered.filter((i) => i.platform === p).sort((a, b) => (a.code || "").localeCompare(b.code || "")),
  })).filter((g) => g.rows.length > 0);

  const detected = dialog?.account_number ? detectAccount(dialog.account_number) : null;

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background pb-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Kode Toko, rekening, atau platform..."
            className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button size="sm" onClick={() => setDialog({ platform: PLATFORMS[0], code: "", account_number: "" })}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Kode Toko
        </Button>
      </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Store} title="Belum ada Kode Toko" description="Tambahkan Kode Toko per platform untuk memetakan uang masuk." />
      ) : grouped.length === 0 ? (
        <EmptyState icon={Search} title="Tidak ditemukan" description="Tidak ada Kode Toko yang cocok dengan pencarian." />
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.platform} className="rounded-xl border bg-white">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <Badge className={PLATFORM_COLORS[g.platform] || "bg-gray-100 text-gray-600"} variant="secondary">{g.platform}</Badge>
                <span className="text-xs text-muted-foreground">{g.rows.length} kode</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Kode Toko</TableHead>
                    <TableHead className="w-48">Nomor Rekening</TableHead>
                    <TableHead>Bank &amp; Perusahaan</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.rows.map((row) => {
                    const info = detectAccount(row.account_number);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm font-medium">{row.code || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.account_number || "—"}</TableCell>
                        <TableCell>
                          {info ? (
                            <span className="text-sm">{info.label}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {row.account_number ? "Tidak terdeteksi" : "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ id: row.id, platform: row.platform, code: row.code, account_number: row.account_number || "" })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(row)}>
                              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.id ? "Edit Kode Toko" : "Tambah Kode Toko"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Platform</Label>
              <Select value={dialog?.platform || PLATFORMS[0]} onValueChange={(v) => setDialog({ ...dialog, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kode Toko</Label>
              <Input value={dialog?.code || ""} onChange={(e) => setDialog({ ...dialog, code: e.target.value })} placeholder="MM" />
            </div>
            <div>
              <Label>Nomor Rekening</Label>
              <Input value={dialog?.account_number || ""} onChange={(e) => setDialog({ ...dialog, account_number: e.target.value })} placeholder="0661657668" />
              {dialog?.account_number ? (
                <p className={`mt-1 text-xs ${detected ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {detected ? `Terdeteksi: ${detected.label}` : "Nomor rekening belum terdaftar di Rekening Bank."}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button onClick={save}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
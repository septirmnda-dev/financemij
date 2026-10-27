import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Tags, Plus, Pencil, Trash2, Search } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TYPE_OPTIONS = [
  { value: "operasional", label: "Operasional" },
  { value: "hpp", label: "HPP" },
  { value: "pendapatan", label: "Pendapatan" },
  { value: "modal", label: "Modal" },
  { value: "lainnya", label: "Lainnya" },
];

/** Daftar Kode Biaya (kategori induk) untuk pemetaan Jurnal. */
export function KodeBiayaList() {
  const [categories, setCategories] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    const cats = await base44.entities.Category.list();
    setCategories(cats || []);
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Category.subscribe(() => load());
    return unsub;
  }, []);

  const save = async () => {
    const { id, name, direction, type, keywordsStr } = dialog;
    if (!name?.trim()) { toast.error("Nama Kode Biaya wajib diisi"); return; }
    if (!direction) { toast.error("Pilih arah"); return; }
    if (!type) { toast.error("Pilih jenis"); return; }
    const keywords = (keywordsStr || "").split(",").map((k) => k.trim()).filter(Boolean);
    const payload = { name: name.trim(), direction, type, keywords, parent_id: "" };
    if (id) {
      await base44.entities.Category.update(id, payload);
      toast.success("Kode Biaya diperbarui");
    } else {
      await base44.entities.Category.create(payload);
      toast.success("Kode Biaya ditambahkan");
    }
    setDialog(null);
    load();
  };

  const remove = async (c) => {
    const children = (categories || []).filter((x) => x.parent_id === c.id);
    if (!confirm(`Hapus Kode Biaya "${c.name}"?${children.length > 0 ? ` ${children.length} Sub Biaya juga akan dihapus.` : ""}`)) return;
    for (const child of children) {
      await base44.entities.Category.delete(child.id);
    }
    await base44.entities.Category.delete(c.id);
    toast.success("Kode Biaya dihapus");
    load();
  };

  if (categories === null) return <div className="py-12 text-center text-sm text-muted-foreground">Memuat...</div>;

  const q = search.trim().toLowerCase();
  const all = categories.filter((c) => !c.parent_id);
  const items = all.filter(
    (c) => !q || (c.name || "").toLowerCase().includes(q) || (c.keywords || []).some((k) => k.toLowerCase().includes(q))
  );

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background pb-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Kode Biaya</h2>
          <p className="text-xs text-muted-foreground">Kategori induk untuk pemetaan mutasi.</p>
        </div>
        <Button size="sm" onClick={() => setDialog({ name: "", direction: "keluar", type: "operasional", keywordsStr: "" })}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Kode Biaya
        </Button>
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari Kode Biaya..."
          className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      </div>

      {all.length === 0 ? (
        <EmptyState icon={Tags} title="Belum ada Kode Biaya" description="Tambahkan Kode Biaya untuk mulai memetakan mutasi." />
      ) : items.length === 0 ? (
        <EmptyState icon={Search} title="Tidak ditemukan" description="Tidak ada Kode Biaya yang cocok dengan pencarian." />
      ) : (
        <div className="space-y-1.5">
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                {(c.keywords || []).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.keywords.map((k, i) => (
                      <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{k}</span>
                    ))}
                  </div>
                )}
              </div>
              <Badge className="bg-gray-100 text-gray-600" variant="secondary">
                {c.direction === "masuk" ? "Uang Masuk" : "Uang Keluar"}
              </Badge>
              <Badge className={c.type === "operasional" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"} variant="secondary">
                {TYPE_OPTIONS.find((t) => t.value === c.type)?.label || c.type}
              </Badge>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ id: c.id, name: c.name, direction: c.direction, type: c.type, keywordsStr: (c.keywords || []).join(", ") })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(c)}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.id ? "Edit Kode Biaya" : "Tambah Kode Biaya"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nama Kode Biaya</Label>
              <Input value={dialog?.name || ""} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} placeholder="Biaya Produksi" />
            </div>
            <div>
              <Label>Arah</Label>
              <Select value={dialog?.direction || "keluar"} onValueChange={(v) => setDialog({ ...dialog, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keluar">Uang Keluar</SelectItem>
                  <SelectItem value="masuk">Uang Masuk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jenis</Label>
              <Select value={dialog?.type || "operasional"} onValueChange={(v) => setDialog({ ...dialog, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kata Kunci (untuk auto-mapping)</Label>
              <Input value={dialog?.keywordsStr || ""} onChange={(e) => setDialog({ ...dialog, keywordsStr: e.target.value })} placeholder="JNE, JNT, SICEPAT, ONGKIR" />
              <p className="mt-1 text-xs text-muted-foreground">Pisahkan dengan koma. Dicocokkan dengan keterangan mutasi saat impor.</p>
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
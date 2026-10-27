import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ListTree, Plus, Pencil, Trash2, Search } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SearchSelect } from "@/components/SearchSelect";
import { toast } from "sonner";

/** Daftar Sub Biaya (kategori anak) dengan pemilihan Kode Biaya induknya. */
export function SubBiayaList() {
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

  const parents = (categories || []).filter((c) => !c.parent_id);

  const save = async () => {
    const { id, name, parent_id, keywordsStr } = dialog;
    if (!name?.trim()) { toast.error("Nama Sub Biaya wajib diisi"); return; }
    if (!parent_id) { toast.error("Pilih Kode Biaya induk"); return; }
    const parent = parents.find((p) => p.id === parent_id);
    if (!parent) { toast.error("Kode Biaya induk tidak ditemukan"); return; }
    const keywords = (keywordsStr || "").split(",").map((k) => k.trim()).filter(Boolean);
    const payload = {
      name: name.trim(),
      direction: parent.direction,
      type: parent.type,
      keywords,
      parent_id: parent.id,
    };
    if (id) {
      await base44.entities.Category.update(id, payload);
      toast.success("Sub Biaya diperbarui");
    } else {
      await base44.entities.Category.create(payload);
      toast.success("Sub Biaya ditambahkan");
    }
    setDialog(null);
    load();
  };

  const remove = async (c) => {
    if (!confirm(`Hapus Sub Biaya "${c.name}"?`)) return;
    await base44.entities.Category.delete(c.id);
    toast.success("Sub Biaya dihapus");
    load();
  };

  if (categories === null) return <div className="py-12 text-center text-sm text-muted-foreground">Memuat...</div>;

  const q = search.trim().toLowerCase();
  const subs = categories.filter((c) => c.parent_id);
  const parentName = (id) => categories.find((c) => c.id === id)?.name || "—";
  const items = subs.filter(
    (c) => !q || (c.name || "").toLowerCase().includes(q) || parentName(c.parent_id).toLowerCase().includes(q)
  );

  const parentOptions = parents.map((p) => ({ id: p.id, label: p.name, hint: p.direction === "masuk" ? "Masuk" : "Keluar" }));

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background pb-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Sub Biaya</h2>
          <p className="text-xs text-muted-foreground">Rincian di bawah setiap Kode Biaya.</p>
        </div>
        <Button size="sm" onClick={() => setDialog({ name: "", parent_id: "", keywordsStr: "" })}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Sub Biaya
        </Button>
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari Sub Biaya atau Kode Biaya..."
          className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      </div>

      {subs.length === 0 ? (
        <EmptyState icon={ListTree} title="Belum ada Sub Biaya" description="Tambahkan Sub Biaya di bawah Kode Biaya." />
      ) : items.length === 0 ? (
        <EmptyState icon={Search} title="Tidak ditemukan" description="Tidak ada Sub Biaya yang cocok dengan pencarian." />
      ) : (
        <div className="space-y-1.5">
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{parentName(c.parent_id)}</p>
              </div>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ id: c.id, name: c.name, parent_id: c.parent_id || "", keywordsStr: (c.keywords || []).join(", ") })}>
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
            <DialogTitle>{dialog?.id ? "Edit Sub Biaya" : "Tambah Sub Biaya"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nama Sub Biaya</Label>
              <Input value={dialog?.name || ""} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} placeholder="Biaya Material" />
            </div>
            <div>
              <Label>Kode Biaya</Label>
              <SearchSelect
                options={parentOptions}
                value={dialog?.parent_id || ""}
                onChange={(id) => setDialog({ ...dialog, parent_id: id })}
                placeholder="Cari Kode Biaya..."
                emptyText="Kode Biaya tidak ditemukan."
              />
            </div>
            <div>
              <Label>Kata Kunci (untuk auto-mapping)</Label>
              <Input value={dialog?.keywordsStr || ""} onChange={(e) => setDialog({ ...dialog, keywordsStr: e.target.value })} placeholder="MATERIAL, KAYU, BESI" />
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
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Repeat, Plus, Pencil, Trash2, Search } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";

const PARENT_NAME = "Kode Transfer Produk";

/** Daftar Kode Transfer Produk (anak dari Kode Biaya "Kode Transfer Produk"). */
export function TransferKodeList() {
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

  const parent = (categories || []).find((c) => !c.parent_id && (c.name || "") === PARENT_NAME);
  const subs = (categories || []).filter((c) => c.parent_id && c.parent_id === parent?.id);

  const save = async () => {
    const { id, name, fullName } = dialog;
    if (!name?.trim()) { toast.error("Kode wajib diisi"); return; }
    if (!parent) { toast.error(`Kode Biaya "${PARENT_NAME}" tidak ditemukan`); return; }
    const keywords = [name.trim().toUpperCase()];
    if (fullName?.trim()) keywords.unshift(fullName.trim().toUpperCase());
    const payload = {
      name: name.trim().toUpperCase(),
      direction: parent.direction,
      type: parent.type,
      keywords,
      parent_id: parent.id,
    };
    if (id) {
      await base44.entities.Category.update(id, payload);
      toast.success("Kode Transfer Produk diperbarui");
    } else {
      await base44.entities.Category.create(payload);
      toast.success("Kode Transfer Produk ditambahkan");
    }
    setDialog(null);
    load();
  };

  const remove = async (c) => {
    if (!confirm(`Hapus kode "${c.name}"?`)) return;
    await base44.entities.Category.delete(c.id);
    toast.success("Kode Transfer Produk dihapus");
    load();
  };

  if (categories === null) return <div className="py-12 text-center text-sm text-muted-foreground">Memuat...</div>;

  const q = search.trim().toLowerCase();
  const items = subs.filter(
    (c) => !q || (c.name || "").toLowerCase().includes(q) || (c.keywords || []).some((k) => k.toLowerCase().includes(q))
  );

  return (
    <div>
      <div className="sticky top-0 z-10 bg-background pb-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Kode Transfer Produk</h2>
            <p className="text-xs text-muted-foreground">Dipilih saat memetakan mutasi uang masuk (CF, MJ, AS, ...).</p>
          </div>
          <Button size="sm" onClick={() => setDialog({ name: "", fullName: "" })}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Kode Transfer Produk
          </Button>
        </div>

        <div className="relative mb-3 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Kode Transfer Produk..."
            className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {subs.length === 0 ? (
        <EmptyState icon={Repeat} title="Belum ada Kode Transfer Produk" description="Tambahkan kode seperti CF, MJ, AS, JP, MG, TM." />
      ) : items.length === 0 ? (
        <EmptyState icon={Search} title="Tidak ditemukan" description="Tidak ada kode yang cocok dengan pencarian." />
      ) : (
        <div className="space-y-1.5">
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">
                {c.name}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{(c.keywords || [])[0] || c.name}</p>
              </div>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ id: c.id, name: c.name, fullName: (c.keywords || [])[0] || "" })}>
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
            <DialogTitle>{dialog?.id ? "Edit Kode Transfer Produk" : "Tambah Kode Transfer Produk"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Kode (inisial)</Label>
              <Input value={dialog?.name || ""} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} placeholder="CF" />
            </div>
            <div>
              <Label>Nama Produk</Label>
              <Input value={dialog?.fullName || ""} onChange={(e) => setDialog({ ...dialog, fullName: e.target.value })} placeholder="Moncer Coffee" />
              <p className="mt-1 text-xs text-muted-foreground">Juga dipakai sebagai kata kunci auto-mapping.</p>
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
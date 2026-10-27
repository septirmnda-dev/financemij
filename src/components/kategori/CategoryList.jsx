import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Tags, Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TYPE_LABELS = {
  operasional: "Operasional",
  hpp: "HPP",
  pendapatan: "Pendapatan",
  modal: "Modal",
  lainnya: "Lainnya",
};

const TYPE_COLORS = {
  operasional: "bg-emerald-100 text-emerald-700",
  hpp: "bg-amber-100 text-amber-700",
  pendapatan: "bg-blue-100 text-blue-700",
  modal: "bg-purple-100 text-purple-700",
  lainnya: "bg-gray-100 text-gray-600",
};

export function CategoryList() {
  const [categories, setCategories] = useState(null);
  const [dialog, setDialog] = useState(null);

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
    const { id, name, direction, type, keywordsStr, parent_id } = dialog;
    if (!name?.trim()) { toast.error("Nama kategori wajib diisi"); return; }
    if (!direction) { toast.error("Pilih arah"); return; }
    if (!type) { toast.error("Pilih jenis"); return; }
    const keywords = (keywordsStr || "").split(",").map((k) => k.trim()).filter(Boolean);
    const payload = { name: name.trim(), direction, type, keywords, parent_id: parent_id || "" };
    if (id) {
      await base44.entities.Category.update(id, payload);
      toast.success("Kategori diperbarui");
    } else {
      await base44.entities.Category.create(payload);
      toast.success("Kategori ditambahkan");
    }
    setDialog(null);
    load();
  };

  const remove = async (c) => {
    const children = (categories || []).filter((x) => x.parent_id === c.id);
    if (!confirm(`Hapus kategori "${c.name}"?${children.length > 0 ? ` ${children.length} sub biaya juga akan dihapus.` : ""}`)) return;
    for (const child of children) {
      await base44.entities.Category.delete(child.id);
    }
    await base44.entities.Category.delete(c.id);
    toast.success("Kategori dihapus");
    load();
  };

  if (categories === null) return <div className="py-12 text-center text-sm text-muted-foreground">Memuat...</div>;

  const keluarParents = categories.filter((c) => c.direction === "keluar" && !c.parent_id);
  const keluarChildren = categories.filter((c) => c.direction === "keluar" && c.parent_id);
  const masuk = categories.filter((c) => c.direction === "masuk");
  const childrenOf = (parentId) => keluarChildren.filter((c) => c.parent_id === parentId);

  const renderCategoryRow = (c, indent = false) => (
    <div key={c.id} className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 ${indent ? "ml-5" : ""}`}>
      {indent && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
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
      <Badge className={TYPE_COLORS[c.type] || TYPE_COLORS.lainnya} variant="secondary">
        {TYPE_LABELS[c.type] || c.type}
      </Badge>
      <div className="flex gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ id: c.id, name: c.name, direction: c.direction, type: c.type, keywordsStr: (c.keywords || []).join(", "), parent_id: c.parent_id || "" })}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(c)}>
          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <Button size="sm" onClick={() => setDialog({ name: "", direction: "keluar", type: "operasional", keywordsStr: "", parent_id: "" })}>
          <Plus className="mr-2 h-4 w-4" /> Tambah Kategori
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState icon={Tags} title="Belum ada kategori" description="Tambahkan kategori untuk mulai memetakan mutasi." />
      ) : (
        <div className="space-y-5">
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Uang Keluar</h2>
            <div className="space-y-3">
              {keluarParents.map((parent) => {
                const subs = childrenOf(parent.id);
                return (
                  <div key={parent.id} className="rounded-xl border p-3">
                    <div className="mb-2">{renderCategoryRow(parent)}</div>
                    {subs.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {subs.map((sub) => renderCategoryRow(sub, true))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Uang Masuk</h2>
            {masuk.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Belum ada kategori</p>
            ) : (
              <div className="space-y-1.5">
                {masuk.map((c) => renderCategoryRow(c))}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.id ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nama Kategori</Label>
              <Input value={dialog?.name || ""} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} placeholder="Biaya Ekspedisi" />
            </div>
            <div>
              <Label>Arah</Label>
              <Select value={dialog?.direction || "keluar"} onValueChange={(v) => setDialog({ ...dialog, direction: v, parent_id: v === "masuk" ? "" : dialog?.parent_id })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keluar">Uang Keluar</SelectItem>
                  <SelectItem value="masuk">Uang Masuk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dialog?.direction === "keluar" && (
              <div>
                <Label>Kode Biaya (Parent) — kosongkan jika ini Kode Biaya</Label>
                <Select value={dialog?.parent_id || "none"} onValueChange={(v) => setDialog({ ...dialog, parent_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="— Kode Biaya (Parent) —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Tidak ada (ini Kode Biaya) —</SelectItem>
                    {keluarParents.filter((p) => p.id !== dialog?.id).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Jenis</Label>
              <Select value={dialog?.type || "operasional"} onValueChange={(v) => setDialog({ ...dialog, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operasional">Operasional</SelectItem>
                  <SelectItem value="hpp">HPP</SelectItem>
                  <SelectItem value="pendapatan">Pendapatan</SelectItem>
                  <SelectItem value="modal">Modal</SelectItem>
                  <SelectItem value="lainnya">Lainnya</SelectItem>
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
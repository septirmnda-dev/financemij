import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";

export function LookupList({ group, title, description }) {
  const [items, setItems] = useState(null);
  const [dialog, setDialog] = useState(null);

  const load = async () => {
    const list = await base44.entities.TransactionType.filter({ group });
    setItems((list || []).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.TransactionType.subscribe(() => load());
    return unsub;
  }, [group]);

  const save = async () => {
    const name = (dialog?.name || "").trim();
    if (!name) { toast.error("Nama wajib diisi"); return; }
    if (dialog?.id) {
      await base44.entities.TransactionType.update(dialog.id, { name, group });
      toast.success(`${title} diperbarui`);
    } else {
      await base44.entities.TransactionType.create({ name, group });
      toast.success(`${title} ditambahkan`);
    }
    setDialog(null);
    load();
  };

  const remove = async (item) => {
    if (!confirm(`Hapus "${item.name}"?`)) return;
    await base44.entities.TransactionType.delete(item.id);
    toast.success(`${title} dihapus`);
    load();
  };

  if (items === null) return <div className="py-12 text-center text-sm text-muted-foreground">Memuat...</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button size="sm" onClick={() => setDialog({ name: "" })}>
          <Plus className="mr-2 h-4 w-4" /> Tambah
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={ListChecks} title={`Belum ada ${title}`} description={`Tambahkan ${title} untuk dipakai saat pemetaan.`} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5">
              <span className="text-sm">{item.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDialog({ id: item.id, name: item.name })}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(item)}>
                <Trash2 className="h-3 w-3 text-rose-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.id ? `Edit ${title}` : `Tambah ${title}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nama</Label>
              <Input value={dialog?.name || ""} onChange={(e) => setDialog({ ...dialog, name: e.target.value })} placeholder={title} />
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
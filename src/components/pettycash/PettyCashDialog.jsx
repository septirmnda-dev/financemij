import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchSelect } from "@/components/SearchSelect";
import { toast } from "sonner";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const digitsOnly = (v) => String(v ?? "").replace(/[^\d]/g, "");

export function PettyCashDialog({ open, onOpenChange, companies = [], categories = [], initial, onSaved }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            company_id: initial.company_id || "",
            date: initial.date || "",
            direction: initial.direction || "keluar",
            amount: initial.amount != null ? String(initial.amount) : "",
            source: initial.source || "",
            is_ops: !!initial.is_ops,
            parent_id: initial.parent_id || "",
            category_id: initial.category_id || "",
            description: initial.description || "",
          }
        : {
            company_id: companies[0]?.id || "",
            date: todayLocal(),
            direction: "keluar",
            amount: "",
            source: "Tunai",
            is_ops: true,
            parent_id: "",
            category_id: "",
            description: "",
          }
    );
  }, [open, initial]);

  if (!form) return null;

  const options = categories.filter((c) => c.direction === form.direction);
  const kodOptions = options.filter((c) => !c.parent_id).map((c) => ({ id: c.id, label: c.name }));
  const subsOf = (parentId) => options.filter((c) => c.parent_id === parentId);
  const subOptions = () => {
    if (form.parent_id) {
      const subs = subsOf(form.parent_id);
      if (subs.length > 0) return subs.map((c) => ({ id: c.id, label: c.name }));
      return kodOptions.filter((k) => k.id === form.parent_id);
    }
    return options.filter((c) => c.parent_id).map((c) => ({
      id: c.id,
      label: c.name,
      hint: options.find((p) => p.id === c.parent_id)?.name || "",
    }));
  };

  const save = async () => {
    if (!form.company_id) { toast.error("Pilih perusahaan"); return; }
    if (!form.date) { toast.error("Tanggal wajib diisi"); return; }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast.error("Nominal tidak valid"); return; }

    const cat = categories.find((c) => c.id === form.category_id);
    const kod = categories.find((c) => c.id === form.parent_id);
    const payload = {
      company_id: form.company_id,
      date: form.date,
      direction: form.direction,
      amount,
      source: form.source || "",
      is_ops: !!form.is_ops,
      parent_id: form.parent_id || "",
      parent_name: kod?.name || "",
      category_id: form.category_id || "",
      category_name: cat?.name || "",
      description: form.description || "",
    };

    if (initial?.id) {
      await base44.entities.PettyCash.update(initial.id, payload);
      toast.success("Transaksi kas diperbarui");
    } else {
      await base44.entities.PettyCash.create(payload);
      toast.success("Transaksi kas ditambahkan");
    }
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Transaksi Kas" : "Tambah Transaksi Kas"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Perusahaan</Label>
            <Select value={form.company_id || "none"} onValueChange={(v) => setForm({ ...form, company_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Pilih perusahaan" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tanggal</Label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <Label>Arah Kas</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v, parent_id: "", category_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masuk">Pengisian Kas</SelectItem>
                  <SelectItem value="keluar">Pemakaian Kas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nominal</Label>
              <Input
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: digitsOnly(e.target.value) })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Jenis Uang</Label>
              <Input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="Tunai / BCA MIJ"
                list="petty-cash-sources"
              />
              <datalist id="petty-cash-sources">
                <option value="Tunai" />
                <option value="BCA MIJ" />
              </datalist>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.is_ops} onCheckedChange={(v) => setForm({ ...form, is_ops: v })} />
            Operasional (ops)
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kode Biaya</Label>
              <SearchSelect
                options={kodOptions}
                value={form.parent_id}
                onChange={(id) => {
                  const subs = subsOf(id);
                  setForm({ ...form, parent_id: id, category_id: subs.length === 0 ? id : "" });
                }}
                placeholder="Cari Kode Biaya..."
                emptyText="Kode Biaya tidak ditemukan."
              />
            </div>
            <div>
              <Label>Sub Biaya</Label>
              <SearchSelect
                options={subOptions()}
                value={form.category_id}
                onChange={(id) => {
                  const cat = categories.find((c) => c.id === id);
                  setForm({ ...form, category_id: id, parent_id: cat?.parent_id || form.parent_id });
                }}
                placeholder="Cari Sub Biaya..."
                emptyText="Sub Biaya tidak ditemukan."
              />
            </div>
          </div>

          <div>
            <Label>Keterangan</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Belanja ATK, isi ulang kas, dll."
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
          <Button onClick={save}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
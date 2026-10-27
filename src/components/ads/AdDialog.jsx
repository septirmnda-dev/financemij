import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/SearchSelect";
import { toast } from "sonner";

const PLATFORM_SUGGESTIONS = ["Meta", "TikTok", "Google", "Shopee", "Tokopedia"];

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const digitsOnly = (v) => String(v ?? "").replace(/[^\d]/g, "");

export function AdDialog({ open, onOpenChange, companies = [], categories = [], mediaList = [], initial, onSaved }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            company_id: initial.company_id || "",
            date: initial.date || "",
            platform: initial.platform || "",
            direction: initial.direction || "keluar",
            amount: initial.amount != null ? String(initial.amount) : "",
            media: initial.media || "",
            parent_id: initial.parent_id || "",
            category_id: initial.category_id || "",
            description: initial.description || "",
          }
        : {
            company_id: companies[0]?.id || "",
            date: todayLocal(),
            platform: "",
            direction: "keluar",
            amount: "",
            media: "",
            parent_id: "",
            category_id: "",
            description: "",
          }
    );
  }, [open, initial]);

  if (!form) return null;

  const kodOptions = categories.filter((c) => !c.parent_id).map((c) => ({ id: c.id, label: c.name }));
  const subsOf = (parentId) => categories.filter((c) => c.parent_id === parentId);
  const subOptions = () => {
    if (form.parent_id) {
      const subs = subsOf(form.parent_id);
      if (subs.length > 0) return subs.map((c) => ({ id: c.id, label: c.name }));
      return kodOptions.filter((k) => k.id === form.parent_id);
    }
    return categories.filter((c) => c.parent_id).map((c) => ({
      id: c.id,
      label: c.name,
      hint: categories.find((p) => p.id === c.parent_id)?.name || "",
    }));
  };

  const save = async () => {
    if (!form.company_id) { toast.error("Pilih perusahaan"); return; }
    if (!form.date) { toast.error("Tanggal wajib diisi"); return; }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast.error("Nominal tidak valid"); return; }
    if (!form.platform?.trim()) { toast.error("Platform wajib diisi"); return; }

    const cat = categories.find((c) => c.id === form.category_id);
    const kod = categories.find((c) => c.id === form.parent_id);

    const payload = {
      company_id: form.company_id,
      date: form.date,
      platform: form.platform.trim(),
      direction: form.direction,
      amount,
      media: form.media || "",
      parent_id: form.parent_id || "",
      parent_name: kod?.name || "",
      category_id: form.category_id || "",
      category_name: cat?.name || "",
      description: form.description || "",
    };

    if (initial?.id) {
      await base44.entities.AdBalance.update(initial.id, payload);
      toast.success("Transaksi saldo iklan diperbarui");
    } else {
      await base44.entities.AdBalance.create(payload);
      toast.success("Transaksi saldo iklan ditambahkan");
    }
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Saldo Iklan" : "Tambah Saldo Iklan"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Perusahaan</Label>
              <Select value={form.company_id || "none"} onValueChange={(v) => setForm({ ...form, company_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih perusahaan" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tanggal</Label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Platform</Label>
              <Input
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                placeholder="Meta / TikTok / Google"
                list="ad-platform-list"
              />
              <datalist id="ad-platform-list">
                {PLATFORM_SUGGESTIONS.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <Label>Arah</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masuk">Top Up Saldo</SelectItem>
                  <SelectItem value="keluar">Pemakaian Saldo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nominal</Label>
              <Input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: digitsOnly(e.target.value) })} placeholder="0" />
            </div>
            <div>
              <Label>Media</Label>
              <SearchSelect
                options={mediaList.map((m) => ({ id: m.name, label: m.name }))}
                value={form.media}
                onChange={(id) => setForm({ ...form, media: id })}
                placeholder="Cari Media..."
                emptyText="Media belum ada di menu Kategori → Media."
              />
            </div>
          </div>

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
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Top up Meta Ads, dll." />
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
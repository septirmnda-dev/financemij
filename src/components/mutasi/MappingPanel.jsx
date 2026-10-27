import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchSelect } from "@/components/SearchSelect";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { createNoteWithPlot } from "@/lib/financeNote";
import { ensurePlatformCategory, PLATFORMS } from "@/lib/storeCode";
import { sumberOf } from "@/lib/sources";

const EMPTY_NOTE = {
  id: "", parent_id: "", category_id: "", amount: "", description: "", transaction_type: "",
  store_code_id: "", has_ppn: false, ppn_amount: "", is_ops: false, is_plot_ops: false, plot_months: 3, media: "",
};

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

const digitsOnly = (v) => String(v ?? "").replace(/[^\d]/g, "");

/**
 * Panel pemetaan mutasi ke catatan finance.
 * Dipakai bersama oleh dialog Petakan Mutasi dan halaman detail Mutasi Bank,
 * sehingga form Tambah Catatan dan Edit Catatan selalu identik.
 */
export function MappingPanel({ mutation, onChanged }) {
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [mediaList, setMediaList] = useState([]);
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [storeCodes, setStoreCodes] = useState([]);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_NOTE);
  const [editOpen, setEditOpen] = useState(false);

  const loadNotes = async () => {
    const page = await base44.entities.FinanceNote.filter({ mutation_id: mutation.id });
    setNotes(page || []);
    onChanged?.();
  };

  useEffect(() => {
    if (!mutation?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [notesPage, cats, tts, scs, media, companies] = await Promise.all([
          base44.entities.FinanceNote.filter({ mutation_id: mutation.id }),
          base44.entities.Category.list(),
          base44.entities.TransactionType.filter({ group: "jenis" }),
          base44.entities.StoreCode.list(),
          base44.entities.TransactionType.filter({ group: "media" }),
          base44.entities.Company.list(),
        ]);
        if (!active) return;
        setCompanyName((companies || []).find((c) => c.id === mutation.company_id)?.name || "");
        setNotes(notesPage || []);
        setCategories((cats || []).filter((c) => c.direction === mutation.direction));
        setTransactionTypes(tts || []);
        setStoreCodes(scs || []);
        setMediaList(media || []);
      } catch {
        if (active) setNotes([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [mutation?.id]);

  if (!mutation) return null;

  const isKeluar = mutation.direction === "keluar";
  const totalAmount = Math.abs(mutation.amount);
  const mappedAmount = notes.reduce((s, n) => s + Math.abs(n.amount), 0);
  const remaining = totalAmount - mappedAmount;
  const progress = totalAmount > 0 ? Math.min(100, (mappedAmount / totalAmount) * 100) : 0;

  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (parentId) => categories.filter((c) => c.parent_id === parentId);
  const parentOptions = parents.map((p) => ({ id: p.id, label: p.name }));

  // Kode Transfer Produk: anak dari Kode Biaya "Kode Transfer Produk" (uang masuk)
  const transferParent = parents.find((p) => (p.name || "") === "Kode Transfer Produk");
  const transferOptions = categories
    .filter((c) => c.parent_id && c.parent_id === transferParent?.id)
    .map((c) => ({ id: c.id, label: c.name, hint: (c.keywords || [])[0] || "" }));
  const setTransferCode = (id) => {
    setForm({ ...form, category_id: id, parent_id: transferParent?.id || form.parent_id });
  };

  const subOptions = () => {
    if (form.parent_id) {
      const subs = childrenOf(form.parent_id);
      if (subs.length > 0) return subs.map((s) => ({ id: s.id, label: s.name }));
      return parentOptions.filter((p) => p.id === form.parent_id);
    }
    return categories.filter((c) => c.parent_id).map((s) => ({
      id: s.id,
      label: s.name,
      hint: categories.find((p) => p.id === s.parent_id)?.name || "",
    }));
  };

  const setKodeBiaya = (id) => {
    const subs = childrenOf(id);
    setForm({ ...form, parent_id: id, category_id: subs.length === 0 ? id : "" });
  };

  const setSubBiaya = (id) => {
    const cat = categories.find((c) => c.id === id);
    setForm({ ...form, category_id: id, parent_id: cat?.parent_id || form.parent_id });
  };

  const onStoreCodeChange = async (codeId) => {
    const sc = storeCodes.find((s) => s.id === codeId);
    if (!sc) { setForm({ ...form, store_code_id: "" }); return; }
    const cat = await ensurePlatformCategory(sc.platform, categories);
    if (cat) {
      if (!categories.some((c) => c.id === cat.id)) setCategories((prev) => [...prev, cat]);
      setForm({ ...form, store_code_id: codeId, parent_id: cat.id, category_id: cat.id });
    } else {
      setForm({ ...form, store_code_id: codeId });
    }
  };

  const addNote = async () => {
    if (!form.category_id) { toast.error("Pilih Sub Biaya"); return; }
    const amt = form.amount ? Number(form.amount) : remaining;
    if (!amt || amt <= 0) { toast.error("Nominal tidak valid atau sisa sudah habis"); return; }
    if (amt > remaining + 1) { toast.error("Nominal melebihi sisa mutasi"); return; }
    try {
      const count = await createNoteWithPlot(mutation, { ...form, amount: amt }, categories);
      toast.success(count > 1 ? `${count} catatan dibuat (plot ${form.plot_months} bulan)` : "Catatan ditambahkan");
      setForm(EMPTY_NOTE);
      loadNotes();
    } catch (e) {
      toast.error(e.message || "Gagal menambah catatan");
    }
  };

  const openEdit = (n) => {
    const cat = categories.find((c) => c.id === n.category_id);
    setForm({
      ...EMPTY_NOTE,
      id: n.id,
      parent_id: cat?.parent_id || cat?.id || "",
      category_id: n.category_id || "",
      amount: String(Math.abs(n.amount || 0)),
      description: n.description || "",
      transaction_type: n.transaction_type || "",
      has_ppn: !!n.has_ppn,
      ppn_amount: n.ppn_amount ? String(n.ppn_amount) : "",
      is_ops: !!n.is_ops,
      is_plot_ops: !!n.is_plot_ops,
      plot_months: n.plot_months || 3,
      media: n.media || "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const cat = categories.find((c) => c.id === form.category_id);
    if (!cat) { toast.error("Pilih Sub Biaya"); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error("Nominal tidak valid"); return; }
    const isOps = isKeluar ? !!(form.is_ops || form.is_plot_ops) : false;
    await base44.entities.FinanceNote.update(form.id, {
      category_id: cat.id,
      category_name: cat.name,
      category_type: isOps ? "operasional" : cat.type,
      amount: isKeluar ? -amt : amt,
      description: form.description || "",
      transaction_type: form.transaction_type || "",
      media: form.media || "",
      has_ppn: !!form.has_ppn,
      ppn_amount: form.has_ppn ? Number(form.ppn_amount) || 0 : 0,
      is_ops: isOps,
      is_plot_ops: !!form.is_plot_ops,
      plot_months: form.is_plot_ops ? Number(form.plot_months) || 0 : 0,
    });
    toast.success("Catatan diperbarui");
    setEditOpen(false);
    setForm(EMPTY_NOTE);
    loadNotes();
  };

  const deleteNote = async (noteId) => {
    if (!confirm("Hapus catatan ini?")) return;
    await base44.entities.FinanceNote.delete(noteId);
    toast.success("Catatan dihapus");
    loadNotes();
  };

  const markMapped = async () => {
    await base44.entities.Mutation.update(mutation.id, { mapped: true });
    toast.success("Mutasi ditandai selesai");
    onChanged?.();
  };

  const noteFields = (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Kode Biaya</label>
          <SearchSelect
            options={parentOptions}
            value={form.parent_id}
            onChange={setKodeBiaya}
            placeholder="Cari Kode Biaya..."
            emptyText="Kode Biaya tidak ditemukan."
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{isKeluar ? "Sub Biaya" : "Kode Transfer Produk"}</label>
          <SearchSelect
            options={isKeluar ? subOptions() : transferOptions}
            value={form.category_id}
            onChange={isKeluar ? setSubBiaya : setTransferCode}
            placeholder={isKeluar ? "Cari Sub Biaya..." : "Pilih kode (CF, AS, JP...)"}
            emptyText={isKeluar ? "Sub Biaya tidak ditemukan." : "Kode Transfer Produk belum ada di menu Kategori."}
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          inputMode="numeric"
          placeholder={`Nominal (kosong = ${formatCurrency(remaining)})`}
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: digitsOnly(e.target.value) })}
        />
        {!isKeluar && (
          <SearchSelect
            options={(transactionTypes || []).map((t) => ({ id: t.name, label: t.name }))}
            value={form.transaction_type}
            onChange={(id) => setForm({ ...form, transaction_type: id })}
            placeholder="Jenis Transaksi (opsional)"
            emptyText="Belum ada Jenis Transaksi di menu Kategori."
          />
        )}
      </div>

      {!isKeluar && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Kode Toko (opsional — otomatis ke kategori Platform)</label>
          <Select value={form.store_code_id || "none"} onValueChange={(v) => onStoreCodeChange(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Pilih Kode Toko" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Tanpa Kode Toko —</SelectItem>
              {PLATFORMS.filter((p) => storeCodes.some((s) => s.platform === p)).map((p) => (
                <SelectGroup key={p}>
                  <SelectLabel>{p}</SelectLabel>
                  {storeCodes.filter((s) => s.platform === p).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code || "(tanpa kode)"}{s.account_number ? ` · ${s.account_number}` : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isKeluar && (
        <div className="space-y-2 rounded-lg bg-muted/50 p-2.5">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Media</label>
            <SearchSelect
              options={(mediaList || []).map((m) => ({ id: m.name, label: m.name }))}
              value={form.media}
              onChange={(id) => setForm({ ...form, media: id })}
              placeholder="Pilih Media..."
              emptyText="Media belum ada di menu Kategori → Media."
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.has_ppn} onCheckedChange={(v) => setForm({ ...form, has_ppn: v })} />
              PPN
            </label>
            {form.has_ppn && (
              <Input
                inputMode="numeric"
                className="h-9 w-40"
                placeholder="Nominal PPN"
                value={form.ppn_amount}
                onChange={(e) => setForm({ ...form, ppn_amount: digitsOnly(e.target.value) })}
              />
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_ops} onCheckedChange={(v) => setForm({ ...form, is_ops: v })} />
              OPS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_plot_ops} onCheckedChange={(v) => setForm({ ...form, is_plot_ops: v })} />
              Plot OPS (masuk Operasional)
            </label>
            {form.is_plot_ops && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min="1"
                  className="h-8 w-20"
                  value={form.plot_months}
                  onChange={(e) => setForm({ ...form, plot_months: e.target.value })}
                />
                <span className="text-sm text-muted-foreground">bulan</span>
              </div>
            )}
          </div>
          {form.is_plot_ops && (
            <p className="text-xs text-muted-foreground">
              Nominal dibagi rata ke {form.plot_months || 1} bulan, tanggal {formatDate(mutation.date)} dan bulan-bulan berikutnya.
            </p>
          )}
        </div>
      )}

      <Input placeholder="Keterangan (opsional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
    </div>
  );

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Memuat...</div>;

  return (
    <>
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Terpetakan</span>
            <span className="font-medium tabular-nums">{formatCurrency(mappedAmount)} / {formatCurrency(totalAmount)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full transition-all ${progress >= 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${progress}%` }} />
          </div>
          {remaining > 0 && <p className="mt-1 text-xs text-muted-foreground">Sisa: {formatCurrency(remaining)}</p>}
        </div>

        {notes.length > 0 && (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium">{n.category_name}</p>
                    {n.category_type && (
                      <Badge className={TYPE_COLORS[n.category_type] || TYPE_COLORS.lainnya} variant="secondary">
                        {TYPE_LABELS[n.category_type] || n.category_type}
                      </Badge>
                    )}
                    {n.media && <Badge className="bg-sky-100 text-sky-700" variant="secondary">{n.media}</Badge>}
                    {n.transaction_type && (
                      <Badge className="bg-blue-100 text-blue-700" variant="secondary">{n.transaction_type}</Badge>
                    )}
                    <Badge className="bg-violet-100 text-violet-700" variant="secondary">{sumberOf(companyName) || companyName || "—"}</Badge>
                    {n.has_ppn && (
                      <Badge className="bg-purple-100 text-purple-700" variant="secondary">PPN {formatCurrency(n.ppn_amount || 0)}</Badge>
                    )}
                    {n.is_ops && (
                      <Badge className="bg-teal-100 text-teal-700" variant="secondary">OPS</Badge>
                    )}
                    {n.is_plot_ops && (
                      <Badge className="bg-indigo-100 text-indigo-700" variant="secondary">
                        Plot {n.plot_months}bln ({n.plot_index + 1}/{n.plot_months})
                      </Badge>
                    )}
                  </div>
                  {n.description && <p className="text-xs text-muted-foreground line-clamp-1">{n.description}</p>}
                </div>
                <p className="text-sm font-semibold tabular-nums">{formatCurrency(Math.abs(n.amount))}</p>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(n)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteNote(n.id)}>
                    <Trash2 className="h-3 w-3 text-rose-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {remaining > 0 && !editOpen && (
          <div className="rounded-lg border border-dashed p-3">
            <p className="mb-2 text-sm font-medium">Tambah Catatan</p>
            {noteFields}
            <Button size="sm" className="mt-2 w-full" onClick={addNote}>
              <Plus className="mr-1 h-4 w-4" />
              {form.is_plot_ops ? `Tambah Plot ${form.plot_months} bulan` : "Tambah"}
            </Button>
          </div>
        )}

        {remaining <= 0 && notes.length > 0 && !mutation.mapped && (
          <Button className="w-full" onClick={markMapped}>
            <Check className="mr-2 h-4 w-4" />Tandai Selesai
          </Button>
        )}
        {mutation.mapped && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 py-2.5 text-sm text-emerald-700">
            <Check className="h-4 w-4" />Mutasi sudah dipetakan
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); setForm(EMPTY_NOTE); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Catatan</DialogTitle></DialogHeader>
          <div className="py-2">{noteFields}</div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button onClick={saveEdit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
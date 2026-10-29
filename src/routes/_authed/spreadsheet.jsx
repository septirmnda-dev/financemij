import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileSpreadsheet, Loader2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { BankAccountCombobox } from "@/components/BankAccountCombobox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { syncBankAccountToSheets, syncPettyCashToSheets } from "@/lib/sheet-sync";
import { ADMIN_SPREADSHEET_ID, MUTASI_SPREADSHEET_ID, PETTY_CASH_TARGETS } from "@/lib/sheetsConfig";

export const Route = createFileRoute("/_authed/spreadsheet")({ component: SpreadsheetPage });

const sheetUrl = (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

const SHEETS = [
  { label: "ALL MUTASI REKENING PT DAN PENAMPUNG", id: MUTASI_SPREADSHEET_ID, detail: "Pemasukan (CR) & Pengeluaran (DB) per tanggal, ditulis ulang setiap impor mutasi" },
  { label: "BIAYA ADMIN REK PT MIJ DAN PT SGL", id: ADMIN_SPREADSHEET_ID, detail: "Mutasi biaya admin / pajak bunga baru ditambahkan di blok rekeningnya" },
  ...PETTY_CASH_TARGETS.map((t) => ({ label: t.label, id: t.spreadsheetId, detail: "Transaksi petty cash baru ditambahkan di tab periode terbaru" })),
];

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dateInput =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

function SpreadsheetPage() {
  const [refs, setRefs] = useState(null);
  const [form, setForm] = useState({ bankId: "", from: "", to: "" });
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setForm((f) => ({ ...f, from: monthStart(), to: today() }));
    (async () => {
      const [banks, companies] = await Promise.all([base44.entities.BankAccount.list(), base44.entities.Company.list()]);
      setRefs({ banks: banks || [], companies: companies || [] });
    })();
  }, []);

  const syncBank = async () => {
    if (!form.bankId) { toast.error("Pilih rekening"); return; }
    if (!form.from || !form.to || form.from > form.to) { toast.error("Rentang tanggal tidak valid"); return; }
    setBusy("bank");
    try {
      const r = await syncBankAccountToSheets({ data: { bank_account_id: form.bankId, from: form.from, to: form.to } });
      const parts = [];
      if (r.daily) parts.push(`${r.daily.updated} tanggal di tab ${r.daily.tab}`);
      if (r.admin?.appended) parts.push(`${r.admin.appended} biaya admin di tab ${r.admin.tab}`);
      if (r.daily?.missing?.length) r.errors.push(`tanggal ${r.daily.missing.join(", ")} tidak ada di tab ${r.daily.tab}`);
      if (!r.daily && !r.admin && r.errors.length === 0) parts.push("tidak ada mutasi di rentang ini");
      if (parts.length) toast.success(`Spreadsheet terupdate: ${parts.join(", ")}`);
      if (r.errors.length) toast.warning(r.errors.join("; "), { duration: 15000 });
    } catch (e) {
      toast.error(`Gagal sinkron: ${e.message}`);
    } finally {
      setBusy("");
    }
  };

  const syncPetty = async () => {
    setBusy("petty");
    try {
      const r = await syncPettyCashToSheets();
      if (r.results.length) toast.success(r.results.map((x) => `${x.label} (${x.tab}): +${x.appended} baris`).join(", "));
      else if (!r.errors.length) toast.success("Semua transaksi petty cash sudah ada di spreadsheet");
      if (r.errors.length) toast.warning(r.errors.join("; "), { duration: 15000 });
    } catch (e) {
      toast.error(`Gagal sinkron: ${e.message}`);
    } finally {
      setBusy("");
    }
  };

  if (refs === null) return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Sinkron Spreadsheet" subtitle="Data web otomatis dikirim ke Google Sheets yang sudah ada; halaman ini untuk kirim ulang manual" />

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">Spreadsheet tujuan</h2>
        <ul className="space-y-2">
          {SHEETS.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <a href={sheetUrl(s.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                  {s.label} <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Mutasi rekening &amp; biaya admin</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Hitung ulang total harian dari mutasi di web dan tulis ke tab rekening di ALL MUTASI REKENING (kolom Pemasukan &amp; Pengeluaran).
          Biaya admin yang belum tercatat ikut ditambahkan. Pakai ini setelah mengedit atau menghapus mutasi.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <Label>Rekening</Label>
            <BankAccountCombobox banks={refs.banks} companies={refs.companies} value={form.bankId} onChange={(v) => setForm({ ...form, bankId: v })} />
          </div>
          <div>
            <Label>Dari</Label>
            <input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className={dateInput} />
          </div>
          <div>
            <Label>Sampai</Label>
            <input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className={dateInput} />
          </div>
          <Button onClick={syncBank} disabled={!!busy}>
            {busy === "bank" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kirim ke Spreadsheet
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Petty cash</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Kirim transaksi petty cash yang belum tercatat (mis. saat koneksi gagal) ke tab periode terbaru. Edit/hapus di web tidak mengubah baris yang sudah terkirim.
        </p>
        <Button onClick={syncPetty} disabled={!!busy}>
          {busy === "petty" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kirim yang Belum Tercatat
        </Button>
      </div>
    </div>
  );
}

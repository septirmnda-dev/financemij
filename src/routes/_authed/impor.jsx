import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { parseCsvFile, importMutations } from "@/lib/server-fns";
import { autoMapMutation } from "@/lib/autoMap";
import { detectBankAccount } from "@/lib/detectBank";
import { matchStoreCode, ensurePlatformCategory } from "@/lib/storeCode";
import { Upload, FileSpreadsheet, Check, Loader2, Sparkles, AlertCircle, Landmark, X, Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/impor")({ component: ImporPage });

function ImporPage() {
  const [banks, setBanks] = useState(null);
  const [companies, setCompanies] = useState(null);
  const [categories, setCategories] = useState(null);
  const [files, setFiles] = useState([]); // { file, bankId, detected, mutations, status: 'pending'|'parsing'|'ready'|'error' }
  const [storeCodes, setStoreCodes] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const [b, c, cats, scs] = await Promise.all([
        base44.entities.BankAccount.list(),
        base44.entities.Company.list(),
        base44.entities.Category.list(),
        base44.entities.StoreCode.list(),
      ]);
      setBanks(b || []);
      setCompanies(c || []);
      setCategories(cats || []);
      setStoreCodes(scs || []);
    })();
  }, []);

  const handleFileSelect = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    // Inisialisasi entry file + deteksi bank dari teks
    const newFiles = await Promise.all(selected.map(async (file) => {
      let detected = null;
      try {
        const text = await file.text();
        detected = detectBankAccount(text, banks || []);
      } catch { /* ignore */ }
      return {
        file,
        bankId: detected?.id || "",
        detected: !!detected,
        mutations: null,
        status: detected ? "parsing" : "pending",
      };
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
    // Auto-parse files with detected bank
    for (const nf of newFiles) {
      if (nf.bankId) {
        const result = await parseFileObj(nf);
        if (result) {
          setFiles((prev) => {
            const idx = prev.findIndex((f) => f.file === nf.file);
            if (idx === -1) return prev;
            const copy = [...prev];
            copy[idx] = result;
            return copy;
          });
        }
      }
    }
  };

  const parseFileObj = async (fileObj) => {
    if (!fileObj.bankId) return null;
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: fileObj.file });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
      const mutations = await parseCsvFile({ data: { file_url: signed_url } });
      if (!mutations || mutations.length === 0) {
        toast.error(`Tidak ada baris terdeteksi di ${fileObj.file.name}`);
        return { ...fileObj, status: "error", mutations: [] };
      }
      const cats = [...(categories || [])];
      const mapped = [];
      for (const m of mutations) {
        let cat = autoMapMutation(m.description, m.direction, cats);
        if (!cat && m.direction === "masuk") {
          const sc = matchStoreCode(m.description, storeCodes || []);
          if (sc) {
            cat = await ensurePlatformCategory(sc.platform, cats);
            if (!cats.some((c) => c.id === cat.id)) cats.push(cat);
          }
        }
        mapped.push({
          ...m,
          auto_category_id: cat?.id || "",
          auto_category_name: cat?.name || "",
          auto_category_type: cat?.type || "",
          auto_matched: !!cat,
        });
      }
      const matchedCount = mapped.filter((r) => r.auto_matched).length;
      toast.success(`${fileObj.file.name}: ${mapped.length} baris, ${matchedCount} terpetakan`);
      return { ...fileObj, status: "ready", mutations: mapped };
    } catch (err) {
      toast.error(`Gagal membaca ${fileObj.file.name}: ${err.message || "error"}`);
      return { ...fileObj, status: "error" };
    }
  };

  const parseFile = async (idx) => {
    const f = files[idx];
    if (!f.bankId) { toast.error(`Pilih rekening untuk ${f.file.name}`); return; }
    setFiles((prev) => prev.map((x, i) => i === idx ? { ...x, status: "parsing" } : x));
    const result = await parseFileObj(f);
    if (result) {
      setFiles((prev) => prev.map((x, i) => i === idx ? result : x));
    }
  };

  const parseAll = async () => {
    setParsing(true);
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "pending") {
        await parseFile(i);
      }
    }
    setParsing(false);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateBankId = async (idx, bankId) => {
    const f = files[idx];
    setFiles((prev) => prev.map((x, i) => i === idx ? { ...x, bankId, status: "parsing" } : x));
    if (bankId && f.status === "pending") {
      const result = await parseFileObj({ ...f, bankId });
      if (result) {
        setFiles((prev) => prev.map((x, i) => i === idx ? result : x));
      }
    }
  };

  const handleImportAll = async () => {
    const readyFiles = files.filter((f) => f.status === "ready" && f.mutations?.length > 0 && f.bankId);
    if (readyFiles.length === 0) { toast.error("Tidak ada file siap diimpor"); return; }
    setImporting(true);
    let totalImported = 0;
    let totalMapped = 0;
    let totalSkipped = 0;
    const sheetErrors = [];
    try {
      for (const f of readyFiles) {
        const bank = (banks || []).find((b) => b.id === f.bankId);
        if (!bank) continue;
        const result = await importMutations({
          data: {
            bank_account_id: f.bankId,
            company_id: bank.company_id,
            source_file: f.file.name,
            mutations: f.mutations.map((r) => ({
              date: r.date,
              description: r.description,
              amount: r.amount,
              direction: r.direction,
              balance_after: r.balance_after,
              auto_category_id: r.auto_category_id || undefined,
              auto_category_name: r.auto_category_name || undefined,
              auto_category_type: r.auto_category_type || undefined,
            })),
          },
        });
        totalImported += result.total;
        totalMapped += result.auto_mapped;
        totalSkipped += result.skipped || 0;
        sheetErrors.push(...(result.sheet?.errors || []));
        if (result.sheet?.daily?.missing?.length) {
          sheetErrors.push(`${f.file.name}: tanggal ${result.sheet.daily.missing.join(", ")} tidak ada di tab ${result.sheet.daily.tab}`);
        }
      }
      toast.success(
        `${totalImported} mutasi diimpor${totalSkipped > 0 ? `, ${totalSkipped} duplikat dilewati` : ""} — ${totalMapped} dipetakan otomatis`
      );
      if (sheetErrors.length > 0) {
        toast.warning(`Spreadsheet belum terupdate: ${sheetErrors.join("; ")}`, { duration: 15000 });
      } else if (totalImported > 0) {
        toast.success("Spreadsheet ALL MUTASI & Biaya Admin terupdate");
      }
      setFiles([]);
      navigate({ to: "/mutasi" });
    } catch (e) {
      toast.error("Gagal impor: " + (e.message || "error"));
    } finally {
      setImporting(false);
    }
  };

  if (banks === null) return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;

  const readyCount = files.filter((f) => f.status === "ready").length;
  const pendingCount = files.filter((f) => f.status === "pending").length;
  const totalMutations = files.reduce((s, f) => s + (f.mutations?.length || 0), 0);
  const totalMatched = files.reduce((s, f) => s + (f.mutations?.filter((r) => r.auto_matched).length || 0), 0);

  return (
    <div>
      <PageHeader
        title="Impor Mutasi"
        subtitle="Impor banyak file CSV sekaligus — rekening terdeteksi otomatis"
        action={
          <Button variant="outline" asChild>
            <Link to="/mutasi">
              <Receipt className="mr-2 h-4 w-4" /> Mutasi Bank
            </Link>
          </Button>
        }
      />

      <div className="max-w-4xl space-y-6">
        {/* File upload */}
        <div className="rounded-xl border bg-white p-5 space-y-4">
          <div>
            <Label>File CSV / Excel (bisa pilih lebih dari 1)</Label>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                multiple
                onChange={handleFileSelect}
                className="flex-1 text-sm file:mr-3 file:rounded-lg file:border file:border-input file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-muted"
              />
              {pendingCount > 0 && (
                <Button onClick={parseAll} disabled={parsing}>
                  {parsing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membaca...</> : <><Upload className="mr-2 h-4 w-4" /> Baca Semua ({pendingCount})</>}
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Pilih satu atau beberapa file CSV mutasi bank. Nomor rekening akan otomatis dicocokkan dengan rekening terdaftar.
            </p>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="rounded-xl border bg-white">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">{files.length} File</h2>
                <p className="text-xs text-muted-foreground">
                  {readyCount} siap · {totalMutations} baris total · {totalMatched} terpetakan otomatis
                </p>
              </div>
              <Button onClick={handleImportAll} disabled={importing || readyCount === 0}>
                {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengimpor...</> : <><Check className="mr-2 h-4 w-4" /> Konfirmasi Impor ({readyCount})</>}
              </Button>
            </div>
            <div className="divide-y">
              {files.map((f, idx) => {
                const bank = (banks || []).find((b) => b.id === f.bankId);
                const comp = (companies || []).find((c) => c.id === bank?.company_id);
                const matchedCount = (f.mutations || []).filter((r) => r.auto_matched).length;
                return (
                  <div key={idx} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{f.file.name}</p>
                          <span className="text-xs text-muted-foreground">({(f.file.size / 1024).toFixed(0)} KB)</span>
                          {f.detected && <Badge className="bg-emerald-100 text-emerald-700" variant="secondary"><Check className="mr-1 h-3 w-3" />Terdeteksi</Badge>}
                          {f.status === "ready" && f.mutations?.length > 0 && (
                            <Badge className="bg-blue-100 text-blue-700" variant="secondary">{f.mutations.length} baris · {matchedCount} mapped</Badge>
                          )}
                          {f.status === "parsing" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                          {f.status === "error" && <Badge className="bg-rose-100 text-rose-600" variant="secondary"><AlertCircle className="mr-1 h-3 w-3" />Error</Badge>}
                        </div>
                        <div className="mt-2 flex items-end gap-2">
                          <div className="flex-1">
                            <label className="mb-1 block text-xs text-muted-foreground">Rekening Bank</label>
                            <Select value={f.bankId || "none"} onValueChange={(v) => updateBankId(idx, v === "none" ? "" : v)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Pilih rekening" /></SelectTrigger>
                              <SelectContent>
                                {(banks || []).map((b) => {
                                  const c = (companies || []).find((x) => x.id === b.company_id);
                                  return (
                                    <SelectItem key={b.id} value={b.id}>
                                      {c?.name} · {b.bank_name} - {b.account_number}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          {f.status === "pending" && f.bankId && (
                            <Button size="sm" variant="outline" onClick={() => parseFile(idx)}>Baca File</Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => removeFile(idx)}>
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                        {bank && comp && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Landmark className="h-3 w-3" /> {comp.name} · {bank.bank_name} - {bank.account_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Auto-mapping info */}
        {totalMutations > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Auto-Mapping Aktif</p>
              <p className="mt-0.5 text-blue-700">
                {totalMatched} dari {totalMutations} mutasi terpetakan otomatis ke kategori berdasarkan kata kunci.
              </p>
              <p className="mt-1 text-xs text-blue-600">
                Tip: tambah kata kunci di halaman Kategori untuk meningkatkan akurasi auto-mapping.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
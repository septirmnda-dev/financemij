import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Landmark, Building2, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authed/rekening")({ component: RekeningPage });

function RekeningPage() {
  const [state, setState] = useState({ loading: true });
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    let timer = null;
    let inFlight = false;
    let queued = false;

    const load = async () => {
      if (inFlight) { queued = true; return; }
      inFlight = true;
      try {
        const [banks, companies, agg] = await Promise.all([
          base44.entities.BankAccount.list(),
          base44.entities.Company.list(),
          base44.entities.Mutation.aggregate({ groupBy: "bank_account_id", sum: "amount" }),
        ]);
        if (!active) return;
        const mutSum = {};
        (agg.rows || []).forEach((r) => { mutSum[r.bank_account_id] = r.sum_amount || 0; });
        const companyMap = {};
        (companies || []).forEach((c) => { companyMap[c.id] = c; });
        const rows = (banks || []).map((b) => ({
          ...b,
          company: companyMap[b.company_id],
          currentBalance: (b.opening_balance || 0) + (mutSum[b.id] || 0),
        }));
        setState({ loading: false, rows, companies: companies || [] });
      } finally {
        inFlight = false;
        if (queued && active) {
          queued = false;
          clearTimeout(timer);
          timer = setTimeout(load, 2500);
        }
      }
    };

    load();

    // Saldo hanya berubah saat mutasi dibuat/dihapus. Perubahan lain (mis. status
    // pemetaan) diabaikan supaya agregasi tidak dipanggil berlebihan.
    const unsub = base44.entities.Mutation.subscribe((event) => {
      if (event?.type === "update") return;
      clearTimeout(timer);
      timer = setTimeout(load, 2500);
    });

    return () => { active = false; clearTimeout(timer); unsub(); };
  }, []);

  if (state.loading) return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;

  const { rows = [], companies = [] } = state;
  const searchLower = search.toLowerCase().trim();
  const filteredRows = searchLower
    ? rows.filter((r) =>
        (r.company?.name || "").toLowerCase().includes(searchLower) ||
        (r.account_number || "").toLowerCase().includes(searchLower) ||
        (r.bank_name || "").toLowerCase().includes(searchLower)
      )
    : rows;
  const filteredCompanyIds = new Set(filteredRows.map((r) => r.company_id));
  const visibleCompanies = companies.filter((c) => filteredCompanyIds.has(c.id));

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background pb-3">
      <PageHeader title="Rekening Bank" subtitle="Daftar semua rekening & saldo terkini" />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari perusahaan, nomor rekening, atau bank..."
            className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState icon={Landmark} title="Tidak ada rekening" description={search ? "Tidak ada rekening yang cocok dengan pencarian." : "Belum ada rekening terdaftar."} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleCompanies.map((c) => {
            const cBanks = filteredRows.filter((b) => b.company_id === c.id);
            return (
              <div key={c.id} className="rounded-xl border bg-white p-3.5">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.color || "#10b981"}20`, color: c.color || "#10b981" }}>
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{cBanks.length} rekening</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {cBanks.map((b) => (
                    <div key={b.id} className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Landmark className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{b.bank_name} · {b.account_number}</p>
                        <p className="text-[11px] text-muted-foreground">{b.account_name || "—"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">Saldo Awal</p>
                          <p className="text-xs tabular-nums">{formatCurrency(b.opening_balance || 0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">Saldo Saat Ini</p>
                          <p className="text-xs font-semibold tabular-nums">{formatCurrency(b.currentBalance)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { MappingPanel } from "@/components/mutasi/MappingPanel";

export const Route = createFileRoute("/_authed/mutasi/$id")({ component: MutasiDetailPage });

function MutasiDetailPage() {
  const { id } = Route.useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [mutation, banks, companies] = await Promise.all([
          base44.entities.Mutation.get(id),
          base44.entities.BankAccount.list(),
          base44.entities.Company.list(),
        ]);
        if (!active) return;
        setState({
          loading: false,
          mutation,
          bank: (banks || []).find((b) => b.id === mutation.bank_account_id),
          company: (companies || []).find((c) => c.id === mutation.company_id),
        });
      } catch (e) {
        if (active) setState({ loading: false, error: true });
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (state.loading) return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;
  if (state.error) return <div className="py-20 text-center text-sm text-muted-foreground">Mutasi tidak ditemukan</div>;

  const { mutation, bank, company } = state;

  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/mutasi" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Mutasi
      </Link>

      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${mutation.amount >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
            {mutation.amount >= 0 ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <p className="text-lg font-semibold">{formatCurrency(Math.abs(mutation.amount))}</p>
            <p className="text-sm text-muted-foreground">{mutation.description || "(tanpa keterangan)"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(mutation.date)} · {bank ? `${bank.bank_name} - ${bank.account_number}` : "—"} · {company?.name || "—"}
            </p>
          </div>
          <Badge className={mutation.direction === "masuk" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"} variant="secondary">
            {mutation.direction === "masuk" ? "Uang Masuk" : "Uang Keluar"}
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 text-base font-semibold">Pemetaan ke Catatan Finance</h2>
        <MappingPanel mutation={mutation} />
      </div>
    </div>
  );
}
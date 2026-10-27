import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, TrendingDown, Wallet, Building2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCurrency, formatSigned, formatDateShort } from "@/lib/format";
import { Amount } from "@/components/Amount";
import DailySummary from "@/components/dashboard/DailySummary";

export const Route = createFileRoute("/_authed/")({ component: Dashboard });

function Dashboard() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const now = new Date();
        const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const [banks, companies, masukAgg, keluarAgg, companyAgg, recentPage] = await Promise.all([
          base44.entities.BankAccount.list(),
          base44.entities.Company.list(),
          base44.entities.Mutation.aggregate({
            query: { direction: "masuk", date: { $gte: fromDate } },
            dateBucket: { field: "date", unit: "day" },
            sum: "amount",
          }),
          base44.entities.Mutation.aggregate({
            query: { direction: "keluar", date: { $gte: fromDate } },
            dateBucket: { field: "date", unit: "day" },
            sum: "amount",
          }),
          base44.entities.Mutation.aggregate({ groupBy: "company_id", sum: "amount" }),
          base44.entities.Mutation.filter({}, { sort: "-date", limit: 8 }),
        ]);
        if (!active) return;

        const recent = recentPage.items || [];
        const masukMap = {};
        (masukAgg.rows || []).forEach((r) => { masukMap[r.date] = Math.abs(r.sum_amount || 0); });
        const keluarMap = {};
        (keluarAgg.rows || []).forEach((r) => { keluarMap[r.date] = Math.abs(r.sum_amount || 0); });
        const allDates = [...new Set([...Object.keys(masukMap), ...Object.keys(keluarMap)])].sort();
        const chartData = allDates.map((d) => ({
          date: formatDateShort(d),
          masuk: masukMap[d] || 0,
          keluar: keluarMap[d] || 0,
        }));

        // Ringkasan saldo harian: saldo awal bulan + akumulasi net harian
        const openingAll = (banks || []).reduce((s, b) => s + (b.opening_balance || 0), 0);
        const allMutSum = (companyAgg.rows || []).reduce((s, r) => s + (r.sum_amount || 0), 0);
        const monthNet = allDates.reduce((s, d) => s + (masukMap[d] || 0) - (keluarMap[d] || 0), 0);
        let running = openingAll + allMutSum - monthNet;
        const dailySummary = allDates.map((d) => {
          const masuk = masukMap[d] || 0;
          const keluar = keluarMap[d] || 0;
          running += masuk - keluar;
          return { date: d, masuk, keluar, net: masuk - keluar, saldo: running };
        });

        const companyMutSum = {};
        (companyAgg.rows || []).forEach((r) => { companyMutSum[r.company_id] = r.sum_amount || 0; });
        const companyBalances = (companies || []).map((c) => {
          const cBanks = (banks || []).filter((b) => b.company_id === c.id);
          const opening = cBanks.reduce((s, b) => s + (b.opening_balance || 0), 0);
          return { ...c, balance: opening + (companyMutSum[c.id] || 0), bankCount: cBanks.length };
        });

        const totalOpening = (banks || []).reduce((s, b) => s + (b.opening_balance || 0), 0);
        const totalMutations = Object.values(companyMutSum).reduce((s, v) => s + v, 0);
        const totalBalance = totalOpening + totalMutations;
        const monthlyIn = (masukAgg.rows || []).reduce((s, r) => s + Math.abs(r.sum_amount || 0), 0);
        const monthlyOut = (keluarAgg.rows || []).reduce((s, r) => s + Math.abs(r.sum_amount || 0), 0);

        const bankMap = {};
        (banks || []).forEach((b) => { bankMap[b.id] = b; });
        const companyMap = {};
        (companies || []).forEach((c) => { companyMap[c.id] = c; });

        setState({
          loading: false,
          chartData,
          dailySummary,
          companyBalances,
          totalBalance,
          monthlyIn,
          monthlyOut,
          recent,
          bankMap,
          companyMap,
        });
      } catch (e) {
        console.error(e);
        if (active) setState({ loading: false, error: true });
      }
    };
    load();
    const unsub = base44.entities.Mutation.subscribe(() => load());
    return () => { active = false; unsub(); };
  }, []);

  if (state.loading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Memuat data...</div>;
  }

  const {
    chartData = [],
    dailySummary = [],
    companyBalances = [],
    totalBalance = 0,
    monthlyIn = 0,
    monthlyOut = 0,
    recent = [],
    bankMap = {},
    companyMap = {},
  } = state;
  const net = monthlyIn - monthlyOut;
  const monthName = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan konsolidasi keuangan {companyBalances.length} perusahaan · {monthName}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Saldo Semua Bank" value={formatCurrency(totalBalance)} icon={<Wallet className="h-5 w-5" />} accent="emerald" />
        <StatCard label={`Masuk (${monthName})`} value={formatCurrency(monthlyIn)} icon={<TrendingUp className="h-5 w-5" />} accent="blue" />
        <StatCard label={`Keluar (${monthName})`} value={formatCurrency(monthlyOut)} icon={<TrendingDown className="h-5 w-5" />} accent="rose" />
        <StatCard label="Net Arus Kas" value={formatSigned(net)} icon={net >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />} accent={net >= 0 ? "emerald" : "rose"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Arus Kas Harian</h2>
              <p className="text-xs text-muted-foreground">Uang masuk vs keluar per hari</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Masuk</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Keluar</span>
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              Belum ada mutasi bulan ini
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: "1px solid #eee", fontSize: 12 }} />
                <Bar dataKey="masuk" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="keluar" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-base font-semibold">Saldo per Perusahaan</h2>
          {companyBalances.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada perusahaan</p>
          ) : (
            <div className="space-y-3">
              {companyBalances.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.color || "#10b981"}20`, color: c.color || "#10b981" }}>
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.bankCount} rekening</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(c.balance)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DailySummary rows={dailySummary} />

      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold">Mutasi Terbaru</h2>
          <Link to="/mutasi" className="text-sm text-emerald-600 hover:underline">Lihat semua</Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Belum ada mutasi. Impor dari bank untuk mulai.</p>
        ) : (
          <div className="divide-y">
            {recent.map((m) => {
              const bank = bankMap[m.bank_account_id];
              const company = companyMap[m.company_id];
              return (
                <Link key={m.id} to="/mutasi/$id" params={{ id: m.id }} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/50">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${m.amount >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                    {m.amount >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.description || "(tanpa keterangan)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {bank ? `${bank.bank_name} - ${bank.account_number}` : "—"} · {company?.name || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Amount value={m.amount} />
                    <p className="text-xs text-muted-foreground">{m.mapped ? "Sudah dipetakan" : "Belum dipetakan"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }) {
  const accents = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-500",
  };
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accents[accent]}`}>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
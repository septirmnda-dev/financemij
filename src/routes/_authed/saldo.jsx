import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CalendarDays, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { BankAccountCombobox } from "@/components/BankAccountCombobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authed/saldo")({ component: SaldoPage });

function SaldoPage() {
  const [banks, setBanks] = useState(null);
  const [companies, setCompanies] = useState(null);
  const [bankId, setBankId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => {
      const [b, c] = await Promise.all([
        base44.entities.BankAccount.list(),
        base44.entities.Company.list(),
      ]);
      setBanks(b || []);
      setCompanies(c || []);
    })();
  }, []);

  useEffect(() => {
    if (!bankId) return;
    let active = true;
    (async () => {
      const bank = (banks || []).find((b) => b.id === bankId);
      if (!bank) return;
      const dateQuery = {};
      if (from) dateQuery.$gte = from;
      if (to) dateQuery.$lte = to;

      // Sum of mutations before "from" to get starting balance
      let beforeSum = 0;
      if (from) {
        const beforeAgg = await base44.entities.Mutation.aggregate({
          query: { bank_account_id: bankId, date: { $lt: from } },
          sum: "amount",
        });
        beforeSum = beforeAgg.rows?.[0]?.sum_amount || 0;
      }

      // Daily sums for the range
      const rangeQuery = { bank_account_id: bankId };
      if (from || to) rangeQuery.date = dateQuery;
      const dailyAgg = await base44.entities.Mutation.aggregate({
        query: rangeQuery,
        dateBucket: { field: "date", unit: "day" },
        sum: "amount",
      });

      if (!active) return;
      const dailyRows = (dailyAgg.rows || []).sort((a, b) => a.date.localeCompare(b.date));
      let running = (bank.opening_balance || 0) + beforeSum;
      const result = dailyRows.map((r) => {
        running += r.sum_amount || 0;
        return {
          date: r.date,
          masuk: r.sum_amount > 0 ? r.sum_amount : 0,
          keluar: r.sum_amount < 0 ? Math.abs(r.sum_amount) : 0,
          net: r.sum_amount || 0,
          balance: running,
        };
      });
      setRows(result);
    })();
    return () => { active = false; };
  }, [bankId, from, to, banks]);

  if (banks === null) return <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>;

  return (
    <div>
      <PageHeader title="Saldo Harian" subtitle="Mutasi saldo dana per rekening per hari" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Rekening</label>
          <BankAccountCombobox
            banks={banks || []}
            companies={companies || []}
            value={bankId}
            onChange={(v) => { setBankId(v); setRows(null); }}
            placeholder="Cari & pilih rekening..."
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Dari</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border bg-white px-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Sampai</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border bg-white px-3 text-sm" />
        </div>
      </div>

      {!bankId ? (
        <EmptyState icon={CalendarDays} title="Pilih rekening" description="Pilih rekening bank untuk melihat saldo harian." />
      ) : rows === null ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Memuat...</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Tidak ada mutasi" description="Tidak ada mutasi pada rentang tanggal ini." />
      ) : (
        <div className="rounded-xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Tanggal</TableHead>
                <TableHead className="text-right">Uang Masuk</TableHead>
                <TableHead className="text-right">Uang Keluar</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Saldo Akhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{formatDate(r.date)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-emerald-600">{r.masuk > 0 ? formatCurrency(r.masuk) : "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-rose-500">{r.keluar > 0 ? formatCurrency(r.keluar) : "—"}</TableCell>
                  <TableCell className={`text-right text-sm tabular-nums ${r.net >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {r.net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(r.net))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">{formatCurrency(r.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
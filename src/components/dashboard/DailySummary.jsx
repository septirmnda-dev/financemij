import { formatCurrency, formatDate } from "@/lib/format";

export default function DailySummary({ rows }) {
  const list = rows.slice().sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="rounded-xl border bg-white">
      <div className="border-b px-5 py-4">
        <h2 className="text-base font-semibold">Ringkasan Saldo Harian</h2>
        <p className="text-xs text-muted-foreground">Total mutasi masuk & keluar tiap hari bulan ini beserta saldo akhir hari</p>
      </div>
      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Belum ada mutasi bulan ini</p>
      ) : (
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-5 py-2 text-left font-medium">Tanggal</th>
                <th className="px-3 py-2 text-right font-medium">Masuk</th>
                <th className="px-3 py-2 text-right font-medium">Keluar</th>
                <th className="px-3 py-2 text-right font-medium">Net</th>
                <th className="px-5 py-2 text-right font-medium">Saldo Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((r) => (
                <tr key={r.date}>
                  <td className="px-5 py-2">{formatDate(r.date)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{formatCurrency(r.masuk)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-500">{formatCurrency(r.keluar)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${r.net >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {r.net < 0 ? "-" : ""}{formatCurrency(r.net)}
                  </td>
                  <td className="px-5 py-2 text-right font-medium tabular-nums">{formatCurrency(r.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
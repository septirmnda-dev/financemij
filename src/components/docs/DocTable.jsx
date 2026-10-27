export default function DocTable({ headers, rows }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-border pb-1.5 pr-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="break-inside-avoid border-b border-border/60 last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`py-2 pr-3 align-top text-[12px] leading-relaxed ${
                    j === 0 ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
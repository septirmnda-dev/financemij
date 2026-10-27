export default function FlowChain({ nodes }) {
  return (
    <ol className="mt-3 space-y-0">
      {nodes.map((node, i) => (
        <li key={i} className="flex gap-3 break-inside-avoid">
          <div className="flex w-6 shrink-0 flex-col items-center">
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700">
              {i + 1}
            </span>
            {i < nodes.length - 1 && <span className="w-px flex-1 bg-border" />}
          </div>
          <div className="pb-3">
            <p className="text-[13px] font-semibold leading-snug text-foreground">{node.label}</p>
            {node.detail && (
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{node.detail}</p>
            )}
            {node.branch && (
              <p className="mt-1 inline-block rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                {node.branch}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
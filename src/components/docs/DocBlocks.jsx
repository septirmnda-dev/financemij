import FlowChain from "@/components/docs/FlowChain";
import DocTable from "@/components/docs/DocTable";

const TONES = {
  info: "border-emerald-200 bg-emerald-50/60 text-emerald-900",
  warn: "border-amber-200 bg-amber-50/60 text-amber-900",
  stop: "border-rose-200 bg-rose-50/60 text-rose-900",
};

export default function DocBlocks({ blocks }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === "para") {
          return (
            <p key={i} className="text-[12.5px] leading-relaxed text-foreground/85">
              {block.text}
            </p>
          );
        }
        if (block.type === "subheading") {
          return (
            <h3 key={i} className="pt-2 text-[13px] font-semibold text-foreground break-after-avoid">
              {block.text}
            </h3>
          );
        }
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag
              key={i}
              className={`ml-4 space-y-1 text-[12.5px] leading-relaxed text-foreground/85 ${
                block.ordered ? "list-decimal" : "list-disc"
              }`}
            >
              {block.items.map((item, j) => (
                <li key={j} className="pl-1">{item}</li>
              ))}
            </Tag>
          );
        }
        if (block.type === "table") {
          return <DocTable key={i} headers={block.headers} rows={block.rows} />;
        }
        if (block.type === "flow") {
          return <FlowChain key={i} nodes={block.nodes} />;
        }
        if (block.type === "flowLines") {
          return (
            <pre
              key={i}
              className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11.5px] leading-relaxed text-foreground/80"
            >
              {block.lines.join("\n")}
            </pre>
          );
        }
        if (block.type === "callout") {
          return (
            <div
              key={i}
              className={`break-inside-avoid rounded-lg border p-3 ${TONES[block.tone] || TONES.info}`}
            >
              <p className="text-[12px] font-semibold">{block.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed opacity-90">{block.text}</p>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
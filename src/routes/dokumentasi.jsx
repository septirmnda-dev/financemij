import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import DocBlocks from "@/components/docs/DocBlocks";
import { docMeta, legend, sections } from "@/lib/docsContent";

export const Route = createFileRoute("/dokumentasi")({
  head: () => ({
    meta: [
      { title: "Spesifikasi Alur Aplikasi — Finance" },
      {
        name: "description",
        content: "Dokumen alur lengkap aplikasi konsolidasi keuangan untuk tim develop.",
      },
    ],
  }),
  component: DokumentasiPage,
});

const printStyles = `
@page { size: A4; margin: 16mm 14mm; }
@media print {
  .no-print { display: none !important; }
  .doc-page { background: #fff !important; }
  .doc-wrap { max-width: none !important; padding: 0 !important; }
  .doc-sheet { border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; }
  .doc-cover { break-after: page; }
  .doc-section { break-before: page; }
  h2, h3 { break-after: avoid; }
  thead { display: table-header-group; }
  tr, li { break-inside: avoid; }
}
`;

function DokumentasiPage() {
  return (
    <div className="doc-page min-h-screen bg-stone-100">
      <style>{printStyles}</style>

      <div className="doc-wrap mx-auto max-w-3xl px-5 py-10">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-emerald-600" /> Dokumen siap dibagikan
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Klik Unduh PDF, lalu pilih “Simpan sebagai PDF” pada dialog cetak.
            </p>
          </div>
          <Button onClick={() => window.print()}>
            <Download className="mr-2 h-4 w-4" /> Unduh PDF
          </Button>
        </div>

        <article className="doc-sheet rounded-2xl bg-white p-8 shadow-sm sm:p-12">
          {/* Sampul */}
          <header className="doc-cover">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Dokumentasi Teknis
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-stone-900 sm:text-4xl">
              {docMeta.title}
            </h1>
            <p className="mt-2 text-base text-stone-600">{docMeta.app}</p>
            <div className="mt-6 h-px w-full bg-stone-200" />

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-stone-400">Versi</p>
                <p className="font-medium text-stone-800">{docMeta.version}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-stone-400">Tanggal</p>
                <p className="font-medium text-stone-800">{docMeta.date}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-stone-400">Untuk</p>
                <p className="font-medium text-stone-800">{docMeta.audience}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-stone-400">Cakupan</p>
                <p className="font-medium text-stone-800">13 bagian · seluruh modul</p>
              </div>
            </div>

            <p className="mt-8 text-[13px] leading-relaxed text-stone-600">{docMeta.intro}</p>

            <div className="mt-8 rounded-xl border border-stone-200 bg-stone-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                Penanda status dalam dokumen
              </p>
              <ul className="mt-2 space-y-1.5">
                {legend.map((l) => (
                  <li key={l.label} className="flex gap-2 text-[12px] leading-relaxed text-stone-600">
                    <span className="w-4 shrink-0 font-semibold text-stone-900">{l.mark}</span>
                    <span>
                      <span className="font-medium text-stone-800">{l.label}</span> — {l.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </header>

          {/* Daftar isi */}
          <nav className="doc-section mt-10 pt-2">
            <h2 className="text-lg font-semibold tracking-tight text-stone-900">Daftar Isi</h2>
            <ol className="mt-4 space-y-1.5">
              {sections.map((s) => (
                <li key={s.id} className="flex gap-3 text-[12.5px] text-stone-700">
                  <span className="w-6 shrink-0 tabular-nums text-stone-400">{s.num}</span>
                  <a href={`#sec-${s.id}`} className="hover:text-emerald-700">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Isi */}
          {sections.map((section) => (
            <section key={section.id} id={`sec-${section.id}`} className="doc-section mt-10">
              <div className="flex items-baseline gap-3 border-b border-stone-200 pb-2">
                <span className="text-[12px] font-semibold tabular-nums text-emerald-700">
                  {section.num}
                </span>
                <h2 className="text-lg font-semibold tracking-tight text-stone-900">{section.title}</h2>
              </div>
              <div className="mt-4">
                <DocBlocks blocks={section.blocks} />
              </div>
            </section>
          ))}

          <footer className="mt-12 border-t border-stone-200 pt-4 text-[11px] leading-relaxed text-stone-400">
            {docMeta.title} · {docMeta.app} · v{docMeta.version} — {docMeta.date}. Isi disusun dari
            implementasi aplikasi yang berjalan; perilaku bertanda ○ masih menunggu keputusan.
          </footer>
        </article>
      </div>
    </div>
  );
}
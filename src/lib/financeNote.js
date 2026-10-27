import { base44 } from "@/api/base44Client";

function toDateOnly(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Menambah sejumlah bulan dengan mempertahankan tanggal yang sama.
 * Jika tanggal tidak ada di bulan tujuan, dipakai hari terakhir bulan itu.
 * Hasil selalu berupa tanggal lokal (tanpa pergeseran zona waktu).
 */
function addMonths(dateStr, months) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toDateOnly(d);
}

/** Tanggal catatan selalu sama persis dengan tanggal mutasi bank. */
function mutationDate(mutation) {
  return String(mutation.date || "").slice(0, 10);
}

/**
 * Membuat catatan finance dari sebuah mutasi.
 * Mendukung flag PPN (dengan nominal), tanda OPS (masuk Operasional),
 * dan Plot OPS (sebar nominal ke beberapa bulan dengan tanggal yang sama).
 */
export async function createNoteWithPlot(mutation, noteData, categories) {
  const cat = categories.find((c) => c.id === noteData.category_id);
  if (!cat) throw new Error("Sub Biaya tidak ditemukan");

  const totalAmt = noteData.amount ? Number(noteData.amount) : Math.abs(mutation.amount);
  if (!totalAmt || totalAmt <= 0) throw new Error("Nominal tidak valid");

  const months = noteData.is_plot_ops
    ? Math.max(1, Math.min(60, parseInt(noteData.plot_months, 10) || 1))
    : 1;
  const isPlot = months > 1;
  const isOps = !!(noteData.is_ops || isPlot);
  const hasPpn = !!noteData.has_ppn;
  const ppnAmount = hasPpn ? Number(noteData.ppn_amount) || 0 : 0;
  const signed = (v) => (mutation.direction === "keluar" ? -Math.abs(v) : Math.abs(v));

  const base = {
    mutation_id: mutation.id,
    bank_account_id: mutation.bank_account_id,
    company_id: mutation.company_id,
    direction: mutation.direction,
    category_id: cat.id,
    category_name: cat.name,
    category_type: isOps ? "operasional" : cat.type,
    description: noteData.description || "",
    transaction_type: noteData.transaction_type || "",
    media: noteData.media || "",
    has_ppn: hasPpn,
    ppn_amount: ppnAmount,
    is_ops: isOps,
  };

  if (isPlot) {
    const perMonth = Math.floor(totalAmt / months);
    const remainder = totalAmt - perMonth * months;
    const notes = [];
    for (let i = 0; i < months; i++) {
      const amt = i === months - 1 ? perMonth + remainder : perMonth;
      notes.push({
        ...base,
        date: addMonths(mutationDate(mutation), i),
        amount: signed(amt),
        is_plot_ops: true,
        plot_months: months,
        plot_index: i,
      });
    }
    await base44.entities.FinanceNote.bulkCreate(notes);
    return notes.length;
  }

  await base44.entities.FinanceNote.create({
    ...base,
    date: mutationDate(mutation),
    amount: signed(totalAmt),
    is_plot_ops: false,
    plot_months: 0,
    plot_index: 0,
  });
  return 1;
}
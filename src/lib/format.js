export function formatCurrency(amount, withSymbol = true) {
  const abs = Math.abs(amount ?? 0);
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return withSymbol ? `Rp ${formatted}` : formatted;
}

export function formatSigned(amount) {
  if (amount === 0 || amount == null) return "Rp 0";
  const prefix = amount < 0 ? "-" : "+";
  return `${prefix}${formatCurrency(amount)}`;
}

export function formatNumber(amount) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { syncBankAccount, syncPettyCash } from "@/lib/sheets.server";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Tulis ulang total harian + biaya admin baru satu rekening ke spreadsheet. */
export const syncBankAccountToSheets = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ bank_account_id: z.string().max(100), from: isoDate, to: isoDate }))
  .handler(({ data, context }) => syncBankAccount(context.getBase44(), data.bank_account_id, data.from, data.to));

/** Kirim transaksi petty cash yang belum tercatat ke spreadsheet petty cash. */
export const syncPettyCashToSheets = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(({ context }) => syncPettyCash(context.getBase44()));

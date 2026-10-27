import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { MappingPanel } from "@/components/mutasi/MappingPanel";

export function MutationMapDialog({ mutation, open, onOpenChange, onUpdated }) {
  if (!mutation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Petakan Mutasi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${mutation.amount >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
              {mutation.amount >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{formatCurrency(Math.abs(mutation.amount))}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{mutation.description || "(tanpa keterangan)"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(mutation.date)}</p>
            </div>
            <Badge className={mutation.direction === "masuk" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"} variant="secondary">
              {mutation.direction === "masuk" ? "Masuk" : "Keluar"}
            </Badge>
          </div>

          <MappingPanel mutation={mutation} onChanged={onUpdated} />
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Tutup</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
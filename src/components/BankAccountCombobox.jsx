import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function BankAccountCombobox({ banks = [], companies = [], value, onChange, placeholder = "Pilih rekening", className }) {
  const [open, setOpen] = useState(false);
  const companyMap = {};
  companies.forEach((c) => { companyMap[c.id] = c; });
  const label = (b) => `${companyMap[b.company_id]?.name || "-"} · ${b.bank_name} - ${b.account_number}`;
  const selected = banks.find((b) => b.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("w-72 justify-between font-normal", className)}>
          <span className="truncate">{selected ? label(selected) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Cari rekening / perusahaan..." />
          <CommandList className="max-h-[220px]">
            <CommandEmpty>Rekening tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {banks.map((b) => (
                <CommandItem
                  key={b.id}
                  value={`${companyMap[b.company_id]?.name || ""} ${b.bank_name} ${b.account_number}`}
                  onSelect={() => { onChange(b.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === b.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{label(b)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
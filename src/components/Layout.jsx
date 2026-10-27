import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Landmark,
  Upload,
  Receipt,
  FileText,
  Wallet,
  CalendarDays,
  Tags,
  Coins,
  TrendingUp,
  Megaphone,
  Percent,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navGroups = [
  {
    label: "Utama",
    items: [{ label: "Dashboard", path: "/", icon: LayoutDashboard }],
  },
  {
    label: "Master Data",
    items: [
      { label: "Perusahaan", path: "/perusahaan", icon: Building2 },
      { label: "Rekening Bank", path: "/rekening", icon: Landmark },
      { label: "Kategori", path: "/kategori", icon: Tags },
    ],
  },
  {
    label: "Transaksi",
    items: [
      { label: "Impor Mutasi", path: "/impor", icon: Upload },
      { label: "Mutasi Bank", path: "/mutasi", icon: Receipt },
      { label: "Catatan Finance", path: "/catatan", icon: FileText },
      { label: "Petty Cash", path: "/pettycash", icon: Coins },
      { label: "Saldo Iklan", path: "/saldo-iklan", icon: Megaphone },
    ],
  },
  {
    label: "Laporan",
    items: [
      { label: "Operasional", path: "/operasional", icon: Wallet },
      { label: "Arus Kas", path: "/arus-kas", icon: TrendingUp },
      { label: "PPN Masukan", path: "/ppn-masukan", icon: Percent },
      { label: "Saldo Harian", path: "/saldo", icon: CalendarDays },
    ],
  },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Finance</p>
          <p className="text-xs text-muted-foreground">Konsolidasi Kas</p>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="sticky top-0 z-10 mb-1 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-emerald-50 font-medium text-emerald-700"
                        : "text-foreground/70 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t px-3 py-2.5">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.full_name || user?.email || "User"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="mt-1 w-full justify-start text-muted-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" /> Keluar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-white lg:block">
        <SidebarContent />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button className="absolute right-3 top-4" onClick={() => setMobileOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white/80 px-4 backdrop-blur lg:px-6">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </header>
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
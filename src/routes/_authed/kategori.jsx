import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KodeBiayaList } from "@/components/kategori/KodeBiayaList";
import { SubBiayaList } from "@/components/kategori/SubBiayaList";
import { TransferKodeList } from "@/components/kategori/TransferKodeList";
import { LookupList } from "@/components/kategori/LookupList";
import { KodeTokoList } from "@/components/kategori/KodeTokoList";

export const Route = createFileRoute("/_authed/kategori")({ component: KategoriPage });

function KategoriPage() {
  return (
    <div>
      <PageHeader title="Kategori" subtitle="Kode Biaya, Sub Biaya, Kode Transfer Produk, Media, Jenis Transaksi & Kode Toko" />

      <Tabs defaultValue="kode-biaya">
        <TabsList>
          <TabsTrigger value="kode-biaya">Kode Biaya</TabsTrigger>
          <TabsTrigger value="sub-biaya">Sub Biaya</TabsTrigger>
          <TabsTrigger value="kode-transfer">Kode Transfer Produk</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="jenis">Jenis Transaksi</TabsTrigger>
          <TabsTrigger value="channel">Channel</TabsTrigger>
          <TabsTrigger value="kode-toko">Kode Toko</TabsTrigger>
        </TabsList>

        <TabsContent value="kode-biaya" className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
          <KodeBiayaList />
        </TabsContent>
        <TabsContent value="sub-biaya" className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
          <SubBiayaList />
        </TabsContent>
        <TabsContent value="kode-transfer" className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
          <TransferKodeList />
        </TabsContent>
        <TabsContent value="media" className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
          <LookupList group="media" title="Media" description="Dipilih saat memetakan pengeluaran operasional." />
        </TabsContent>
        <TabsContent value="jenis" className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
          <LookupList group="jenis" title="Jenis Transaksi" description="Dipilih saat memetakan uang masuk." />
        </TabsContent>
        <TabsContent value="channel" className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
          <LookupList group="channel" title="Channel" description="Daftar channel transaksi." />
        </TabsContent>
        <TabsContent value="kode-toko" className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
          <KodeTokoList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
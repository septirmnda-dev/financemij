/**
 * Isi dokumen spesifikasi alur aplikasi.
 * Semua perilaku ditulis berdasarkan implementasi yang berjalan saat dokumen dibuat.
 */

export const docMeta = {
  title: "Spesifikasi Alur Aplikasi",
  app: "Finance — Konsolidasi Kas Multi-Perusahaan",
  version: "1.0",
  date: "27 Oktober 2026",
  audience: "Tim Develop",
  intro:
    "Dokumen ini memetakan alur aplikasi dari pengguna masuk, menyiapkan data master, mengimpor mutasi bank, memetakan transaksi ke catatan finance, sampai laporan dan pemantauan saldo. Setiap alur disertai urutan langkah, aturan bisnis, perilaku data, serta kondisi gagal yang sudah ada di aplikasi.",
};

export const legend = [
  { mark: "✔", label: "Terverifikasi", text: "Perilaku ada di implementasi dan bisa diuji langsung di aplikasi." },
  { mark: "◐", label: "Asumsi", text: "Disimpulkan dari perilaku UI dan data, belum ditegaskan pemilik bisnis." },
  { mark: "○", label: "Perlu Keputusan", text: "Belum ditangani kode atau sengaja dibiarkan; butuh keputusan produk." },
];

export const modules = [
  ["Utama", "Dashboard", "Ringkasan saldo, arus kas harian, ringkasan saldo harian, mutasi terbaru"],
  ["Master Data", "Perusahaan", "Daftar & tambah perusahaan yang dikelola"],
  ["Master Data", "Rekening Bank", "Rekening per perusahaan beserta saldo awal"],
  ["Master Data", "Kategori", "Kode Biaya, Sub Biaya, Kode Transfer Produk, Kode Toko, daftar Jenis/Channel/Media"],
  ["Transaksi", "Impor Mutasi", "Unggah CSV/Excel, deteksi rekening, auto-map, simpan mutasi"],
  ["Transaksi", "Mutasi Bank", "Daftar mutasi semua rekening, filter, buka detail & pemetaan"],
  ["Transaksi", "Catatan Finance", "Semua catatan hasil pemetaan, filter, export Excel"],
  ["Transaksi", "Petty Cash", "Pencatatan kas kecil (pengisian & pemakaian), saldo berjalan"],
  ["Transaksi", "Saldo Iklan", "Top up & pemakaian saldo iklan per platform, impor rincian mutasi"],
  ["Laporan", "Operasional", "Rekap pengeluaran OPS dari bank, petty cash, dan saldo iklan"],
  ["Laporan", "Arus Kas", "Agregat bulanan masuk/keluar dan net per Kode Biaya"],
  ["Laporan", "PPN Masukan", "Daftar PPN dari catatan bertanda PPN beserta DPP"],
  ["Laporan", "Saldo Harian", "Mutasi saldo per rekening per hari"],
];

export const entities = [
  ["Company", "Unit bisnis yang dikelola", "1 → N BankAccount, Mutation, FinanceNote, PettyCash, AdBalance", "Punya `color` untuk identitas visual dashboard"],
  ["BankAccount", "Rekening bank per perusahaan", "company_id → Company; 1 → N Mutation", "`opening_balance` menjadi basis perhitungan saldo"],
  ["Category", "Kode Biaya (induk) & Sub Biaya (anak)", "parent_id → Category (self); 1 → N FinanceNote, PettyCash, AdBalance", "`direction` masuk/keluar + `type` menentukan pilihan saat mapping"],
  ["Mutation", "Baris mutasi bank hasil impor", "bank_account_id, company_id; 1 → N FinanceNote", "`amount` bertanda: masuk positif, keluar negatif; `mapped` status pemetaan"],
  ["FinanceNote", "Catatan finance hasil pemetaan", "mutation_id, category_id, company_id, bank_account_id", "Menyimpan nama & tipe kategori (denormalisasi); PPN, OPS, Plot OPS"],
  ["PettyCash", "Kas kecil: pengisian & pemakaian", "company_id, category_id", "`is_ops` memasukkan baris ke laporan Operasional"],
  ["AdBalance", "Top up & pemakaian saldo iklan", "company_id, parent_id, category_id", "`platform`, `card`, `trans_time` untuk urutan"],
  ["TransactionType", "Daftar pilihan: jenis, channel, media", "Dipakai di form pemetaan", "`group` = jenis | channel | media"],
  ["StoreCode", "Kode toko per platform + nomor rekening", "Menunjuk kategori platform saat mapping", "Platform: Shopee, Lazada, Tiktok"],
  ["User", "Akun pengguna (bawaan platform)", "—", "`role` admin / user; tidak ada pembatasan menu berbasis role ○"],
];

export const relations = [
  "Company 1 ── N BankAccount",
  "BankAccount 1 ── N Mutation",
  "Mutation 1 ── N FinanceNote  (satu mutasi boleh dipecah ke beberapa catatan)",
  "Category (Kode Biaya) 1 ── N Category (Sub Biaya)  · relasi induk–anak lewat parent_id",
  "Category 1 ── N FinanceNote / PettyCash / AdBalance",
  "Company 1 ── N FinanceNote / PettyCash / AdBalance  (company_id didenormalisasi)",
  "StoreCode N ── 1 Category  (kategori platform dicocokkan berdasarkan nama platform)",
];

export const sections = [
  {
    id: "gambaran",
    num: "1",
    title: "Gambaran Umum",
    blocks: [
      {
        type: "para",
        text: "Aplikasi ini adalah alat konsolidasi keuangan untuk beberapa perusahaan: mengubah mutasi bank mentah menjadi catatan finance yang terklasifikasi, lalu menyajikannya sebagai laporan operasional, arus kas, PPN masukan, dan saldo harian.",
      },
      {
        type: "para",
        text: "Alur besar sistem: data master disiapkan sekali, mutasi bank diimpor berulang tiap periode, setiap mutasi dipetakan ke satu atau beberapa catatan finance, dan seluruh laporan membaca catatan finance serta data kas/iklan.",
      },
      { type: "subheading", text: "1.1 Peta Modul" },
      {
        type: "table",
        headers: ["Grup", "Halaman", "Fungsi utama"],
        rows: modules,
      },
      { type: "subheading", text: "1.2 Arsitektur" },
      {
        type: "list",
        items: [
          "Frontend: React + TanStack Router, satu berkas route per halaman; seluruh halaman transaksi berada di balik gerbang autentikasi.",
          "Backend: layanan terkelola — autentikasi, basis data entitas, dan server function untuk parsing file serta penyimpanan mutasi.",
          "Penyimpanan berkas: file mutasi yang diunggah disimpan privat ✔; parser menerima tautan bertanda tangan sementara, bukan file publik.",
          "Pembacaan data: setiap halaman memuat data langsung dari entitas; angka total diambil dari agregasi server (bukan menjumlah seluruh baris di browser).",
          "Perhitungan laporan: dilakukan di browser dari hasil agregasi/filter, dengan batas jumlah baris per halaman (lihat Bagian 11).",
        ],
      },
      { type: "subheading", text: "1.3 Penanda Status" },
      {
        type: "table",
        headers: ["Penanda", "Arti", "Cara memakai"],
        rows: legend.map((l) => [l.mark, l.label, l.text]),
      },
    ],
  },
  {
    id: "data",
    num: "2",
    title: "Model Data & Relasi",
    blocks: [
      {
        type: "para",
        text: "Seluruh data transaksi bermuara pada tiga entitas: Mutation (fakta bank), FinanceNote (klasifikasi), dan kategori (kerangka biaya). Petty Cash dan Saldo Iklan adalah sumber paralel yang ikut masuk laporan Operasional.",
      },
      {
        type: "table",
        headers: ["Entitas", "Fungsi", "Relasi kunci", "Catatan teknis"],
        rows: entities,
      },
      { type: "subheading", text: "2.1 Peta Relasi" },
      { type: "flowLines", lines: relations },
      {
        type: "callout",
        tone: "info",
        title: "Denormalisasi disengaja",
        text: "FinanceNote menyimpan company_id, bank_account_id, category_name, dan category_type. Tujuannya agar filter dan laporan tidak perlu join berlapis. Konsekuensinya: perubahan nama kategori tidak mengubah catatan lama ✔.",
      },
    ],
  },
  {
    id: "auth",
    num: "3",
    title: "Alur 0 — Autentikasi & Akses",
    blocks: [
      {
        type: "para",
        text: "Tidak ada halaman publik yang menampilkan data. Semua route transaksi berada di bawah gerbang sesi; pengguna yang belum masuk akan diarahkan ke halaman login dan dikembalikan ke halaman tujuannya.",
      },
      {
        type: "flow",
        nodes: [
          { label: "Buka aplikasi", detail: "Route apa pun di dalam area aplikasi memicu pemeriksaan sesi." },
          { label: "Belum ada sesi", detail: "Dialihkan ke /login dengan parameter returnTo halaman asal." },
          { label: "Login", detail: "Email + password, atau masuk dengan akun Google." },
          { label: "Akun belum terdaftar di aplikasi", detail: "Ditampilkan layar pemberitahuan; pengguna harus diundang lebih dulu.", branch: "Perlu undangan admin ○" },
          { label: "Sesi valid", detail: "Halaman terbuka; konteks pengguna tersedia untuk seluruh halaman anak." },
          { label: "Keluar", detail: "Sesi dihapus lalu kembali ke halaman login." },
        ],
      },
      {
        type: "table",
        headers: ["Aspek", "Perilaku", "Status"],
        rows: [
          ["Penyedia autentikasi", "Layanan autentikasi platform: token sesi, verifikasi email, reset password", "✔"],
          ["Halaman tersedia", "Login, Daftar, Lupa Password, Reset Password (token dari email)", "✔"],
          ["Gerbang akses", "Satu gerbang untuk semua halaman aplikasi; tidak ada pengecekan ulang per halaman", "✔"],
          ["Peran pengguna", "role admin / user tersimpan di data pengguna", "✔"],
          ["Pembatasan menu per peran", "Belum ada; semua pengguna yang masuk melihat seluruh menu", "○"],
          ["Aturan akses data per pengguna", "Belum diterapkan — data terbuka bagi seluruh pengguna yang login", "○"],
        ],
      },
      {
        type: "callout",
        tone: "stop",
        title: "Perlu keputusan: isolasi data",
        text: "Saat ini siapa pun yang lolos gerbang login dapat membaca dan mengubah seluruh data 15 perusahaan. Jika tiap perusahaan harus terpisah, perlu aturan akses pada entitas dan pemetaan pengguna ke perusahaan.",
      },
    ],
  },
  {
    id: "master",
    num: "4",
    title: "Alur 1 — Setup Master Data",
    blocks: [
      {
        type: "para",
        text: "Setup dilakukan sekali di awal dan menjadi prasyarat semua alur berikutnya. Urutan di bawah wajib diikuti karena setiap langkah bergantung pada data sebelumnya.",
      },
      {
        type: "flow",
        nodes: [
          { label: "1. Perusahaan", detail: "Nama perusahaan dan warna identitas. Menjadi induk semua data transaksi." },
          { label: "2. Rekening Bank", detail: "Pilih perusahaan, isi nama bank, nomor rekening, pemilik, dan saldo awal." },
          { label: "3. Kode Biaya", detail: "Kategori induk dengan arah (masuk/keluar) dan tipe (operasional, HPP, pendapatan, modal, lainnya)." },
          { label: "4. Sub Biaya", detail: "Kategori anak di bawah Kode Biaya; boleh punya kata kunci untuk auto-mapping." },
          { label: "5. Kode Transfer Produk", detail: "Sub kategori khusus untuk uang masuk, berisi inisial produk (CF, MJ, AS, …)." },
          { label: "6. Kode Toko", detail: "Kode toko per platform (Shopee/Lazada/Tiktok) beserta nomor rekeningnya." },
          { label: "7. Daftar Pilihan", detail: "Jenis Transaksi, Channel, dan Media yang muncul pada form pemetaan." },
        ],
      },
      { type: "subheading", text: "4.1 Validasi & Ketergantungan" },
      {
        type: "table",
        headers: ["Data", "Field wajib", "Dipakai oleh", "Perilaku bila kosong"],
        rows: [
          ["Perusahaan", "name", "Semua entitas transaksi", "Rekening tidak bisa dibuat tanpa perusahaan"],
          ["Rekening Bank", "company_id, bank_name, account_number", "Impor mutasi, saldo harian", "Nomor rekening adalah kunci deteksi file otomatis"],
          ["Kode Biaya", "name, direction, type", "Pemetaan, laporan", "Tidak muncul sebagai pilihan pemetaan"],
          ["Sub Biaya", "name + parent_id", "Pemetaan, Catatan Finance", "Sub Biaya tanpa induk tidak tampil di form pemetaan keluar"],
          ["Kode Transfer Produk", "nama kategori induk persis \"Kode Transfer Produk\"", "Pemetaan uang masuk", "Daftar kode kosong bila nama induk berbeda ○"],
          ["Kode Toko", "platform, code", "Auto-map uang masuk", "Deteksi kode toko dilewati"],
          ["Media / Jenis Transaksi", "name, group", "Form pemetaan", "Dropdown kosong, field boleh dilewati"],
        ],
      },
      {
        type: "callout",
        tone: "warn",
        title: "Ketergantungan nama pada Kode Transfer Produk",
        text: "Form pemetaan uang masuk mencari kategori induk dengan nama tepat \"Kode Transfer Produk\". Mengganti nama kategori tersebut akan mengosongkan pilihan kode. Perlu diganti mekanisme penanda khusus ◐.",
      },
    ],
  },
  {
    id: "impor",
    num: "5",
    title: "Alur 2 — Impor Mutasi Bank",
    blocks: [
      {
        type: "para",
        text: "Alur ini titik masuk seluruh data. Satu sesi dapat mengunggah banyak file sekaligus, dan setiap file dipetakan ke satu rekening.",
      },
      {
        type: "flow",
        nodes: [
          { label: "Pilih file (bisa banyak)", detail: "Menerima .csv, .xlsx, .xls, .json. Setiap file langsung dibaca untuk mencari nomor rekening." },
          { label: "Deteksi rekening", detail: "Nomor rekening terdaftar dicari pada 2.000 karakter pertama file; fallback pola \"no. rekening / nomor rekening / account\"." },
          { label: "Rekening terdeteksi?", detail: "Jika cocok, file langsung diparse otomatis tanpa menekan tombol.", branch: "Tidak cocok → pengguna memilih rekening manual, lalu klik \"Baca File\"" },
          { label: "Parse file", detail: "Parser CSV langsung untuk BCA/BRI/Mandiri; bila gagal atau format lain (Excel), diteruskan ke pembaca otomatis berbasis AI." },
          { label: "Auto-mapping per baris", detail: "Kata kunci kategori dicocokkan; bila uang masuk belum cocok, kode toko dicocokkan lalu diarahkan ke kategori platform." },
          { label: "Pratinjau & hitung", detail: "Jumlah baris dan jumlah baris terpetakan ditampilkan per file sebelum disimpan." },
          { label: "Konfirmasi Impor", detail: "Dedup terhadap data tersimpan, simpan mutasi, lalu simpan catatan finance untuk baris yang terpetakan." },
          { label: "Selesai", detail: "Notifikasi total impor, jumlah duplikat dilewati, jumlah terpetakan; pengguna diarahkan ke Mutasi Bank." },
        ],
      },
      { type: "subheading", text: "5.1 Pengenalan Format File" },
      {
        type: "table",
        headers: ["Format", "Penanda header", "Pemisah", "Kolom yang dibaca"],
        rows: [
          ["BCA", "default bila penanda lain tidak ditemukan", ",", "Tanggal (sel pertama), keterangan, sel bermuatan CR/DB/DR + saldo di sel berikutnya"],
          ["BRI (IBIZ)", "NOREK + TGL_TRAN + MUTASI_DEBET", ",", "TGL_TRAN, REMARK_CUSTOM / TRREMK / DESK_TRAN, MUTASI_DEBET, MUTASI_KREDIT, SALDO_AKHIR_MUTASI"],
          ["Mandiri", "ACCOUNTNO + POSTDATE + CREDIT AMOUNT", ";", "POSTDATE, REMARKS / ADDITIONALDESC, CREDIT AMOUNT, DEBIT AMOUNT, CLOSE BALANCE"],
          ["Format lain", "Tidak dikenali parser", "—", "Diteruskan ke pembaca otomatis (AI) dengan skema keluaran tetap"],
        ],
      },
      { type: "subheading", text: "5.2 Aturan Parsing" },
      {
        type: "table",
        headers: ["Aturan", "Implementasi", "Status"],
        rows: [
          ["Nominal dengan pemisah ribuan titik", "Bila koma terakhir muncul setelah titik terakhir → titik dibuang, koma jadi desimal; sebaliknya koma dibuang", "✔"],
          ["Penanda CR / DB / DR", "CR = uang masuk, DB atau DR = uang keluar; nominal disimpan bertanda", "✔"],
          ["Transaksi PEND (BCA)", "Tanggal diganti tanggal akhir periode yang tertulis di file; bila tidak ada, pakai tanggal hari ini", "✔"],
          ["Jam transaksi", "Diambil dari pola HH:MM atau HH.MM pada sel tanggal selama jam ≤ 23", "✔"],
          ["Baris header / metadata", "Dilewati berdasarkan pola teks (No. rekening, Periode, Informasi Rekening, dsb.)", "✔"],
          ["Saldo setelah transaksi", "Disimpan bila kolomnya tersedia; dipakai sebagai bagian kunci dedup", "✔"],
          ["Waktu transaksi ikut tersimpan saat impor", "Parser menghasilkan jam, tetapi form impor tidak mengirimkannya ke penyimpanan", "○"],
        ],
      },
      { type: "subheading", text: "5.3 Prioritas Auto-Mapping" },
      {
        type: "list",
        ordered: true,
        items: [
          "Kata kunci kategori: hanya kategori dengan arah sama; kata kunci terpanjang yang cocok menang.",
          "Kode toko (khusus uang masuk): dicocokkan sebagai kata utuh, kode terpanjang menang, lalu diarahkan ke kategori platform dengan nama sama (Shopee/Lazada/Tiktok).",
          "Tidak ada kecocokan: mutasi tetap disimpan tanpa catatan finance, status \"Belum\" dipetakan, menunggu pemetaan manual.",
          "Catatan hasil auto-map memakai kategori, tipe, dan keterangan mutasi; tanpa media, PPN, atau OPS.",
        ],
      },
      { type: "subheading", text: "5.4 Duplikasi & Penyimpanan" },
      {
        type: "table",
        headers: ["Hal", "Perilaku", "Status"],
        rows: [
          ["Kunci dedup", "Tanggal | nominal | keterangan (huruf besar) | saldo setelah transaksi", "✔"],
          ["Cakupan pemeriksaan", "Mutasi pada rekening yang sama di rentang tanggal file, maksimal 1.000 baris", "✔"],
          ["Duplikat di dalam file", "Baris kedua dengan kunci sama dilewati", "✔"],
          ["Pemeriksaan gagal", "Impor tetap dilanjutkan tanpa dedup agar data tidak hilang", "✔"],
          ["Penyimpanan", "Mutasi disimpan massal, lalu catatan finance massal untuk baris terpetakan", "✔"],
          ["Nama file asal", "Disimpan di setiap mutasi untuk penelusuran", "✔"],
          ["Berkas sumber", "Disimpan privat; parser memakai tautan bertanda tangan sementara", "✔"],
        ],
      },
      {
        type: "callout",
        tone: "warn",
        title: "Risiko yang perlu diketahui tim",
        text: "Dedup bergantung pada keterangan dan saldo. Bila format bank mengubah keterangan (mis. potong teks panjang) atau saldo tidak ada, mutasi yang sama dapat masuk dua kali ◐. Disarankan menambahkan penanda unik dari bank bila tersedia.",
      },
    ],
  },
  {
    id: "pemetaan",
    num: "6",
    title: "Alur 3 — Pemetaan Mutasi ke Catatan Finance",
    blocks: [
      {
        type: "para",
        text: "Pemetaan adalah inti pekerjaan harian: satu mutasi bank dipecah menjadi satu atau beberapa catatan finance. Panel pemetaan dipakai bersama oleh dialog di daftar mutasi dan halaman detail mutasi, sehingga form selalu identik.",
      },
      {
        type: "flow",
        nodes: [
          { label: "Buka mutasi", detail: "Dari daftar Mutasi Bank (ikon pensil) atau halaman detail mutasi." },
          { label: "Panel menampilkan progres", detail: "Total nominal mutasi vs nominal yang sudah dipetakan, sisa, dan riwayat catatan." },
          { label: "Isi Kode Biaya", detail: "Daftar dibatasi arah mutasi: hanya kategori masuk untuk uang masuk, keluar untuk uang keluar." },
          { label: "Isi Sub Biaya", detail: "Otomatis tersaring sesuai Kode Biaya terpilih; untuk uang masuk diganti pilihan Kode Transfer Produk." },
          { label: "Nominal", detail: "Boleh dikosongkan — sistem memakai seluruh sisa mutasi. Tidak boleh melebihi sisa." },
          { label: "Atribut tambahan", detail: "Uang keluar: Media, PPN + nominal, OPS, Plot OPS (jumlah bulan). Uang masuk: Jenis Transaksi dan Kode Toko." },
          { label: "Simpan", detail: "Satu catatan dibuat; bila Plot OPS dipilih, dibuat N catatan sebaran bulanan." },
          { label: "Ulangi sampai sisa 0", detail: "Setelah sisa habis, tombol \"Tandai Selesai\" muncul untuk mengubah status mutasi." },
        ],
      },
      { type: "subheading", text: "6.1 Aturan Penulisan Catatan" },
      {
        type: "table",
        headers: ["Aturan", "Implementasi", "Status"],
        rows: [
          ["Tanda nominal", "Uang keluar disimpan negatif, uang masuk positif", "✔"],
          ["Tanggal catatan", "Selalu sama dengan tanggal mutasi bank; bukan tanggal input", "✔"],
          ["Tipe kategori", "Mengikuti kategori, kecuali OPS/Plot OPS → dipaksa \"operasional\"", "✔"],
          ["Nominal kosong", "Diisi otomatis sebesar sisa mutasi", "✔"],
          ["Nominal melebihi sisa", "Ditolak dengan pesan \"Nominal melebihi sisa mutasi\"", "✔"],
          ["Plot OPS", "Nominal dibagi rata; sisa pembulatan diberikan di bulan terakhir; tanggal dipertahankan (disesuaikan ke hari terakhir bila bulan lebih pendek)", "✔"],
          ["Batas bulan plot", "1 sampai 60 bulan", "✔"],
          ["PPN", "Nominal PPN disimpan terpisah dari nominal catatan; tidak mengubah nominal", "✔"],
          ["Status mutasi", "Menjadi \"Sudah dipetakan\" hanya lewat tombol Tandai Selesai, atau otomatis bila baris terpetakan saat impor", "✔"],
          ["Mengubah mutasi", "Catatan finance tidak ikut terkoreksi bila tanggal/nominal mutasi diubah", "○"],
        ],
      },
      { type: "subheading", text: "6.2 Aksi pada Catatan" },
      {
        type: "list",
        items: [
          "Edit catatan: mengubah kategori, nominal, keterangan, media, PPN, OPS, dan setelan plot. Nominal kembali dihitung terhadap sisa.",
          "Hapus catatan: menghapus satu catatan; sisa mutasi otomatis bertambah dan form tambah muncul kembali.",
          "Catatan plot adalah baris terpisah per bulan; menghapus satu baris tidak menghapus baris bulan lain.",
          "Mutasi tanpa catatan tetap muncul di daftar dengan status \"Belum\" agar bisa ditindaklanjuti.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Kapan mutasi dianggap selesai",
        text: "Progres 100% tidak otomatis mengubah status. Pengguna harus menekan Tandai Selesai, sehingga status dapat dipakai sebagai penanda \"sudah diperiksa\" ◐.",
      },
    ],
  },
  {
    id: "modul",
    num: "7",
    title: "Alur 4 — Modul Transaksi & Laporan Lanjutan",
    blocks: [
      { type: "subheading", text: "7.1 Catatan Finance" },
      {
        type: "para",
        text: "Daftar seluruh catatan hasil pemetaan. Filter: perusahaan, Kode Biaya, Sub Biaya (otomatis menyaring sesuai Kode Biaya), dan rentang tanggal. Maksimal 300 baris terbaru ditampilkan per pemuatan.",
      },
      {
        type: "list",
        items: [
          "Kolom: tanggal, sumber (inisial perusahaan), kode biaya / sub biaya, media, keterangan (+ penanda PPN), nominal bertanda.",
          "Export Excel hanya untuk baris yang dicentang; kolom mencakup perusahaan, bank, kode biaya, sub biaya, media, nominal PPN, dan nominal.",
          "Pengurutan: tanggal terbaru di atas; export justru diurutkan naik agar kronologis.",
        ],
      },
      { type: "subheading", text: "7.2 PPN Masukan" },
      {
        type: "para",
        text: "Hanya membaca catatan finance yang ditandai PPN. Dasar Pengenaan Pajak dihitung dari nominal catatan dikurangi nominal PPN.",
      },
      {
        type: "table",
        headers: ["Elemen", "Rumus / sumber", "Status"],
        rows: [
          ["Total PPN", "Jumlah ppn_amount seluruh catatan bertanda PPN", "✔"],
          ["Total DPP", "Jumlah |nominal catatan| − jumlah PPN", "✔"],
          ["Rekap bulanan", "Agregasi PPN per bulan dari tanggal catatan", "✔"],
          ["Tarif", "Tidak dihitung sistem — hanya nominal PPN yang disimpan", "○"],
          ["Filter", "Perusahaan dan rentang tanggal", "✔"],
          ["Export", "Excel .xlsx lengkap dengan DPP dan PPN", "✔"],
        ],
      },
      { type: "subheading", text: "7.3 Petty Cash" },
      {
        type: "para",
        text: "Kas kecil dicatat manual, terpisah dari rekening bank. Dua arah: pengisian (masuk) dan pemakaian (keluar). Sisa uang dihitung berjalan per perusahaan secara kronologis.",
      },
      {
        type: "list",
        items: [
          "Form transaksi: perusahaan, tanggal, arah, nominal, keterangan, jenis uang (tunai/nama bank), Kode Biaya & Sub Biaya, dan tanda Operasional.",
          "Sisa uang dihitung ulang dari seluruh transaksi perusahaan tersebut; bukan saldo tersimpan.",
          "Baris yang ditandai Operasional ikut masuk Laporan Operasional dengan penanda team \"Petty Cash\".",
          "Export Excel memuat kolom uang masuk, uang keluar, sisa uang, jenis uang, penanda operasional, dan kategori.",
        ],
      },
      { type: "subheading", text: "7.4 Saldo Iklan" },
      {
        type: "para",
        text: "Mencatat top up dan pemakaian saldo iklan per platform. Dapat diisi manual atau diimpor dari file rincian mutasi (satu file, banyak kartu).",
      },
      {
        type: "flow",
        nodes: [
          { label: "Unggah file", detail: "Excel multi-sheet atau CSV. Setiap sheet dianggap satu kartu." },
          { label: "Cari baris header", detail: "Header dikenali dari kolom \"Tanggal Transaksi\"; sheet tanpa header dilewati." },
          { label: "Baca baris", detail: "Kolom deskripsi, debit, credit, dan kartu. Credit = top up (masuk), debit = pemakaian (keluar)." },
          { label: "Deteksi platform", detail: "Dari deskripsi: FACEBK/FACEBOOK → Meta, TIKTOK, GOOGLE, SHOPEE." },
          { label: "Deteksi perusahaan", detail: "Dari nama kartu (JOZZ, MONCER, PANCING/PARADISE, BURUNG/KICAU, PUSPUS); bila tidak ada, dipakai perusahaan pilihan pengguna." },
          { label: "Dedup & simpan", detail: "Kunci tanggal | nominal | deskripsi | kartu, lalu simpan bertahap 200 baris per batch." },
          { label: "Saldo per platform", detail: "Top up − pemakaian per platform, ditampilkan sebagai ringkasan." },
        ],
      },
      {
        type: "callout",
        tone: "warn",
        title: "Keterbatasan impor saldo iklan",
        text: "Deteksi perusahaan memakai daftar kata kunci kartu yang ditulis tetap di kode. Kartu baru di luar daftar akan masuk ke perusahaan pilihan pengguna ◐ — perlu dipindahkan ke data master.",
      },
      { type: "subheading", text: "7.5 Laporan Operasional" },
      {
        type: "para",
        text: "Menggabungkan tiga sumber pengeluaran ke dalam satu laporan bertag Team dan Sumber: catatan bank yang ditandai OPS/Plot OPS, pemakaian Petty Cash, dan pemakaian Saldo Iklan.",
      },
      {
        type: "table",
        headers: ["Sumber data", "Filter", "Label Team", "Status"],
        rows: [
          ["FinanceNote dengan is_ops = true", "Arah keluar + rentang tanggal", "Laporan", "✔"],
          ["PettyCash arah keluar", "Rentang tanggal", "Petty Cash", "✔"],
          ["AdBalance arah keluar", "Rentang tanggal", "Komcards", "✔"],
          ["Sumber (inisial)", "Dari nama perusahaan lewat daftar tetap MIJ, KICAU, PARADISE, MR JOZZ, PUSPUS", "—", "◐"],
        ],
      },
      {
        type: "list",
        items: [
          "Total per Kode Biaya ditampilkan sebagai baris persentase terhadap total keseluruhan.",
          "Kolom Jumlah Item selalu 1 dan Harga Satuan sama dengan nominal — placeholder sampai data kuantitas tersedia ○.",
          "Export saat ini menghasilkan berkas CSV bertitik koma dengan pemisah BOM, bukan .xlsx, meski tombolnya berlabel Export Excel ◐.",
        ],
      },
      { type: "subheading", text: "7.6 Laporan Arus Kas" },
      {
        type: "para",
        text: "Murni membaca catatan finance, bukan mutasi bank. Karena itu arus kas baru lengkap setelah pemetaan dilakukan.",
      },
      {
        type: "table",
        headers: ["Keluaran", "Perhitungan", "Status"],
        rows: [
          ["Kas masuk per bulan", "Jumlah |nominal| catatan arah masuk, dikelompokkan per bulan", "✔"],
          ["Kas keluar per bulan", "Jumlah |nominal| catatan arah keluar, dikelompokkan per bulan", "✔"],
          ["Arus kas bersih", "Masuk − keluar, per bulan dan total", "✔"],
          ["Arus kas per Kode Biaya", "Net catatan dikelompokkan ke Kode Biaya induk, diurutkan menurut nilai absolut", "✔"],
          ["Export", "CSV dua bagian: rekap bulanan dan rekap per Kode Biaya", "✔"],
        ],
      },
      { type: "subheading", text: "7.7 Saldo Harian per Rekening" },
      {
        type: "para",
        text: "Menampilkan mutasi harian satu rekening beserta saldo berjalan. Saldo awal dihitung dari saldo awal rekening ditambah seluruh mutasi sebelum tanggal filter.",
      },
      {
        type: "list",
        items: [
          "Masuk, keluar, dan net diambil dari agregasi harian mutasi rekening tersebut.",
          "Saldo akhir hari = saldo awal rekening + mutasi sebelum periode + akumulasi net sampai hari itu.",
          "Rekening wajib dipilih lebih dulu; tanpa rekening halaman hanya menampilkan arahan.",
        ],
      },
    ],
  },
  {
    id: "dashboard",
    num: "8",
    title: "Alur 5 — Dashboard & Pemantauan Saldo",
    blocks: [
      {
        type: "para",
        text: "Dashboard adalah ringkasan lintas perusahaan. Semua angka berasal dari agregasi mutasi bank, bukan catatan finance, sehingga saldo bisa berbeda dengan laporan arus kas sampai pemetaan selesai.",
      },
      {
        type: "table",
        headers: ["Komponen", "Sumber & rumus", "Status"],
        rows: [
          ["Total saldo semua bank", "Σ saldo awal seluruh rekening + Σ seluruh mutasi", "✔"],
          ["Masuk / Keluar bulan ini", "Agregasi mutasi bulan berjalan per arah", "✔"],
          ["Net arus kas", "Masuk − keluar bulan berjalan", "✔"],
          ["Grafik arus kas harian", "Agregasi harian mutasi bulan berjalan", "✔"],
          ["Saldo per perusahaan", "Σ saldo awal rekening perusahaan + Σ mutasi perusahaan", "✔"],
          ["Ringkasan saldo harian", "Saldo awal bulan + akumulasi net harian; masuk, keluar, net, saldo akhir per hari", "✔"],
          ["Mutasi terbaru", "8 mutasi terakhir, langsung membuka detail", "✔"],
          ["Pembaruan otomatis", "Halaman berlangganan perubahan data mutasi dan memuat ulang saat ada perubahan", "✔"],
        ],
      },
      {
        type: "callout",
        tone: "stop",
        title: "Asumsi perhitungan saldo",
        text: "Seluruh perhitungan menganggap saldo awal rekening diisi untuk posisi SEBELUM semua mutasi yang tersimpan. Bila saldo awal diisi dengan saldo terkini, semua saldo akan berlebih. Perlu aturan baku pengisian saldo awal ○.",
      },
    ],
  },
  {
    id: "aturan",
    num: "9",
    title: "Aturan Bisnis Lintas Modul",
    blocks: [
      {
        type: "para",
        text: "Daftar aturan berikut mengikat beberapa modul sekaligus. Kolom implementasi menunjukkan di mana aturan ditegakkan, sehingga perubahan tidak dilakukan di tempat yang salah.",
      },
      {
        type: "table",
        headers: ["ID", "Aturan", "Ditegakkan di", "Status"],
        rows: [
          ["R-01", "Nominal keluar negatif, masuk positif di semua entitas uang", "Mutation, FinanceNote, PettyCash", "✔"],
          ["R-02", "Tanggal catatan finance menyalin tanggal mutasi", "Pembuatan catatan", "✔"],
          ["R-03", "Plot OPS membagi rata dengan sisa di bulan terakhir", "Pembuatan catatan", "✔"],
          ["R-04", "Satu mutasi boleh punya banyak catatan, total tidak melebihi nominal mutasi", "Panel pemetaan", "✔"],
          ["R-05", "Auto-map memilih kata kunci terpanjang dengan arah sama", "Impor", "✔"],
          ["R-06", "Kode toko dicocokkan sebagai kata utuh, kode terpanjang menang", "Impor", "✔"],
          ["R-07", "PEND BCA memakai tanggal akhir periode", "Parser BCA", "✔"],
          ["R-08", "OPS / Plot OPS memaksa tipe kategori menjadi operasional", "Pembuatan catatan", "✔"],
          ["R-09", "Hanya catatan is_ops yang masuk laporan Operasional dari jalur bank", "Laporan Operasional", "✔"],
          ["R-10", "Sumber ditentukan dari nama perusahaan via daftar tetap 5 kode", "Laporan", "◐"],
          ["R-11", "Daftar baris dibatasi per pemuatan (300/500/1.000) tanpa paginasi", "Banyak halaman", "○"],
          ["R-12", "Export Excel memakai pustaka spreadsheet; sebagian laporan masih CSV", "Laporan", "◐"],
          ["R-13", "Berkas impor disimpan privat dan diakses lewat tautan sementara", "Impor", "✔"],
          ["R-14", "Nomor invoice PPN tidak disimpan; dibuat dari data saat ditampilkan", "PPN Masukan", "○"],
        ],
      },
    ],
  },
  {
    id: "gagal",
    num: "10",
    title: "Kondisi Gagal, Validasi & Perilaku Tepi",
    blocks: [
      {
        type: "table",
        headers: ["Skenario", "Perilaku saat ini", "Dampak bagi tim"],
        rows: [
          ["File impor tanpa baris terbaca", "Notifikasi error per file, file tetap di daftar dengan status Error", "Pengguna harus memilih rekening atau mengganti file"],
          ["Rekening tidak terdeteksi", "File menunggu; tombol Baca File muncul setelah rekening dipilih", "Perlu pemetaan manual per file"],
          ["Parse otomatis gagal", "Diteruskan ke pembaca AI; bila tetap gagal, muncul pesan error", "Biaya proses lebih tinggi untuk format tak dikenal"],
          ["Salah pilih rekening", "Mutasi tersimpan di rekening tersebut tanpa peringatan", "Perlu hapus manual; belum ada pembatalan impor ○"],
          ["Nominal pemetaan melebihi sisa", "Ditolak sebelum disimpan", "Aman"],
          ["Mutasi sudah dipetakan lalu diedit", "Catatan finance lama tidak ikut berubah", "Laporan bisa tidak sinkron ○"],
          ["Hapus catatan", "Langsung terhapus dengan konfirmasi browser; tidak ada jejak audit", "Tidak ada riwayat perubahan ○"],
          ["Filter tanggal kosong", "Semua data dalam batas baris dimuat", "Bisa terasa lambat bila data besar"],
          ["Tanggal kosong pada file", "Dipaksa ke tanggal hari ini", "Berpotensi salah periode"],
          ["Plot OPS pada bulan tanpa tanggal yang sama", "Tanggal digeser ke hari terakhir bulan tersebut", "Perlu diketahui saat rekonsiliasi"],
          ["Perusahaan tanpa rekening", "Dashboard menampilkan saldo 0 rekening", "Bukan error, hanya belum ada data"],
        ],
      },
    ],
  },
  {
    id: "terbuka",
    num: "11",
    title: "Keterbatasan Terverifikasi & Pertanyaan Terbuka",
    blocks: [
      {
        type: "para",
        text: "Poin berikut ditemukan saat menelusuri implementasi. Semuanya butuh keputusan sebelum dipakai penuh oleh tim finance.",
      },
      {
        type: "table",
        headers: ["ID", "Temuan", "Dampak", "Usulan"],
        rows: [
          ["Q-01", "Tidak ada aturan akses per pengguna/perusahaan", "Seluruh data terbuka bagi siapa pun yang login", "Terapkan aturan akses entitas + pemetaan pengguna–perusahaan"],
          ["Q-02", "Batas baris 300/500/1.000 per pemuatan, tanpa halaman berikutnya", "Data lama tidak muncul di daftar dan laporan", "Tambahkan paginasi atau filter wajib per periode"],
          ["Q-03", "Waktu transaksi tidak tersimpan saat impor mutasi", "Urutan dalam satu hari tidak akurat", "Kirim trans_time dari form impor"],
          ["Q-04", "Daftar Sumber hanya 5 kode tetap di kode program", "Perusahaan baru tidak punya inisial", "Pindahkan ke data master perusahaan"],
          ["Q-05", "Kode Transfer Produk dikenali dari nama kategori", "Rename kategori merusak pilihan", "Tambahkan penanda tipe kategori khusus"],
          ["Q-06", "Tarif PPN tidak divalidasi (11%)", "Nominal PPN bisa salah input", "Simpan tarif acuan & validasi selisih"],
          ["Q-07", "Tidak ada jejak audit perubahan/hapus", "Tidak bisa menelusuri koreksi", "Aktifkan riwayat perubahan per entitas"],
          ["Q-08", "Sebagian tombol Export Excel masih CSV", "Pengguna mengira mendapat .xlsx", "Samakan seluruh export ke spreadsheet"],
          ["Q-09", "Saldo awal dipakai sebagai basis seluruh mutasi", "Saldo bisa berlebih bila diisi saldo terkini", "Tetapkan aturan tanggal saldo awal"],
          ["Q-10", "Mutasi salah rekening tidak bisa dibatalkan massal", "Pembersihan manual satu per satu", "Tambahkan hapus/ pindah per sesi impor"],
          ["Q-11", "Pemetaan belum punya kolom Media untuk uang masuk", "Media hanya berlaku pada pengeluaran", "Konfirmasi kebutuhan"],
          ["Q-12", "Jumlah Item & Harga Satuan di laporan operasional bersifat placeholder", "Tidak bisa dipakai hitung kuantitas", "Tambahkan field kuantitas pada catatan"],
        ],
      },
    ],
  },
  {
    id: "glosarium",
    num: "12",
    title: "Glosarium",
    blocks: [
      {
        type: "table",
        headers: ["Istilah", "Arti"],
        rows: [
          ["Mutasi", "Satu baris transaksi dari rekening bank yang diimpor dari file bank"],
          ["Catatan Finance", "Klasifikasi satu bagian nominal mutasi ke sebuah Sub Biaya"],
          ["Kode Biaya", "Kategori induk (level 1) tempat Sub Biaya bernaung"],
          ["Sub Biaya", "Kategori anak (level 2) yang dipilih saat memetakan transaksi"],
          ["Kode Transfer Produk", "Daftar inisial produk untuk mengklasifikasi uang masuk"],
          ["Kode Toko", "Identitas toko per platform yang muncul dalam keterangan transfer"],
          ["Pemetaan", "Proses mengubah mutasi menjadi catatan finance"],
          ["Plot OPS", "Penyebaran satu nominal operasional ke beberapa bulan"],
          ["DPP", "Dasar Pengenaan Pajak: nominal sebelum PPN"],
          ["PPN Masukan", "PPN yang dibayar atas pembelian/pengeluaran"],
          ["Sumber", "Inisial perusahaan pemilik data (MIJ, KICAU, PARADISE, MR JOZZ, PUSPUS)"],
          ["Team", "Penanggung jawab jalur data: Laporan (bank), Petty Cash, Komcards (iklan)"],
          ["Auto-mapping", "Pencocokan keterangan mutasi ke kategori lewat kata kunci"],
        ],
      },
    ],
  },
  {
    id: "lampiran",
    num: "13",
    title: "Lampiran — Skenario Uji End-to-End",
    blocks: [
      {
        type: "para",
        text: "Urutan uji berikut memvalidasi alur dari awal sampai akhir pada satu perusahaan, dan bisa dipakai sebagai daftar periksa penerimaan.",
      },
      {
        type: "table",
        headers: ["No", "Skenario", "Hasil yang diharapkan"],
        rows: [
          ["T-01", "Buat perusahaan, dua rekening, Kode Biaya + Sub Biaya, kode toko", "Semua muncul di pilihan form pemetaan sesuai arah"],
          ["T-02", "Impor file BCA dengan satu baris PEND", "Baris PEND bertanggal akhir periode; tidak ada baris header masuk"],
          ["T-03", "Impor file yang sama dua kali", "Percobaan kedua menghasilkan 0 baris baru dan jumlah duplikat dilewati"],
          ["T-04", "Impor file tanpa nomor rekening dikenali", "File menunggu; setelah rekening dipilih, baris terbaca"],
          ["T-05", "Petakan mutasi keluar ke dua Sub Biaya (30% dan 70%)", "Dua catatan, progres 100%, status bisa ditandai selesai"],
          ["T-06", "Petakan dengan Plot OPS 3 bulan", "Tiga catatan, nominal total tetap, tanggal naik per bulan"],
          ["T-07", "Tandai PPN pada satu catatan", "Catatan muncul di PPN Masukan dengan DPP = nominal − PPN"],
          ["T-08", "Tambah Petty Cash keluar bertanda Operasional", "Muncul di Laporan Operasional dengan team Petty Cash"],
          ["T-09", "Impor file saldo iklan multi-sheet", "Baris per kartu, platform terdeteksi, saldo per platform terhitung"],
          ["T-10", "Buka Arus Kas setelah pemetaan", "Masuk, keluar, dan net per bulan sesuai catatan; per Kode Biaya terurut"],
          ["T-11", "Buka Saldo Harian satu rekening", "Saldo akhir tiap hari berkesinambungan dari saldo awal"],
          ["T-12", "Centang beberapa catatan lalu Export Excel", "File .xlsx berisi baris terpilih dengan kolom lengkap"],
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Catatan penutup",
        text: "Dokumen ini menggambarkan perilaku aplikasi saat dibuat. Setiap perubahan pada parser, aturan pemetaan, atau rumus laporan sebaiknya disertai pembaruan bagian terkait agar tetap menjadi acuan tunggal tim develop.",
      },
    ],
  },
];
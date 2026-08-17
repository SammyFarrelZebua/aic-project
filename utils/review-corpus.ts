/**
 * Hand-written Indonesian review corpus for the synthetic dataset.
 *
 * Every review is composed from independently-seeded clause banks (opener +
 * detail + optional closer/context) instead of a single fixed string per
 * rating/incident bucket. This keeps text natural and hand-authored while
 * making exact duplicates rare even across thousands of rows, and guarantees
 * every review has non-empty text (opener + detail are never skipped).
 *
 * Vocabulary in every bank EXCEPT the three incident banks deliberately
 * avoids the rule-based classifier keywords (see the incident section
 * below) so background/generic reviews don't get misread as complaints
 * about the controlled incidents — that would drown the real signal the
 * anomaly detector is supposed to find.
 */

export type IncidentType = 'PRODUCT_DEFECT' | 'PACKAGING_DAMAGE' | 'LATE_DELIVERY';

interface ClauseSlot {
  bank: string[];
  salt: string;
  skipProbability?: number;
}

// FNV-1a: chosen over a naive polynomial hash because the latter showed
// strong mod-bias on structured seeds (UUID-like review IDs), clustering
// far more picks onto a handful of bank indices than a uniform draw would.
function pickIndex(seed: string, mod: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % mod;
}

function composeClauses(seedKey: string, slots: ClauseSlot[]): string {
  const clauses: string[] = [];
  for (const slot of slots) {
    if (slot.skipProbability) {
      const roll = pickIndex(`${seedKey}::${slot.salt}::skip`, 1000) / 1000;
      if (roll < slot.skipProbability) continue;
    }
    const idx = pickIndex(`${seedKey}::${slot.salt}`, slot.bank.length);
    const clause = slot.bank[idx];
    if (clause) clauses.push(clause);
  }
  if (clauses.length === 0) return '';
  return `${clauses.join('. ')}.`;
}

// ---------------------------------------------------------------------------
// Rating 5 — enthusiastic
// ---------------------------------------------------------------------------

const POS5_OPENER = [
  'Barang ini benar-benar melebihi ekspektasi saya',
  'Saya sangat puas dengan mutu produk yang diterima',
  'Pesanan datang dalam kondisi sempurna dan rapi',
  'Mutu produk ini juara, tidak ada masalah sedikit pun',
  'Belanja kali ini sangat memuaskan dari awal sampai akhir',
  'Produk sesuai persis dengan foto dan deskripsi di toko',
  'Bahan yang dipakai terasa kokoh dan bermutu tinggi',
  'Bungkus luar rapi, produk tiba dalam kondisi mulus sepenuhnya',
  'Ini salah satu pembelian terbaik saya bulan ini',
  'Toko ini benar-benar bisa diandalkan, barangnya top',
  'Detail produk sangat presisi, sesuai dengan yang dijanjikan',
  'Saya langsung suka begitu paket dibuka',
  'Finishing produknya halus dan terlihat premium',
  'Semua fitur berfungsi normal tanpa masalah apa pun',
  'Penjual sangat komunikatif dan barangnya bermutu',
  'Puas banget, pasti akan order lagi ke toko ini',
  'Warna dan ukuran sesuai persis dengan pilihan saya',
  'Jahitan produk ini rapi dan tidak ada benang yang lepas',
  'Barangnya kokoh, terasa awet untuk pemakaian jangka panjang',
  'Momen belanja online kali ini sangat menyenangkan',
  'Produk tiba lebih cepat dari perkiraan dan mulus tanpa lecet',
  'Saya kaget mutunya sebagus ini untuk harga segini',
  'Semua sesuai pesanan, tidak ada yang terlewat',
  'Barang ini terasa lebih bagus dibanding yang di toko fisik',
  'Sangat rapi dan higienis bungkusnya, terlihat niat',
  'Baru pertama kali belanja di toko ini dan langsung suka'
];

const POS5_DETAIL = [
  'Materialnya terasa premium dan tidak murahan sama sekali',
  'Ukurannya pas dan sesuai dengan tabel yang tertera',
  'Warnanya persis seperti di foto, tidak pudar sama sekali',
  'Fungsinya berjalan mulus tanpa kendala teknis apa pun',
  'Jahitan dan sambungannya rapi, tidak ada yang longgar',
  'Aromanya segar dan bungkusnya tersegel dengan baik',
  'Teksturnya lembut dan nyaman saat dipakai',
  'Komponennya lengkap, tidak ada yang kurang satu pun',
  'Instruksi pemakaian jelas dan mudah diikuti',
  'Beratnya sesuai deskripsi, terasa solid di tangan',
  'Permukaannya halus tanpa goresan sedikit pun',
  'Fiturnya lengkap, bahkan lebih dari yang saya harapkan',
  'Baterainya awet dipakai sesuai klaim di deskripsi produk',
  'Bagian dalam bungkusnya dilapisi bubble wrap yang tebal',
  'Semua aksesori tambahan disertakan dengan rapi',
  'Cetakan atau motifnya tajam dan tidak buram',
  'Ukurannya presisi, tidak kebesaran atau kekecilan',
  'Bahan kainnya adem dan tidak mudah kusut',
  'Rasanya autentik dan sesuai dengan ulasan yang saya baca sebelumnya',
  'Kabelnya panjang dan konektornya pas di perangkat saya',
  'Jahitan pinggirnya rapi dan kuat',
  'Kotak luarnya masih mulus tanpa lecet sedikit pun',
  'Suara yang dihasilkan jernih tanpa noise berlebih',
  'Produk ini terasa ringan tapi tetap kokoh dipegang',
  'Semua ukuran dan takaran sesuai dengan yang dijanjikan',
  'Finishing catnya rata dan tidak ada bagian yang belang'
];

const POS5_CLOSER = [
  'Terima kasih banyak untuk penjual yang jujur dan ramah',
  'Recommended banget buat yang lagi cari barang serupa',
  'Pasti bakal belanja lagi di toko ini ke depannya',
  'Lima bintang penuh untuk momen belanja kali ini',
  'Semoga toko ini terus konsisten menjaga mutu seperti ini',
  'Tidak ragu untuk merekomendasikan ke teman dan keluarga',
  'Sukses terus untuk tokonya, semoga makin laris',
  'Ini bukti kalau harga murah tidak selalu berarti mutu rendah',
  'Penjual fast response dan sangat membantu sepanjang proses transaksi',
  'Prosesnya juga cepat, jadi paket lekas sampai dengan aman',
  'Worth it banget dibanding harga yang saya bayar',
  'Bakal jadi langganan toko ini untuk pembelian berikutnya',
  'Sangat direkomendasikan untuk yang masih ragu',
  'Overall momen belanja sangat positif dari awal sampai akhir',
  'Saya akan kembali lagi untuk produk lain di toko ini',
  'Layak diberi rating tertinggi tanpa keraguan',
  'Semua ekspektasi saya terpenuhi bahkan lebih',
  'Barang ini pantas mendapat ulasan bintang lima',
  'Puas total, tidak ada satu pun yang mengecewakan'
];

const POS5_CONTEXT = [
  'Rencananya barang ini akan saya pakai untuk kebutuhan sehari-hari',
  'Saya beli ini sebagai hadiah dan penerimanya juga sangat suka',
  'Cocok banget dipakai untuk kerja maupun santai',
  'Sudah saya coba beberapa hari dan hasilnya tetap konsisten bagus',
  'Pas banget buat melengkapi koleksi yang sudah saya punya',
  'Anak-anak di rumah juga senang dengan barang ini',
  'Sudah dipakai seminggu dan performanya masih stabil',
  'Cocok dipakai untuk acara khusus maupun harian',
  'Awalnya ragu, tapi ternyata hasilnya di luar dugaan',
  'Sudah saya bandingkan dengan produk serupa dan ini lebih unggul',
  'Pas dipakai untuk perjalanan karena ringkas dan praktis',
  'Keluarga di rumah ikut memuji mutu barang ini',
  'Sesuai banget dengan kebutuhan proyek yang sedang saya kerjakan',
  'Sudah saya tunjukkan ke teman-teman dan mereka juga tertarik beli',
  'Kini jadi barang favorit saya di rumah'
];

// ---------------------------------------------------------------------------
// Rating 4 — positive with a minor nitpick
// ---------------------------------------------------------------------------

const POS4_OPENER = [
  'Produk ini secara keseluruhan cukup memuaskan',
  'Barangnya bagus, hampir sesuai dengan yang saya bayangkan',
  'Mutunya oke, meski ada sedikit hal yang bisa diperbaiki',
  'Saya cukup senang dengan hasil pembelian ini',
  'Barang tiba dengan baik dan fungsinya normal',
  'Cukup puas dengan mutu untuk harga segini',
  'Produk ini layak dibeli, meski bukan tanpa catatan kecil',
  'Sebagian besar sesuai ekspektasi saya',
  'Barangnya oke, prosesnya juga lumayan cepat',
  'Saya senang dengan pembelian ini secara umum',
  'Mutu produk baik, bungkusnya juga cukup aman',
  'Hasilnya memuaskan meski ada detail kecil yang kurang pas',
  'Barang sesuai deskripsi dengan sedikit perbedaan minor',
  'Cukup bagus untuk pemakaian sehari-hari',
  'Produk ini worth it dengan harga yang dibayarkan',
  'Saya puas meski tidak sempurna seratus persen',
  'Mutunya di atas rata-rata untuk kelas harganya',
  'Barangnya cukup solid dan fungsional',
  'Pembelian ini termasuk memuaskan buat saya',
  'Produk sesuai kebutuhan meski ada bagian yang bisa ditingkatkan'
];

const POS4_DETAIL = [
  'Bahan yang dipakai cukup baik meski bukan yang termewah',
  'Ukurannya pas meski bungkusnya sedikit sederhana',
  'Warna sedikit berbeda dari foto tapi masih dalam batas wajar',
  'Fungsinya berjalan baik tanpa kendala berarti',
  'Finishing produk rapi meski ada sedikit bagian kurang halus',
  'Semua komponen lengkap dan berfungsi sebagaimana mestinya',
  'Teksturnya nyaman meski tidak semewah yang saya bayangkan',
  'Bungkusnya aman meski tidak terlalu tebal lapisannya',
  'Instruksi pemakaian cukup jelas untuk diikuti',
  'Beratnya sesuai deskripsi dan terasa cukup solid',
  'Jahitan produk rapi meski ada satu dua benang berlebih',
  'Fiturnya sesuai dengan yang dijanjikan di deskripsi',
  'Baterai cukup awet untuk pemakaian normal',
  'Aksesori tambahan disertakan meski jumlahnya standar',
  'Motif atau cetakan cukup tajam dan jelas terlihat',
  'Ukurannya cukup presisi dengan sedikit toleransi wajar',
  'Bahan kainnya nyaman dipakai meski agak ringan',
  'Rasanya cukup sesuai dengan ulasan yang saya baca',
  'Kabel dan konektor berfungsi normal tanpa masalah',
  'Kotak luarnya sedikit lecet tapi isi di dalamnya aman'
];

const POS4_CLOSER = [
  'Secara keseluruhan saya rekomendasikan untuk yang butuh barang serupa',
  'Semoga ke depannya mutunya bisa lebih ditingkatkan lagi',
  'Tetap puas meski ada ruang untuk perbaikan',
  'Akan pertimbangkan order lagi di toko ini',
  'Value for money yang cukup baik menurut saya',
  'Penjual responsif meski balasan chat kadang perlu waktu lebih',
  'Layak dicoba untuk kebutuhan sehari-hari',
  'Tidak menyesal membeli, meski bukan sempurna',
  'Cukup layak diberi bintang empat',
  'Overall momen belanja tetap menyenangkan',
  'Saya masih akan mempertimbangkan toko ini untuk pembelian berikutnya',
  'Semoga tetap konsisten menjaga mutu ke depannya',
  'Barang ini cukup memenuhi kebutuhan saya',
  'Sejauh ini masih dalam batas wajar dan memuaskan',
  'Recommended dengan sedikit catatan minor',
  'Bisa jadi pilihan yang baik dengan harga segini',
  'Puas dengan sedikit ruang perbaikan ke depannya'
];

const POS4_NITPICK = [
  'Hanya saja warnanya sedikit lebih pucat dibanding foto',
  'Sayangnya bungkus luar sedikit lecet meski isinya tetap aman',
  'Ada sedikit aroma khas bungkus baru yang perlu diangin-anginkan dulu',
  'Ukurannya sedikit lebih besar dari yang saya kira',
  'Petunjuk pemakaian bisa lebih detail lagi menurut saya',
  'Bahan sedikit lebih ringan dari ekspektasi saya',
  'Waktu penyelesaian pesanan sedikit lebih panjang dari perkiraan awal',
  'Ada satu bagian kecil yang perlu dirapikan lagi',
  'Aksesori tambahan bisa lebih lengkap lagi',
  'Sedikit sulit dipasang di awal, tapi akhirnya terbiasa juga',
  'Mutu bungkus bisa diperkuat lagi untuk perjalanan jarak jauh'
];

const POS4_CONTEXT = [
  'Sudah saya pakai beberapa hari dan masih berfungsi baik',
  'Cocok untuk dipakai sehari-hari tanpa masalah berarti',
  'Saya beli ini untuk kebutuhan kerja dan cukup membantu',
  'Dipakai bergantian dengan produk sebelumnya, hasilnya cukup baik',
  'Sudah dicoba untuk beberapa keperluan dan hasilnya stabil',
  'Pas dipakai untuk kebutuhan santai di rumah',
  'Sudah saya bandingkan dengan barang sejenis, ini cukup kompetitif',
  'Anak di rumah juga cukup senang dengan barang ini',
  'Rencana akan dipakai untuk jangka panjang, semoga awet',
  'Sudah saya rekomendasikan ke beberapa teman',
  'Cocok dipakai untuk pemula yang baru belajar',
  'Sesuai dengan kebutuhan dasar saya sehari-hari',
  'Sejauh ini masih aman dipakai rutin'
];

// ---------------------------------------------------------------------------
// Rating 3 — neutral
// ---------------------------------------------------------------------------

const NEU3_OPENER = [
  'Produk ini standar saja, tidak istimewa tapi juga tidak mengecewakan',
  'Barangnya biasa saja, sesuai dengan harga yang dibayar',
  'Cukup lah untuk kebutuhan dasar sehari-hari',
  'Mutunya menengah, tidak terlalu bagus tidak terlalu istimewa',
  'Barang diterima dengan kondisi cukup, tidak ada yang spesial',
  'Momen belanja kali ini biasa saja',
  'Produk sesuai deskripsi meski mutunya pas-pasan',
  'Cukup memenuhi ekspektasi dasar saya',
  'Barangnya oke untuk dipakai sementara',
  'Rata-rata saja, tidak ada yang mengecewakan tapi juga tidak mengesankan',
  'Sesuai harga, mutu juga sewajarnya',
  'Produk ini cukup untuk kebutuhan darurat',
  'Standar pabrik, tidak ada yang luar biasa',
  'Cukup worth it untuk harga segini, meski pas-pasan',
  'Barang sampai dengan aman, mutunya biasa',
  'Tidak ada komplain berarti, tapi juga tidak ada yang mengesankan',
  'Produk oke sebagai pilihan sementara',
  'Mutu menengah ke bawah tapi masih bisa dipakai'
];

const NEU3_DETAIL = [
  'Bahan yang dipakai cukup ringan tapi masih layak pakai',
  'Warnanya agak berbeda dari foto tapi tidak terlalu jauh',
  'Fungsinya berjalan meski kadang butuh sedikit penyesuaian',
  'Finishing produk kurang rapi di beberapa bagian',
  'Bungkusnya standar, tidak ada perlindungan ekstra',
  'Ukurannya sedikit berbeda dari tabel ukuran yang tertera',
  'Instruksi pemakaian kurang lengkap menurut saya',
  'Beratnya terasa lebih ringan dari yang saya kira',
  'Ada sedikit ketidaksempurnaan produksi tapi masih dalam batas wajar',
  'Komponen yang disertakan pas-pasan, tidak ada tambahan',
  'Motif atau cetakan agak buram di beberapa sisi',
  'Jahitan cukup rapi meski ada satu dua benang berlebih',
  'Bahan kainnya agak kasar dibanding ekspektasi saya',
  'Baterai cukup boros untuk pemakaian normal',
  'Kotak luarnya agak lecet saat diterima',
  'Suara yang dihasilkan cukup jelas meski tidak maksimal',
  'Rasanya cukup standar, tidak seistimewa ulasan yang saya baca',
  'Kabel bawaan agak pendek dari yang saya harapkan'
];

const NEU3_CLOSER = [
  'Mungkin akan mempertimbangkan merek lain untuk pembelian berikutnya',
  'Sejauh ini masih bisa ditoleransi untuk kebutuhan dasar',
  'Bukan yang terbaik tapi juga bukan yang paling mengecewakan',
  'Masih dalam batas wajar untuk harga segini',
  'Semoga mutunya bisa ditingkatkan di produk berikutnya',
  'Cukup untuk sementara sampai ada penggantian yang lebih baik',
  'Netral saja, tidak terlalu merekomendasikan tapi juga tidak melarang',
  'Masih bisa dipertimbangkan dengan catatan tertentu',
  'Rata-rata dibanding produk sejenis yang pernah saya beli',
  'Tidak ada yang benar-benar mengecewakan dari pembelian ini',
  'Cukup sebagai bahan coba-coba',
  'Standar pasar untuk kategori produk ini',
  'Bisa dipakai sementara sambil menabung untuk yang lebih baik',
  'Sejauh ini belum ada masalah besar yang muncul',
  'Lumayan lah, sesuai dengan apa yang dibayar'
];

const NEU3_CONTEXT = [
  'Dipakai untuk kebutuhan darurat sehari-hari saja',
  'Sudah dicoba beberapa kali dan hasilnya tetap sama saja',
  'Saya beli ini karena sedang diskon, jadi wajar mutunya begini',
  'Rencana awal cuma untuk pemakaian sementara',
  'Sempat dibandingkan dengan produk lain yang harganya mirip',
  'Belum tahu apakah akan tahan sampai pemakaian rutin',
  'Dipakai sesekali saja, belum terlalu sering',
  'Sudah ditunjukkan ke teman dan tanggapannya juga biasa saja',
  'Masih dalam masa percobaan pemakaian di rumah',
  'Sejauh ini belum dipakai untuk kebutuhan yang berat',
  'Dibeli sebagai cadangan, bukan untuk pemakaian utama',
  'Baru dipakai beberapa hari jadi belum terlalu yakin dengan daya tahannya'
];

// ---------------------------------------------------------------------------
// Rating 1-2 — generic negative (not tied to a controlled incident)
// ---------------------------------------------------------------------------

const NEG_OPENER = [
  'Saya cukup kecewa dengan pembelian kali ini',
  'Momen belanja kali ini kurang menyenangkan',
  'Produk yang diterima jauh dari ekspektasi saya',
  'Sayangnya barang ini tidak seperti yang dijanjikan',
  'Saya menyesal membeli produk ini',
  'Mutu produk ini di bawah standar yang saya harapkan',
  'Belanja kali ini meninggalkan kesan kurang baik',
  'Saya tidak puas dengan hasil pesanan ini',
  'Barang yang datang tidak seperti deskripsi toko',
  'Ekspektasi saya benar-benar tidak terpenuhi kali ini',
  'Kejadian ini membuat saya ragu belanja lagi di toko ini',
  'Sangat disayangkan hasil pembelian kali ini mengecewakan',
  'Produk ini gagal memenuhi standar minimal yang saya harapkan',
  'Saya kurang senang dengan kondisi barang yang diterima',
  'Ini momen belanja paling mengecewakan bulan ini',
  'Sayang sekali, padahal saya sudah menanti barang ini',
  'Produk yang saya terima terasa mengecewakan',
  'Saya berharap lebih dari yang saya dapatkan kali ini',
  'Kondisi barang saat diterima kurang memuaskan',
  'Pesanan kali ini benar-benar di luar dugaan, dan bukan yang baik',
  'Saya harus menulis ulasan jujur karena kesan saya kurang baik',
  'Kekecewaan saya cukup besar terhadap pembelian ini'
];

const NEG_DETAIL = [
  'Barangnya terasa murahan padahal harganya tidak murah',
  'Ada bagian yang tidak berfungsi sebagaimana mestinya',
  'Mutu jauh di bawah yang ditampilkan di foto produk',
  'Detail produk berbeda dari deskripsi yang tertulis',
  'Ukurannya berbeda dari tabel yang tercantum',
  'Warna yang diterima berbeda jauh dari yang dipesan',
  'Beberapa komponen penting tidak disertakan dalam paket',
  'Jahitan sangat kurang rapi dan mudah terlepas',
  'Bahan yang dipakai terasa sangat ringan dan rapuh',
  'Fungsi utama produk tidak bekerja dengan baik',
  'Ada ketidaksempurnaan produksi yang cukup mengganggu',
  'Instruksi pemakaian membingungkan dan tidak jelas',
  'Baterai cepat habis meski baru dipakai sebentar',
  'Motif atau cetakan pada produk terlihat kabur',
  'Suara yang dihasilkan sember dan tidak jernih',
  'Rasanya sangat jauh dari ulasan yang saya baca sebelumnya',
  'Kabel bawaan cepat bermasalah saat pertama kali dipakai',
  'Produk terasa berat sebelah dan tidak seimbang',
  'Bagian penting terasa longgar dan mudah lepas',
  'Cetakan label pada bungkus sudah pudar',
  'Bau tidak sedap tercium begitu bungkus dibuka',
  'Barang terlihat seperti bekas pakai, bukan baru'
];

const NEG_CLOSER = [
  'Saya tidak akan membeli lagi dari toko ini',
  'Semoga penjual bisa lebih memperhatikan kontrol mutu',
  'Saya harap ada perbaikan untuk pembeli berikutnya',
  'Tidak merekomendasikan produk ini kepada siapa pun',
  'Sangat menyesal sudah menghabiskan uang untuk ini',
  'Berharap ada kompensasi atas ketidaksesuaian ini',
  'Semoga toko ini lebih transparan soal kondisi barang',
  'Saya akan mempertimbangkan mengembalikan barang ini',
  'Ini menjadi pelajaran untuk lebih teliti sebelum membeli',
  'Butuh perbaikan besar sebelum saya mau order lagi',
  'Sayang sekali momen ini mengecewakan',
  'Saya berharap penjual bertanggung jawab atas hal ini',
  'Bintang rendah pantas diberikan untuk momen ini',
  'Tidak sebanding dengan uang yang saya keluarkan',
  'Semoga ulasan ini membantu pembeli lain berhati-hati',
  'Kecewa berat dan berharap ada penanganan lebih baik',
  'Ini kejadian yang membuat saya berpikir dua kali untuk order lagi'
];

const NEG_CONTEXT = [
  'Rencananya barang ini mau saya pakai untuk acara penting, jadi cukup merepotkan',
  'Saya beli ini sebagai hadiah dan jadi malu memberikannya',
  'Sudah saya coba beberapa cara tapi masalahnya tetap ada',
  'Ini pembelian kedua saya dan ternyata masalahnya berulang',
  'Padahal sudah baca banyak ulasan positif sebelumnya',
  'Butuh barang ini segera tapi kondisinya malah begini',
  'Sudah saya bandingkan dengan produk serupa dan ini kalah jauh',
  'Keluarga di rumah juga kecewa saat melihat kondisinya',
  'Saya sampai harus mencari alternatif lain karena ini tidak bisa dipakai',
  'Sudah dicoba dengan hati-hati tapi hasilnya tetap mengecewakan',
  'Ini momen belanja online yang jarang saya alami',
  'Sempat ragu untuk komplain tapi rasanya perlu disampaikan',
  'Semoga kejadian ini tidak terulang untuk pembeli lain'
];

// ---------------------------------------------------------------------------
// Controlled incidents — the ONLY banks allowed to contain the rule-based
// classifier keywords from app/api/pipeline/run/route.ts and
// scripts/nlp-*-eval.ts:
//   PRODUCT_DEFECT:   /cacat|rusak|buruk|tidak sesuai|tipis|pecah|patah|jelek|kualitas/i
//   PACKAGING_DAMAGE: /kemasan|kardus|packing|peot|penyok|sobek|bocor|basah/i
//   LATE_DELIVERY:    /telat|lama|lambat|kurir|pengiriman|tunggu|meleset/i
// ---------------------------------------------------------------------------

const PRODUCT_DEFECT_TEMPLATE = [
  'Barang cacat produksi, bagian sambungannya patah begitu dikeluarkan dari kemasan',
  'Kualitas produk ini sangat buruk, terasa seperti barang reject dari pabrik',
  'Produk yang saya terima rusak parah, tidak sesuai dengan standar kualitas yang dijanjikan',
  'Bahannya tipis sekali dan langsung pecah saat pertama kali dipakai',
  'Ada cacat jelas di permukaan produk, sepertinya lolos dari kontrol kualitas pabrik',
  'Kualitas jahitan sangat jelek, benang lepas begitu saja tanpa sebab',
  'Barang tidak sesuai dengan deskripsi, terasa seperti produk gagal produksi',
  'Komponen utama produk ini patah saat pertama kali digunakan, kualitasnya buruk',
  'Produk cacat total, warnanya belang dan teksturnya kasar tidak merata',
  'Kualitas bahan sangat tipis dan mudah sobek, jelas cacat dari pabrik',
  'Barang pecah di bagian sudut, kelihatan sekali ini cacat produksi',
  'Fungsi utama produk ini rusak sejak awal, kualitas kontrolnya buruk',
  'Produk yang saya terima jelek sekali, terasa seperti bahan sisa pabrik',
  'Ada retak dan patah pada bagian penting produk, kualitasnya sangat buruk',
  'Kualitas cetakan pada produk ini cacat, motifnya tidak sesuai sama sekali',
  'Barang ini tidak sesuai standar, banyak bagian yang terlihat rusak sejak dari kemasan',
  'Kualitas finishing sangat buruk, ada bagian yang patah dan tidak rapi',
  'Produk cacat sejak dari pabrik, kualitasnya jauh dari yang saya harapkan'
];

const PRODUCT_DEFECT_SPECIFIC = [
  'Saya sudah cek video unboxing dan memang kondisinya seperti ini sejak dibuka',
  'Sepertinya ada masalah di lini produksi karena banyak bagian yang tidak presisi',
  'Ini kali kedua saya dapat barang cacat dari batch produksi yang sama',
  'Sudah saya bandingkan dengan unit sebelumnya dan memang ada perbedaan kualitas',
  'Kondisi ini jelas bukan karena pengiriman, karena kemasan luar masih utuh',
  'Saya menduga ada masalah kontrol kualitas di tahap produksi barang ini',
  'Cacatnya terlihat jelas bahkan tanpa perlu diperiksa detail',
  'Sepertinya ini bukan kejadian pertama karena beberapa pembeli lain mengeluhkan hal serupa',
  'Bagian yang cacat ini seharusnya sudah terdeteksi sebelum dikirim ke pelanggan',
  'Saya berharap pabrik lebih ketat dalam pemeriksaan sebelum produk dikirim',
  'Kerusakan ini terjadi bukan karena pemakaian, melainkan sejak barang diterima',
  'Saya sampai memeriksa ulang apakah ini memang barang baru atau bekas retur',
  'Kondisi cacat ini membuat produk sama sekali tidak bisa dipakai',
  'Saya berharap ada penggantian karena ini jelas kesalahan produksi'
];

const PACKAGING_DAMAGE_TEMPLATE = [
  'Kemasan luar penyok parah, kardus terlihat seperti terlindas sesuatu di gudang',
  'Kardus datang sobek besar di bagian samping, packing sama sekali tidak aman',
  'Kemasan bocor dan sebagian isinya basah saat paket diterima',
  'Packing gudang sangat buruk, kardus peot dan tidak ada pelindung tambahan',
  'Kemasan sobek di beberapa sisi, sepertinya ditumpuk sembarangan di gudang',
  'Kardus penyok parah hingga bentuk produk di dalamnya ikut berubah',
  'Kemasan basah kena air, sepertinya disimpan di area gudang yang bocor',
  'Packing sangat tipis, kardus langsung penyok begitu dipegang',
  'Kemasan datang dalam kondisi sobek dan terbuka sebagian di gudang pengiriman',
  'Kardus terlihat basah dan lembab, packing gudang jelas tidak diperhatikan',
  'Kemasan penyok di semua sisi, packing gudang sepertinya asal-asalan',
  'Kardus bocor di bagian bawah, isinya sampai terkena noda basah',
  'Packing luar sobek total, terlihat sekali kurang penanganan di gudang',
  'Kemasan peot dan lembek, sepertinya sempat kena air di gudang penyimpanan',
  'Kardus penyok besar di bagian tengah, packing tidak diberi pelindung sama sekali',
  'Kemasan sobek sejak diterima kurir, packing gudang benar-benar mengecewakan',
  'Packing basah dan berbau apek, sepertinya lama tersimpan di gudang lembab',
  'Kardus penyok dan kemasan sobek membuat produk di dalamnya ikut rusak'
];

const PACKAGING_DAMAGE_SPECIFIC = [
  'Saya sampai foto kondisi kardus begitu diterima karena parah sekali',
  'Sepertinya ada masalah penyimpanan di gudang sebelum paket dikirim',
  'Kurir bilang kondisi paket memang sudah begini sejak diambil dari gudang',
  'Ini bukan kejadian pertama, bulan lalu juga sempat dapat kemasan rusak serupa',
  'Untung isi di dalamnya masih bisa dipakai meski kemasannya hancur',
  'Saya menduga gudang penyimpanan kurang memperhatikan penataan barang',
  'Kondisi ini jelas terjadi sebelum pengiriman, bukan saat di jalan',
  'Saya berharap ada perbaikan standar packing dari pihak gudang',
  'Sepertinya barang ditumpuk dengan barang berat lain saat di gudang',
  'Saya sampai ragu untuk membuka paket karena kondisinya mengkhawatirkan',
  'Ini kelihatan sekali seperti kelalaian penanganan gudang, bukan human error kurir',
  'Kerusakan kemasan ini membuat saya khawatir kondisi barang di dalamnya',
  'Saya berharap gudang lebih memperhatikan proses pengepakan sebelum dikirim',
  'Kondisi kemasan ini jauh dari standar yang seharusnya diberikan ke pelanggan'
];

const LATE_DELIVERY_TEMPLATE = [
  'Pengiriman sangat telat, sudah dua minggu lebih dari estimasi awal',
  'Kurir lama sekali mengantarkan paket ini, jauh dari estimasi yang dijanjikan',
  'Saya menunggu terlalu lama untuk paket ini, jadwal pengiriman meleset jauh',
  'Pengiriman kali ini sangat lambat, tidak sesuai dengan estimasi di aplikasi',
  'Kurir terlihat menahan paket lama di gudang sortir sebelum diantar',
  'Saya sudah menunggu lama, hampir sebulan, dan paket belum juga sampai',
  'Estimasi pengiriman meleset jauh, saya terlalu lama menunggu tanpa kabar',
  'Kurir sangat lambat, status pengiriman juga jarang diperbarui',
  'Pengiriman kali ini telat parah, padahal sudah bayar ongkir ekspres',
  'Saya menunggu berhari-hari tanpa ada update jelas dari kurir',
  'Paket tertahan lama di kota transit sebelum akhirnya dikirim lagi',
  'Pengiriman lambat sekali, estimasi tiga hari jadi molor lebih dari seminggu',
  'Kurir terlalu lama mengantarkan, padahal jaraknya tidak terlalu jauh',
  'Saya sudah menunggu lama dan hampir membatalkan pesanan karena telat',
  'Pengiriman kali ini benar-benar meleset dari jadwal yang dijanjikan',
  'Kurir lambat merespons dan paket baru sampai jauh dari estimasi',
  'Saya menunggu tanpa kepastian karena status pengiriman tidak berubah lama',
  'Pengiriman telat total, saya sampai harus menghubungi kurir berkali-kali'
];

const LATE_DELIVERY_SPECIFIC = [
  'Saya sudah cek nomor resi berkali-kali tapi statusnya diam saja lama sekali',
  'Sepertinya ada masalah di titik distribusi sebelum paket sampai ke saya',
  'Kurir bilang armadanya sedang penuh sehingga banyak paket tertunda',
  'Ini bukan kejadian pertama, pengiriman sebelumnya juga sempat telat',
  'Saya sampai menghubungi customer service karena khawatir paket hilang',
  'Sepertinya jalur pengiriman kali ini mengalami penumpukan yang cukup parah',
  'Saya berharap kurir lebih transparan soal alasan keterlambatan ini',
  'Kondisi ini membuat saya ragu memakai jasa kurir yang sama lagi',
  'Untung paket akhirnya sampai meski jauh dari estimasi awal',
  'Saya sampai harus menunda rencana karena barang belum juga tiba',
  'Sepertinya ada gangguan operasional di gudang sortir kurir ini',
  'Saya berharap ada perbaikan sistem tracking supaya lebih akurat',
  'Keterlambatan ini cukup mengganggu karena barangnya dibutuhkan segera',
  'Saya harap ke depannya estimasi pengiriman lebih realistis dan akurat'
];

/**
 * Deterministically composes review text for a given rating / seed.
 * Opener + detail are always included, so the result is never empty.
 */
export function generateReviewText(rating: number, seedKey: string, incidentType?: IncidentType): string {
  if (incidentType === 'PRODUCT_DEFECT') {
    return composeClauses(seedKey, [
      { bank: PRODUCT_DEFECT_TEMPLATE, salt: 'pd-t' },
      { bank: PRODUCT_DEFECT_SPECIFIC, salt: 'pd-s' }
    ]);
  }
  if (incidentType === 'PACKAGING_DAMAGE') {
    return composeClauses(seedKey, [
      { bank: PACKAGING_DAMAGE_TEMPLATE, salt: 'pk-t' },
      { bank: PACKAGING_DAMAGE_SPECIFIC, salt: 'pk-s' }
    ]);
  }
  if (incidentType === 'LATE_DELIVERY') {
    return composeClauses(seedKey, [
      { bank: LATE_DELIVERY_TEMPLATE, salt: 'ld-t' },
      { bank: LATE_DELIVERY_SPECIFIC, salt: 'ld-s' }
    ]);
  }

  if (rating >= 5) {
    return composeClauses(seedKey, [
      { bank: POS5_OPENER, salt: 'p5-o' },
      { bank: POS5_DETAIL, salt: 'p5-d' },
      { bank: POS5_CLOSER, salt: 'p5-c', skipProbability: 0.12 },
      { bank: POS5_CONTEXT, salt: 'p5-x', skipProbability: 0.18 }
    ]);
  }
  if (rating === 4) {
    return composeClauses(seedKey, [
      { bank: POS4_OPENER, salt: 'p4-o' },
      { bank: POS4_DETAIL, salt: 'p4-d' },
      { bank: POS4_CLOSER, salt: 'p4-c', skipProbability: 0.15 },
      { bank: POS4_NITPICK, salt: 'p4-n', skipProbability: 0.45 },
      { bank: POS4_CONTEXT, salt: 'p4-x', skipProbability: 0.2 }
    ]);
  }
  if (rating === 3) {
    return composeClauses(seedKey, [
      { bank: NEU3_OPENER, salt: 'n3-o' },
      { bank: NEU3_DETAIL, salt: 'n3-d' },
      { bank: NEU3_CLOSER, salt: 'n3-c', skipProbability: 0.12 },
      { bank: NEU3_CONTEXT, salt: 'n3-x', skipProbability: 0.35 }
    ]);
  }
  return composeClauses(seedKey, [
    { bank: NEG_OPENER, salt: 'ng-o' },
    { bank: NEG_DETAIL, salt: 'ng-d' },
    { bank: NEG_CLOSER, salt: 'ng-c', skipProbability: 0.15 },
    { bank: NEG_CONTEXT, salt: 'ng-x', skipProbability: 0.2 }
  ]);
}

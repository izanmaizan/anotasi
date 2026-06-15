# anotasi

MVP alat anotasi gambar (mirip Roboflow) yang berjalan sepenuhnya di browser.
Metadata anotasi disimpan di `localStorage`; **blob gambar disimpan di
IndexedDB** agar tidak menabrak batas kuota localStorage saat memakai foto asli.

## Menjalankan

```bash
npm install      # sudah dijalankan saat scaffold
npm run dev      # http://localhost:3000
```

## Fitur

- **Upload gambar** (banyak sekaligus) — galeri di panel kiri, persisten.
- **Tipe anotasi**:
  - Bounding box (`B`) — drag untuk menggambar.
  - Poligon / segmentasi (`P`) — klik tiap titik, klik titik awal atau `Enter` untuk menutup.
  - Keypoint / landmark (`K`) — klik untuk menempatkan titik.
  - Klasifikasi gambar — tag multi-label per gambar (panel kanan).
- **Tool Pilih** (`V`) — pilih, geser, ubah ukuran (handle sudut bbox), tarik
  vertex poligon, `Del`/`Backspace` untuk hapus.
- **Zoom & pan** — scroll untuk zoom ke arah kursor, `Space`+drag (atau klik
  tengah) untuk geser, tombol Fit untuk reset.
- **Undo / Redo** — `Ctrl/Cmd+Z` dan `Ctrl/Cmd+Shift+Z`.
- **Navigasi gambar** — tombol ‹ › atau `,` / `.` (atau panah kiri/kanan),
  dengan indikator progres.
- **Manajemen kelas** — tambah/ubah nama & warna; tekan `1`–`9` untuk memilih
  kelas aktif dengan cepat.
- **Export** — COCO JSON dan YOLO TXT (dinormalisasi), dengan pratinjau.

## Pintasan keyboard

| Tombol | Fungsi |
| --- | --- |
| `V` `B` `P` `K` | Pilih / Box / Poligon / Keypoint |
| `1`–`9` | Pilih kelas aktif |
| `Space`+drag | Geser kanvas |
| Scroll | Zoom |
| `Ctrl/Cmd+Z` / `+Shift` | Undo / Redo |
| `,` `.` atau ← → | Gambar sebelumnya / berikutnya |
| `Del` / `Backspace` | Hapus anotasi terpilih |
| `Esc` | Batalkan gambar / pilihan |

## Struktur

```
src/
  app/page.tsx              layout utama + shortcut keyboard
  lib/types.ts              model data (koordinat dinormalisasi 0..1)
  lib/store.ts              zustand store + persist localStorage
  lib/export.ts             konversi COCO / YOLO
  components/
    Toolbar.tsx             pemilih tool
    ImageSidebar.tsx        upload & galeri gambar
    AnnotationCanvas.tsx    canvas SVG interaktif (inti)
    ClassPanel.tsx          manajemen kelas
    ClassificationPanel.tsx tag klasifikasi gambar
    AnnotationList.tsx      daftar anotasi
    RightSidebar.tsx        gabungan panel kanan
    ExportDialog.tsx        dialog export + pratinjau
```

## Catatan

Ini prototipe UI. Untuk jadi seperti Roboflow penuh, langkah berikutnya:
backend + database, autentikasi & multi-project, versioning dataset,
augmentasi, dan integrasi training model.

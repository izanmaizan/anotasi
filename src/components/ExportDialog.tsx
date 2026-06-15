"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { download, toCOCO, toYOLO } from "@/lib/export";

type Format = "coco" | "yolo";

export default function ExportDialog({ onClose }: { onClose: () => void }) {
  const images = useStore((s) => s.images);
  const classes = useStore((s) => s.classes);
  const [format, setFormat] = useState<Format>("coco");

  const preview = useMemo(() => {
    if (format === "coco") {
      return JSON.stringify(toCOCO(images, classes), null, 2);
    }
    const { files, classesTxt } = toYOLO(images, classes);
    return (
      `# classes.txt\n${classesTxt}\n\n` +
      files
        .map((f) => `# ${f.name}\n${f.content || "(kosong)"}`)
        .join("\n\n")
    );
  }, [format, images, classes]);

  const handleDownload = () => {
    if (format === "coco") {
      download("annotations_coco.json", preview);
    } else {
      // bundle YOLO into a single readable .txt for the prototype
      download("annotations_yolo.txt", preview);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h2 className="text-base font-semibold text-white">Export Dataset</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="flex gap-2 p-4">
          {(["coco", "yolo"] as Format[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormat(fmt)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                format === fmt
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {fmt === "coco" ? "COCO JSON" : "YOLO TXT"}
            </button>
          ))}
        </div>

        <pre className="mx-4 flex-1 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-300">
          {preview}
        </pre>

        <div className="flex items-center justify-between p-4">
          <span className="text-xs text-zinc-500">
            {images.length} gambar · {classes.length} kelas
          </span>
          <button
            onClick={handleDownload}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            ⬇ Download
          </button>
        </div>
      </div>
    </div>
  );
}

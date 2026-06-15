"use client";

import { useRef } from "react";
import { useStore, uid } from "@/lib/store";
import type { ImageItem } from "@/lib/types";

function loadImage(file: File): Promise<Omit<ImageItem, "annotations" | "tags">> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () =>
        resolve({
          id: uid(),
          name: file.name,
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageSidebar() {
  const images = useStore((s) => s.images);
  const activeImageId = useStore((s) => s.activeImageId);
  const addImages = useStore((s) => s.addImages);
  const removeImage = useStore((s) => s.removeImage);
  const setActiveImage = useStore((s) => s.setActiveImage);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const items = await Promise.all(
      Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .map(loadImage),
    );
    if (items.length) addImages(items);
  };

  return (
    <div className="flex w-56 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Gambar ({images.length})
        </span>
      </div>

      <button
        onClick={() => inputRef.current?.click()}
        className="m-3 rounded-lg border border-dashed border-zinc-700 px-3 py-4 text-sm text-zinc-400 transition-colors hover:border-indigo-500 hover:text-indigo-400"
      >
        + Upload gambar
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {images.map((img) => (
          <div
            key={img.id}
            onClick={() => setActiveImage(img.id)}
            className={`group relative mb-2 cursor-pointer overflow-hidden rounded-lg border ${
              img.id === activeImageId
                ? "border-indigo-500 ring-1 ring-indigo-500"
                : "border-zinc-800 hover:border-zinc-600"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.dataUrl}
              alt={img.name}
              className="h-24 w-full object-cover"
            />
            <div className="flex items-center justify-between bg-zinc-900 px-2 py-1">
              <span className="truncate text-[11px] text-zinc-300">
                {img.name}
              </span>
              <span className="ml-1 shrink-0 rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-400">
                {img.annotations.length + img.tags.length}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeImage(img.id);
              }}
              className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-black/60 text-xs text-white group-hover:flex hover:bg-red-600"
              title="Hapus gambar"
            >
              ×
            </button>
          </div>
        ))}
        {images.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-zinc-600">
            Belum ada gambar.
          </p>
        )}
      </div>
    </div>
  );
}

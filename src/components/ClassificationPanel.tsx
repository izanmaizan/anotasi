"use client";

import { useStore } from "@/lib/store";

export default function ClassificationPanel() {
  const image = useStore((s) => s.activeImage());
  const classes = useStore((s) => s.classes);
  const toggleTag = useStore((s) => s.toggleTag);

  if (!image) return null;

  return (
    <div className="border-b border-zinc-800 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Klasifikasi gambar
      </h3>
      <p className="mb-2 text-[11px] text-zinc-500">
        Label untuk keseluruhan gambar (multi-label).
      </p>
      <div className="flex flex-wrap gap-1.5">
        {classes.map((c) => {
          const on = image.tags.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggleTag(c.id)}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
              style={{
                borderColor: c.color,
                backgroundColor: on ? c.color : "transparent",
                color: on ? "#fff" : c.color,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: on ? "#fff" : c.color }}
              />
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

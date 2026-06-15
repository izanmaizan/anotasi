"use client";

import { useStore } from "@/lib/store";
import type { Annotation } from "@/lib/types";

const TYPE_LABEL: Record<Annotation["type"], string> = {
  bbox: "Box",
  polygon: "Poligon",
  keypoint: "Keypoint",
};

export default function AnnotationList() {
  const image = useStore((s) => s.activeImage());
  const classes = useStore((s) => s.classes);
  const selectedId = useStore((s) => s.selectedAnnotationId);
  const selectAnnotation = useStore((s) => s.selectAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);

  const colorOf = (id: string) =>
    classes.find((c) => c.id === id)?.color ?? "#888";
  const nameOf = (id: string) =>
    classes.find((c) => c.id === id)?.name ?? "?";

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Anotasi ({image?.annotations.length ?? 0})
      </h3>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {image?.annotations.map((a) => (
          <div
            key={a.id}
            onClick={() => selectAnnotation(a.id)}
            className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
              a.id === selectedId
                ? "bg-zinc-800 text-white"
                : "text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: colorOf(a.classId) }}
            />
            <span className="flex-1 truncate">{nameOf(a.classId)}</span>
            <span className="rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-400">
              {TYPE_LABEL[a.type]}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeAnnotation(a.id);
              }}
              className="hidden text-zinc-500 hover:text-red-400 group-hover:block"
              title="Hapus"
            >
              ×
            </button>
          </div>
        ))}
        {(!image || image.annotations.length === 0) && (
          <p className="py-4 text-center text-xs text-zinc-600">
            Belum ada anotasi.
          </p>
        )}
      </div>
    </div>
  );
}

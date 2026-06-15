"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#64748b",
];

export default function ClassPanel() {
  const classes = useStore((s) => s.classes);
  const activeClassId = useStore((s) => s.activeClassId);
  const setActiveClass = useStore((s) => s.setActiveClass);
  const addClass = useStore((s) => s.addClass);
  const updateClass = useStore((s) => s.updateClass);
  const removeClass = useStore((s) => s.removeClass);
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addClass(trimmed, PALETTE[classes.length % PALETTE.length]);
    setName("");
  };

  return (
    <div className="border-b border-zinc-800 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Kelas / Label
      </h3>

      <div className="space-y-1">
        {classes.map((c) => (
          <div
            key={c.id}
            onClick={() => setActiveClass(c.id)}
            className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
              c.id === activeClassId
                ? "bg-zinc-800 text-white"
                : "text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            <label
              className="relative h-4 w-4 shrink-0 rounded-full ring-1 ring-white/20"
              style={{ backgroundColor: c.color }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="color"
                value={c.color}
                onChange={(e) => updateClass(c.id, { color: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                title="Ubah warna"
              />
            </label>
            <input
              value={c.name}
              onChange={(e) => updateClass(c.id, { name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 bg-transparent outline-none focus:text-white"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeClass(c.id);
              }}
              className="hidden text-zinc-500 hover:text-red-400 group-hover:block"
              title="Hapus kelas"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Nama kelas baru…"
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-indigo-500"
        />
        <button
          onClick={submit}
          className="rounded-md bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-500"
        >
          +
        </button>
      </div>
    </div>
  );
}

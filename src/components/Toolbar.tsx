"use client";

import { useStore } from "@/lib/store";
import type { Tool } from "@/lib/types";

const TOOLS: { id: Tool; label: string; icon: string; key: string }[] = [
  { id: "select", label: "Pilih / Geser", icon: "↖", key: "V" },
  { id: "bbox", label: "Bounding Box", icon: "▭", key: "B" },
  { id: "polygon", label: "Poligon", icon: "⬡", key: "P" },
  { id: "keypoint", label: "Keypoint", icon: "•", key: "K" },
];

export default function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);

  return (
    <div className="flex flex-col gap-1 border-r border-zinc-800 bg-zinc-900 p-2">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          title={`${t.label} (${t.key})`}
          className={`flex h-11 w-11 flex-col items-center justify-center rounded-lg text-lg transition-colors ${
            tool === t.id
              ? "bg-indigo-600 text-white"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
          }`}
        >
          <span>{t.icon}</span>
          <span className="text-[9px] font-medium">{t.key}</span>
        </button>
      ))}
    </div>
  );
}

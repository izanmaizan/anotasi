"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { loadAllImageData } from "@/lib/idb";
import Toolbar from "@/components/Toolbar";
import ImageSidebar from "@/components/ImageSidebar";
import AnnotationCanvas from "@/components/AnnotationCanvas";
import RightSidebar from "@/components/RightSidebar";
import ExportDialog from "@/components/ExportDialog";
import type { Tool } from "@/lib/types";

const KEY_TO_TOOL: Record<string, Tool> = {
  v: "select",
  b: "bbox",
  p: "polygon",
  k: "keypoint",
};

export default function Home() {
  const setTool = useStore((s) => s.setTool);
  const stepImage = useStore((s) => s.stepImage);
  const setActiveClassByIndex = useStore((s) => s.setActiveClassByIndex);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const hydrateImageData = useStore((s) => s.hydrateImageData);
  const image = useStore((s) => s.activeImage());
  const images = useStore((s) => s.images);
  const [showExport, setShowExport] = useState(false);
  const [mounted, setMounted] = useState(false);

  // load image blobs from IndexedDB after the persisted metadata rehydrates
  useEffect(() => {
    setMounted(true);
    loadAllImageData().then((map) => hydrateImageData(map));
  }, [hydrateImageData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod) return;

      const tool = KEY_TO_TOOL[e.key.toLowerCase()];
      if (tool) {
        setTool(tool);
        return;
      }
      if (e.key >= "1" && e.key <= "9") {
        setActiveClassByIndex(Number(e.key) - 1);
        return;
      }
      if (e.key === "," || e.key === "ArrowLeft") stepImage(-1);
      if (e.key === "." || e.key === "ArrowRight") stepImage(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTool, stepImage, setActiveClassByIndex, undo, redo]);

  if (!mounted) {
    return <div className="h-screen w-screen bg-zinc-950" />;
  }

  const index = images.findIndex((i) => i.id === image?.id);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-indigo-400">●</span> anotasi
          </span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
            MVP
          </span>
          {image && (
            <span className="ml-2 max-w-[240px] truncate text-sm text-zinc-400">
              {image.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {images.length > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <button
                onClick={() => stepImage(-1)}
                className="rounded-md bg-zinc-800 px-2 py-1 text-zinc-300 hover:bg-zinc-700"
                title="Gambar sebelumnya (,)"
              >
                ‹
              </button>
              <span className="min-w-[56px] text-center text-xs text-zinc-400">
                {index + 1} / {images.length}
              </span>
              <button
                onClick={() => stepImage(1)}
                className="rounded-md bg-zinc-800 px-2 py-1 text-zinc-300 hover:bg-zinc-700"
                title="Gambar berikutnya (.)"
              >
                ›
              </button>
            </div>
          )}
          <button
            onClick={() => setShowExport(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Export ⬇
          </button>
        </div>
      </header>

      {/* body */}
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        <ImageSidebar />
        <div className="min-w-0 flex-1">
          <AnnotationCanvas />
        </div>
        <RightSidebar />
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </div>
  );
}

"use client";

import ClassPanel from "./ClassPanel";
import ClassificationPanel from "./ClassificationPanel";
import AnnotationList from "./AnnotationList";

export default function RightSidebar() {
  return (
    <div className="flex w-72 flex-col border-l border-zinc-800 bg-zinc-950">
      <ClassPanel />
      <ClassificationPanel />
      <AnnotationList />
    </div>
  );
}

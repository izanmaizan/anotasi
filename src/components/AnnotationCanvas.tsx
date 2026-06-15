"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useStore, uid } from "@/lib/store";
import type {
  Annotation,
  BBoxAnnotation,
  PolygonAnnotation,
  Point,
} from "@/lib/types";

type Corner = "nw" | "ne" | "se" | "sw";

type Drag =
  | { kind: "move"; id: string; startN: Point; orig: Annotation }
  | { kind: "resize"; id: string; corner: Corner; orig: BBoxAnnotation }
  | { kind: "vertex"; id: string; index: number };

interface View {
  scale: number;
  tx: number;
  ty: number;
}

const HANDLE = 8; // px (screen, kept constant via counter-scale)
const POLY_CLOSE_DIST = 12; // px screen
const MIN_SCALE = 0.1;
const MAX_SCALE = 20;

export default function AnnotationCanvas() {
  const image = useStore((s) => s.activeImage());
  const tool = useStore((s) => s.tool);
  const classes = useStore((s) => s.classes);
  const activeClassId = useStore((s) => s.activeClassId);
  const selectedId = useStore((s) => s.selectedAnnotationId);
  const addAnnotation = useStore((s) => s.addAnnotation);
  const updateAnnotation = useStore((s) => s.updateAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const selectAnnotation = useStore((s) => s.selectAnnotation);
  const beginEdit = useStore((s) => s.beginEdit);

  const colorOf = useCallback(
    (classId: string) => classes.find((c) => c.id === classId)?.color ?? "#888",
    [classes],
  );
  const nameOf = useCallback(
    (classId: string) => classes.find((c) => c.id === classId)?.name ?? "?",
    [classes],
  );

  // ---- container & fit box ----
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let fitW = 0;
  let fitH = 0;
  if (image && box.w && box.h) {
    const aspect = image.width / image.height;
    const pad = 0.92;
    fitW = Math.min(box.w * pad, box.h * pad * aspect);
    fitH = fitW / aspect;
  }

  // ---- view transform (zoom/pan) ----
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });

  const fitView = useCallback(() => {
    if (!fitW || !box.w) return;
    setView({
      scale: 1,
      tx: (box.w - fitW) / 2,
      ty: (box.h - fitH) / 2,
    });
  }, [fitW, fitH, box.w, box.h]);

  // reset view when image changes or first layout
  const fitKey = `${image?.id}:${Math.round(fitW)}:${Math.round(box.w)}`;
  const lastFitKey = useRef("");
  useEffect(() => {
    if (fitW && box.w && lastFitKey.current !== fitKey) {
      lastFitKey.current = fitKey;
      fitView();
    }
  }, [fitKey, fitW, box.w, fitView]);

  // wheel zoom toward cursor (native, non-passive so we can preventDefault)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setView((v) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        const k = scale / v.scale;
        return {
          scale,
          tx: mx - (mx - v.tx) * k,
          ty: my - (my - v.ty) * k,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ---- pointer -> normalized image coords (uses live svg rect incl. transform) ----
  const toNorm = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const r = svg.getBoundingClientRect();
      return {
        x: clamp01((e.clientX - r.left) / r.width),
        y: clamp01((e.clientY - r.top) / r.height),
      };
    },
    [],
  );

  // ---- drafts / drag / pan state ----
  const [draftBox, setDraftBox] = useState<BBoxAnnotation | null>(null);
  const [draftPoly, setDraftPoly] = useState<Point[]>([]);
  const [mouseN, setMouseN] = useState<Point | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  useEffect(() => {
    setDraftBox(null);
    setDraftPoly([]);
    dragRef.current = null;
  }, [image?.id, tool]);

  // keyboard: space (pan), escape, delete, enter (close polygon)
  useEffect(() => {
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement;
      return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA";
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isField(e.target)) {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.key === "Escape") {
        setDraftPoly([]);
        setDraftBox(null);
        selectAnnotation(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        if (isField(e.target)) return;
        e.preventDefault();
        removeAnnotation(selectedId);
      }
      if (e.key === "Enter" && tool === "polygon" && draftPoly.length >= 3) {
        commitPolygon(draftPoly);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, tool, draftPoly]);

  const commitPolygon = (pts: Point[]) => {
    if (pts.length >= 3 && activeClassId) {
      const a: PolygonAnnotation = {
        id: uid(),
        type: "polygon",
        classId: activeClassId,
        points: pts,
      };
      addAnnotation(a);
    }
    setDraftPoly([]);
    setMouseN(null);
  };

  // ---- pan ----
  const startPan = (e: React.PointerEvent) => {
    panRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  // ---- pointer handlers on svg ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (!image) return;
    // pan: space held or middle mouse
    if (spaceDown || e.button === 1) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    if (!activeClassId) return;
    const n = toNorm(e);

    if (tool === "bbox") {
      setDraftBox({
        id: "draft",
        type: "bbox",
        classId: activeClassId,
        x: n.x,
        y: n.y,
        w: 0,
        h: 0,
      });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }

    if (tool === "keypoint") {
      addAnnotation({
        id: uid(),
        type: "keypoint",
        classId: activeClassId,
        point: n,
      });
      return;
    }

    if (tool === "polygon") {
      if (draftPoly.length >= 3) {
        const first = draftPoly[0];
        const r = svgRef.current!.getBoundingClientRect();
        const dx = first.x * r.width - (e.clientX - r.left);
        const dy = first.y * r.height - (e.clientY - r.top);
        if (Math.hypot(dx, dy) < POLY_CLOSE_DIST) {
          commitPolygon(draftPoly);
          return;
        }
      }
      setDraftPoly((p) => [...p, n]);
      return;
    }

    if (tool === "select") selectAnnotation(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
      return;
    }

    const n = toNorm(e);
    if (tool === "polygon" && draftPoly.length > 0) setMouseN(n);

    if (draftBox) {
      const x = Math.min(draftBox.x, n.x);
      const y = Math.min(draftBox.y, n.y);
      const w = Math.abs(n.x - draftBox.x);
      const h = Math.abs(n.y - draftBox.y);
      setDraftBox({ ...draftBox, x, y, w, h });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "move") {
      moveAnnotation(drag.id, drag.orig, n.x - drag.startN.x, n.y - drag.startN.y);
    } else if (drag.kind === "resize") {
      resizeBox(drag.id, drag.corner, drag.orig, n);
    } else if (drag.kind === "vertex") {
      updateVertex(drag.id, drag.index, n);
    }
  };

  const onPointerUp = () => {
    panRef.current = null;
    if (draftBox) {
      if (draftBox.w > 0.004 && draftBox.h > 0.004) {
        addAnnotation({ ...draftBox, id: uid() });
      }
      setDraftBox(null);
    }
    dragRef.current = null;
  };

  // ---- mutation helpers ----
  const moveAnnotation = (
    id: string,
    orig: Annotation,
    dx: number,
    dy: number,
  ) => {
    if (orig.type === "bbox") {
      updateAnnotation(id, { x: clamp01(orig.x + dx), y: clamp01(orig.y + dy) });
    } else if (orig.type === "keypoint") {
      updateAnnotation(id, {
        point: { x: clamp01(orig.point.x + dx), y: clamp01(orig.point.y + dy) },
      } as Partial<Annotation>);
    } else if (orig.type === "polygon") {
      updateAnnotation(id, {
        points: orig.points.map((p) => ({
          x: clamp01(p.x + dx),
          y: clamp01(p.y + dy),
        })),
      } as Partial<Annotation>);
    }
  };

  const resizeBox = (
    id: string,
    corner: Corner,
    orig: BBoxAnnotation,
    n: Point,
  ) => {
    let { x, y, w, h } = orig;
    const right = orig.x + orig.w;
    const bottom = orig.y + orig.h;
    if (corner === "nw") {
      x = Math.min(n.x, right);
      y = Math.min(n.y, bottom);
      w = right - x;
      h = bottom - y;
    } else if (corner === "ne") {
      y = Math.min(n.y, bottom);
      w = Math.max(0, n.x - orig.x);
      h = bottom - y;
    } else if (corner === "se") {
      w = Math.max(0, n.x - orig.x);
      h = Math.max(0, n.y - orig.y);
    } else if (corner === "sw") {
      x = Math.min(n.x, right);
      w = right - x;
      h = Math.max(0, n.y - orig.y);
    }
    updateAnnotation(id, { x, y, w, h });
  };

  const updateVertex = (id: string, index: number, n: Point) => {
    const ann = image?.annotations.find((a) => a.id === id);
    if (ann?.type !== "polygon") return;
    updateAnnotation(id, {
      points: ann.points.map((p, i) => (i === index ? n : p)),
    } as Partial<Annotation>);
  };

  // ---- empty state ----
  if (!image) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        <div className="text-center">
          <p className="text-lg">Belum ada gambar dipilih</p>
          <p className="mt-1 text-sm">
            Upload gambar di panel kiri untuk mulai menganotasi.
          </p>
        </div>
      </div>
    );
  }

  const k = 1 / view.scale; // counter-scale so overlay stays crisp
  const cursor = panRef.current
    ? "grabbing"
    : spaceDown
      ? "grab"
      : tool === "select"
        ? "default"
        : tool === "keypoint"
          ? "cell"
          : "crosshair";

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_center,#1e293b_0%,#0b1120_100%)]"
    >
      {fitW > 0 && (
        <div
          className="absolute left-0 top-0 shadow-2xl"
          style={{
            width: fitW,
            height: fitH,
            transform: `translate3d(${view.tx}px, ${view.ty}px, 0) scale(${view.scale})`,
            transformOrigin: "0 0",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.dataUrl}
            alt={image.name}
            className="absolute inset-0 h-full w-full select-none"
            draggable={false}
          />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${fitW} ${fitH}`}
            width={fitW}
            height={fitH}
            className="absolute inset-0 touch-none"
            style={{ cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            {image.annotations.map((a) =>
              renderAnnotation(a, {
                fitW,
                fitH,
                k,
                color: colorOf(a.classId),
                name: nameOf(a.classId),
                selected: a.id === selectedId,
                tool,
                interactive: !spaceDown,
                startMove: (e) => {
                  if (tool !== "select" || spaceDown) return;
                  selectAnnotation(a.id);
                  beginEdit();
                  dragRef.current = {
                    kind: "move",
                    id: a.id,
                    startN: toNorm(e),
                    orig: a,
                  };
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                },
                startResize: (corner, e) => {
                  if (a.type !== "bbox" || spaceDown) return;
                  beginEdit();
                  dragRef.current = { kind: "resize", id: a.id, corner, orig: a };
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                },
                startVertex: (index, e) => {
                  if (spaceDown) return;
                  beginEdit();
                  dragRef.current = { kind: "vertex", id: a.id, index };
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                },
              }),
            )}

            {draftBox && (
              <rect
                x={draftBox.x * fitW}
                y={draftBox.y * fitH}
                width={draftBox.w * fitW}
                height={draftBox.h * fitH}
                fill={colorOf(draftBox.classId) + "22"}
                stroke={colorOf(draftBox.classId)}
                strokeWidth={2 * k}
                strokeDasharray={`${4 * k} ${3 * k}`}
              />
            )}

            {draftPoly.length > 0 && (
              <DraftPolygon
                points={draftPoly}
                mouse={mouseN}
                fitW={fitW}
                fitH={fitH}
                k={k}
                color={activeClassId ? colorOf(activeClassId) : "#fff"}
              />
            )}
          </svg>
        </div>
      )}

      {/* zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-black/60 p-1 text-sm text-zinc-200 backdrop-blur">
        <button
          onClick={() =>
            setView((v) => ({
              ...v,
              scale: Math.max(MIN_SCALE, v.scale / 1.25),
            }))
          }
          className="h-7 w-7 rounded hover:bg-white/10"
        >
          −
        </button>
        <span className="w-12 text-center text-xs tabular-nums">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          onClick={() =>
            setView((v) => ({
              ...v,
              scale: Math.min(MAX_SCALE, v.scale * 1.25),
            }))
          }
          className="h-7 w-7 rounded hover:bg-white/10"
        >
          +
        </button>
        <button
          onClick={fitView}
          className="ml-1 rounded px-2 text-xs hover:bg-white/10"
          title="Sesuaikan ke layar"
        >
          Fit
        </button>
      </div>

      <HelpHint tool={tool} polyLen={draftPoly.length} />
    </div>
  );
}

// ----------------------------------------------------------------------------

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

interface RenderCtx {
  fitW: number;
  fitH: number;
  k: number;
  color: string;
  name: string;
  selected: boolean;
  tool: string;
  interactive: boolean;
  startMove: (e: React.PointerEvent) => void;
  startResize: (corner: Corner, e: React.PointerEvent) => void;
  startVertex: (index: number, e: React.PointerEvent) => void;
}

function renderAnnotation(a: Annotation, ctx: RenderCtx) {
  const { fitW, fitH, k, color, name, selected, interactive } = ctx;
  const sw = (selected ? 3 : 2) * k;
  const hs = HANDLE * k;
  const moveCursor = ctx.tool === "select" && interactive ? "move" : "inherit";

  if (a.type === "bbox") {
    const x = a.x * fitW;
    const y = a.y * fitH;
    const w = a.w * fitW;
    const h = a.h * fitH;
    return (
      <g key={a.id}>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={color + (selected ? "33" : "1a")}
          stroke={color}
          strokeWidth={sw}
          onPointerDown={ctx.startMove}
          style={{ cursor: moveCursor }}
        />
        <Label x={x} y={y} text={name} color={color} k={k} />
        {selected &&
          (["nw", "ne", "se", "sw"] as Corner[]).map((c) => {
            const hx = c === "nw" || c === "sw" ? x : x + w;
            const hy = c === "nw" || c === "ne" ? y : y + h;
            return (
              <rect
                key={c}
                x={hx - hs / 2}
                y={hy - hs / 2}
                width={hs}
                height={hs}
                fill="#fff"
                stroke={color}
                strokeWidth={1.5 * k}
                style={{
                  cursor:
                    c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  ctx.startResize(c, e);
                }}
              />
            );
          })}
      </g>
    );
  }

  if (a.type === "polygon") {
    const pts = a.points.map((p) => `${p.x * fitW},${p.y * fitH}`).join(" ");
    const first = a.points[0];
    return (
      <g key={a.id}>
        <polygon
          points={pts}
          fill={color + (selected ? "33" : "1a")}
          stroke={color}
          strokeWidth={sw}
          onPointerDown={ctx.startMove}
          style={{ cursor: moveCursor }}
        />
        {first && (
          <Label x={first.x * fitW} y={first.y * fitH} text={name} color={color} k={k} />
        )}
        {selected &&
          a.points.map((p, i) => (
            <circle
              key={i}
              cx={p.x * fitW}
              cy={p.y * fitH}
              r={hs / 2 + k}
              fill="#fff"
              stroke={color}
              strokeWidth={1.5 * k}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                ctx.startVertex(i, e);
              }}
            />
          ))}
      </g>
    );
  }

  const cx = a.point.x * fitW;
  const cy = a.point.y * fitH;
  return (
    <g key={a.id}>
      <circle
        cx={cx}
        cy={cy}
        r={(selected ? 7 : 5) * k}
        fill={color}
        stroke="#fff"
        strokeWidth={(selected ? 2.5 : 1.5) * k}
        onPointerDown={ctx.startMove}
        style={{ cursor: moveCursor }}
      />
      <Label x={cx + 8 * k} y={cy - 8 * k} text={name} color={color} k={k} />
    </g>
  );
}

function Label({
  x,
  y,
  text,
  color,
  k,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  k: number;
}) {
  const top = Math.max(0, y - 18 * k);
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={x}
        y={top}
        width={(text.length * 7 + 10) * k}
        height={16 * k}
        fill={color}
        rx={2 * k}
      />
      <text
        x={x + 5 * k}
        y={top + 12 * k}
        fontSize={11 * k}
        fill="#fff"
        fontFamily="ui-sans-serif, system-ui"
      >
        {text}
      </text>
    </g>
  );
}

function DraftPolygon({
  points,
  mouse,
  fitW,
  fitH,
  k,
  color,
}: {
  points: Point[];
  mouse: Point | null;
  fitW: number;
  fitH: number;
  k: number;
  color: string;
}) {
  const path = points.map((p) => `${p.x * fitW},${p.y * fitH}`).join(" ");
  const last = points[points.length - 1];
  return (
    <g style={{ pointerEvents: "none" }}>
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth={2 * k}
        strokeDasharray={`${4 * k} ${3 * k}`}
      />
      {mouse && last && (
        <line
          x1={last.x * fitW}
          y1={last.y * fitH}
          x2={mouse.x * fitW}
          y2={mouse.y * fitH}
          stroke={color}
          strokeWidth={1.5 * k}
          strokeDasharray={`${2 * k} ${2 * k}`}
          opacity={0.7}
        />
      )}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x * fitW}
          cy={p.y * fitH}
          r={(i === 0 ? 6 : 4) * k}
          fill={i === 0 ? "#fff" : color}
          stroke={color}
          strokeWidth={1.5 * k}
        />
      ))}
    </g>
  );
}

function HelpHint({ tool, polyLen }: { tool: string; polyLen: number }) {
  const msg: Record<string, string> = {
    select: "Klik objek untuk pilih · drag geser · Del hapus · Ctrl+Z undo",
    bbox: "Drag untuk menggambar kotak",
    polygon:
      polyLen >= 3
        ? "Klik titik awal / Enter untuk menutup · Esc batal"
        : "Klik untuk menambah titik poligon",
    keypoint: "Klik untuk menempatkan titik",
  };
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs text-zinc-200 backdrop-blur">
      {msg[tool]} · Scroll zoom · Space+drag geser
    </div>
  );
}

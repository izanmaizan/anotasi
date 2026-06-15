import { create } from "zustand";
import { persist } from "zustand/middleware";
import { deleteImageData, saveImageData } from "./idb";
import type {
  Annotation,
  ImageItem,
  LabelClass,
  Tool,
} from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);
const HISTORY_LIMIT = 50;

const DEFAULT_CLASSES: LabelClass[] = [
  { id: uid(), name: "object", color: "#ef4444" },
  { id: uid(), name: "person", color: "#3b82f6" },
  { id: uid(), name: "vehicle", color: "#22c55e" },
];

// Lightweight per-image annotation snapshot for undo/redo (no image blobs).
type AnnoSnap = { id: string; annotations: Annotation[]; tags: string[] }[];

function stripAnno(images: ImageItem[]): AnnoSnap {
  return images.map((i) => ({
    id: i.id,
    annotations: i.annotations,
    tags: i.tags,
  }));
}

interface AppState {
  images: ImageItem[];
  classes: LabelClass[];
  activeImageId: string | null;
  activeClassId: string | null;
  tool: Tool;
  selectedAnnotationId: string | null;
  _past: AnnoSnap[];
  _future: AnnoSnap[];

  // selectors
  activeImage: () => ImageItem | undefined;
  classById: (id: string) => LabelClass | undefined;

  // image actions
  addImages: (items: Omit<ImageItem, "annotations" | "tags">[]) => void;
  removeImage: (id: string) => void;
  setActiveImage: (id: string) => void;
  stepImage: (dir: 1 | -1) => void;
  hydrateImageData: (map: Record<string, string>) => void;

  // class actions
  addClass: (name: string, color: string) => void;
  updateClass: (id: string, patch: Partial<Omit<LabelClass, "id">>) => void;
  removeClass: (id: string) => void;
  setActiveClass: (id: string) => void;
  setActiveClassByIndex: (index: number) => void;

  // tool / selection
  setTool: (t: Tool) => void;
  selectAnnotation: (id: string | null) => void;

  // annotation actions
  addAnnotation: (a: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;

  // classification tags
  toggleTag: (classId: string) => void;

  // history
  beginEdit: () => void;
  undo: () => void;
  redo: () => void;
}

function patchActiveImage(
  state: AppState,
  fn: (img: ImageItem) => ImageItem,
): Partial<AppState> {
  if (!state.activeImageId) return {};
  return {
    images: state.images.map((img) =>
      img.id === state.activeImageId ? fn(img) : img,
    ),
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      // push current annotation state to undo history
      const snapshot = () =>
        set((s) => ({
          _past: [...s._past, stripAnno(s.images)].slice(-HISTORY_LIMIT),
          _future: [],
        }));

      return {
        images: [],
        classes: DEFAULT_CLASSES,
        activeImageId: null,
        activeClassId: DEFAULT_CLASSES[0].id,
        tool: "select",
        selectedAnnotationId: null,
        _past: [],
        _future: [],

        activeImage: () =>
          get().images.find((i) => i.id === get().activeImageId),
        classById: (id) => get().classes.find((c) => c.id === id),

        addImages: (items) => {
          items.forEach((it) => {
            void saveImageData(it.id, it.dataUrl);
          });
          set((s) => {
            const newItems: ImageItem[] = items.map((it) => ({
              ...it,
              annotations: [],
              tags: [],
            }));
            const images = [...s.images, ...newItems];
            const activeValid = images.some((i) => i.id === s.activeImageId);
            return {
              images,
              activeImageId: activeValid
                ? s.activeImageId
                : (newItems[0]?.id ?? null),
            };
          });
        },

        removeImage: (id) => {
          void deleteImageData(id);
          set((s) => {
            const idx = s.images.findIndex((i) => i.id === id);
            const images = s.images.filter((i) => i.id !== id);
            let activeImageId = s.activeImageId;
            if (s.activeImageId === id) {
              const next = images[idx] ?? images[idx - 1] ?? images[0];
              activeImageId = next?.id ?? null;
            }
            return { images, activeImageId, selectedAnnotationId: null };
          });
        },

        setActiveImage: (id) =>
          set({ activeImageId: id, selectedAnnotationId: null }),

        stepImage: (dir) =>
          set((s) => {
            if (s.images.length === 0) return {};
            const idx = s.images.findIndex((i) => i.id === s.activeImageId);
            const next =
              (idx + dir + s.images.length) % s.images.length;
            return {
              activeImageId: s.images[next].id,
              selectedAnnotationId: null,
            };
          }),

        hydrateImageData: (map) =>
          set((s) => {
            // attach blobs from IndexedDB; drop any image whose blob is missing
            // (e.g. leftover metadata with no recoverable picture)
            const images = s.images
              .map((img) =>
                map[img.id] ? { ...img, dataUrl: map[img.id] } : img,
              )
              .filter((img) => !!img.dataUrl);
            const activeValid = images.some((i) => i.id === s.activeImageId);
            return {
              images,
              activeImageId: activeValid
                ? s.activeImageId
                : (images[0]?.id ?? null),
            };
          }),

        addClass: (name, color) =>
          set((s) => {
            const c: LabelClass = { id: uid(), name, color };
            return {
              classes: [...s.classes, c],
              activeClassId: s.activeClassId ?? c.id,
            };
          }),

        updateClass: (id, patch) =>
          set((s) => ({
            classes: s.classes.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          })),

        removeClass: (id) =>
          set((s) => ({
            classes: s.classes.filter((c) => c.id !== id),
            activeClassId:
              s.activeClassId === id
                ? (s.classes.find((c) => c.id !== id)?.id ?? null)
                : s.activeClassId,
            images: s.images.map((img) => ({
              ...img,
              annotations: img.annotations.filter((a) => a.classId !== id),
              tags: img.tags.filter((t) => t !== id),
            })),
          })),

        setActiveClass: (id) => set({ activeClassId: id }),

        setActiveClassByIndex: (index) =>
          set((s) =>
            s.classes[index] ? { activeClassId: s.classes[index].id } : {},
          ),

        setTool: (t) => set({ tool: t, selectedAnnotationId: null }),

        selectAnnotation: (id) => set({ selectedAnnotationId: id }),

        addAnnotation: (a) => {
          snapshot();
          set((s) => ({
            ...patchActiveImage(s, (img) => ({
              ...img,
              annotations: [...img.annotations, a],
            })),
            selectedAnnotationId: a.id,
          }));
        },

        updateAnnotation: (id, patch) =>
          set((s) =>
            patchActiveImage(s, (img) => ({
              ...img,
              annotations: img.annotations.map((a) =>
                a.id === id ? ({ ...a, ...patch } as Annotation) : a,
              ),
            })),
          ),

        removeAnnotation: (id) => {
          snapshot();
          set((s) => ({
            ...patchActiveImage(s, (img) => ({
              ...img,
              annotations: img.annotations.filter((a) => a.id !== id),
            })),
            selectedAnnotationId:
              s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
          }));
        },

        toggleTag: (classId) => {
          snapshot();
          set((s) =>
            patchActiveImage(s, (img) => ({
              ...img,
              tags: img.tags.includes(classId)
                ? img.tags.filter((t) => t !== classId)
                : [...img.tags, classId],
            })),
          );
        },

        beginEdit: () => snapshot(),

        undo: () =>
          set((s) => {
            if (s._past.length === 0) return {};
            const prev = s._past[s._past.length - 1];
            const snapMap = new Map(prev.map((p) => [p.id, p]));
            return {
              _past: s._past.slice(0, -1),
              _future: [...s._future, stripAnno(s.images)],
              images: s.images.map((img) => {
                const p = snapMap.get(img.id);
                return p
                  ? { ...img, annotations: p.annotations, tags: p.tags }
                  : img;
              }),
              selectedAnnotationId: null,
            };
          }),

        redo: () =>
          set((s) => {
            if (s._future.length === 0) return {};
            const next = s._future[s._future.length - 1];
            const snapMap = new Map(next.map((p) => [p.id, p]));
            return {
              _future: s._future.slice(0, -1),
              _past: [...s._past, stripAnno(s.images)],
              images: s.images.map((img) => {
                const p = snapMap.get(img.id);
                return p
                  ? { ...img, annotations: p.annotations, tags: p.tags }
                  : img;
              }),
              selectedAnnotationId: null,
            };
          }),
      };
    },
    {
      name: "anotasi-store",
      version: 2,
      // v1 stored image blobs inline in localStorage and had no IndexedDB copy,
      // so those images are unrecoverable after the upgrade. Drop them (clean
      // slate) but keep the user's classes. Images uploaded under v2+ live in
      // IndexedDB and are rehydrated on load.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...p,
          images: [],
          activeImageId: null,
        } as never;
      },
      // Persist metadata only — image blobs live in IndexedDB, and history is
      // transient. Strip dataUrl so we never hit the localStorage quota.
      partialize: (s) => ({
        images: s.images.map((img) => ({
          id: img.id,
          name: img.name,
          width: img.width,
          height: img.height,
          annotations: img.annotations,
          tags: img.tags,
        })),
        classes: s.classes,
        activeImageId: s.activeImageId,
        activeClassId: s.activeClassId,
      }),
    },
  ),
);

export { uid };
export type { Annotation, ImageItem, LabelClass, Point, Tool } from "./types";

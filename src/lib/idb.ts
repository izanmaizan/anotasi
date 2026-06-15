// Image blobs (data URLs) are stored in IndexedDB, not localStorage, because a
// single real photo easily exceeds the ~5MB localStorage quota. localStorage
// keeps only lightweight metadata (annotations, classes, tags).
import { del, entries, get, set } from "idb-keyval";

const KEY = (id: string) => `img:${id}`;

export async function saveImageData(id: string, dataUrl: string) {
  await set(KEY(id), dataUrl);
}

export async function deleteImageData(id: string) {
  await del(KEY(id));
}

export async function loadAllImageData(): Promise<Record<string, string>> {
  const all = await entries<string, string>();
  const map: Record<string, string> = {};
  for (const [k, v] of all) {
    if (typeof k === "string" && k.startsWith("img:")) {
      map[k.slice(4)] = v;
    }
  }
  return map;
}

export async function getImageData(id: string): Promise<string | undefined> {
  return get<string>(KEY(id));
}

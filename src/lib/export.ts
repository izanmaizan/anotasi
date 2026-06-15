import type { ImageItem, LabelClass } from "./types";

// Build a COCO-style JSON from the dataset.
// bbox is [x, y, w, h] in absolute pixels; polygons go in `segmentation`;
// keypoints are emitted as 1-point keypoint arrays; whole-image tags go to a
// custom `image_tags` field (not standard COCO, handy for the prototype).
export function toCOCO(images: ImageItem[], classes: LabelClass[]) {
  const catIndex = new Map(classes.map((c, i) => [c.id, i + 1]));
  const categories = classes.map((c, i) => ({
    id: i + 1,
    name: c.name,
    supercategory: "none",
  }));

  const cocoImages = images.map((img, i) => ({
    id: i + 1,
    file_name: img.name,
    width: img.width,
    height: img.height,
    image_tags: img.tags
      .map((t) => classes.find((c) => c.id === t)?.name)
      .filter(Boolean),
  }));

  const annotations: Record<string, unknown>[] = [];
  let annId = 1;
  images.forEach((img, imgIdx) => {
    const W = img.width;
    const H = img.height;
    for (const a of img.annotations) {
      const category_id = catIndex.get(a.classId);
      if (!category_id) continue;
      const base = { id: annId++, image_id: imgIdx + 1, category_id };
      if (a.type === "bbox") {
        const bx = a.x * W;
        const by = a.y * H;
        const bw = a.w * W;
        const bh = a.h * H;
        annotations.push({
          ...base,
          bbox: [r(bx), r(by), r(bw), r(bh)],
          area: r(bw * bh),
          iscrowd: 0,
        });
      } else if (a.type === "polygon") {
        const seg = a.points.flatMap((p) => [r(p.x * W), r(p.y * H)]);
        const xs = a.points.map((p) => p.x * W);
        const ys = a.points.map((p) => p.y * H);
        const bx = Math.min(...xs);
        const by = Math.min(...ys);
        annotations.push({
          ...base,
          segmentation: [seg],
          bbox: [
            r(bx),
            r(by),
            r(Math.max(...xs) - bx),
            r(Math.max(...ys) - by),
          ],
          area: r(polygonArea(xs, ys)),
          iscrowd: 0,
        });
      } else {
        annotations.push({
          ...base,
          keypoints: [r(a.point.x * W), r(a.point.y * H), 2],
          num_keypoints: 1,
        });
      }
    }
  });

  return { info: { description: "anotasi export" }, images: cocoImages, annotations, categories };
}

// YOLO detection format: one .txt per image, lines of
// `class_index cx cy w h` (all normalized 0..1). Polygons are reduced to their
// bounding box; keypoints become a tiny box centered on the point.
export function toYOLO(images: ImageItem[], classes: LabelClass[]) {
  const classIndex = new Map(classes.map((c, i) => [c.id, i]));
  const files: { name: string; content: string }[] = [];

  for (const img of images) {
    const lines: string[] = [];
    for (const a of img.annotations) {
      const ci = classIndex.get(a.classId);
      if (ci === undefined) continue;
      let cx = 0, cy = 0, w = 0, h = 0;
      if (a.type === "bbox") {
        cx = a.x + a.w / 2;
        cy = a.y + a.h / 2;
        w = a.w;
        h = a.h;
      } else if (a.type === "polygon") {
        const xs = a.points.map((p) => p.x);
        const ys = a.points.map((p) => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        cx = (minX + maxX) / 2;
        cy = (minY + maxY) / 2;
        w = maxX - minX;
        h = maxY - minY;
      } else {
        cx = a.point.x;
        cy = a.point.y;
        w = 0.01;
        h = 0.01;
      }
      lines.push(
        `${ci} ${f(cx)} ${f(cy)} ${f(w)} ${f(h)}`,
      );
    }
    files.push({
      name: img.name.replace(/\.[^.]+$/, "") + ".txt",
      content: lines.join("\n"),
    });
  }

  const classesTxt = classes.map((c) => c.name).join("\n");
  return { files, classesTxt };
}

function r(n: number) {
  return Math.round(n * 100) / 100;
}
function f(n: number) {
  return n.toFixed(6);
}
function polygonArea(xs: number[], ys: number[]) {
  let area = 0;
  for (let i = 0; i < xs.length; i++) {
    const j = (i + 1) % xs.length;
    area += xs[i] * ys[j] - xs[j] * ys[i];
  }
  return Math.abs(area) / 2;
}

export function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

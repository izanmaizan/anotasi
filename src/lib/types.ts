// Core data model for the annotation prototype.
// All geometry is stored in NORMALIZED coordinates (0..1) relative to the
// image, so annotations scale correctly at any display size.

export type Tool = "select" | "bbox" | "polygon" | "keypoint";

export interface LabelClass {
  id: string;
  name: string;
  color: string;
}

export interface Point {
  x: number; // 0..1
  y: number; // 0..1
}

export interface BBoxAnnotation {
  id: string;
  type: "bbox";
  classId: string;
  x: number; // top-left, 0..1
  y: number;
  w: number; // 0..1
  h: number;
}

export interface PolygonAnnotation {
  id: string;
  type: "polygon";
  classId: string;
  points: Point[];
}

export interface KeypointAnnotation {
  id: string;
  type: "keypoint";
  classId: string;
  point: Point;
}

export type Annotation =
  | BBoxAnnotation
  | PolygonAnnotation
  | KeypointAnnotation;

export interface ImageItem {
  id: string;
  name: string;
  dataUrl: string;
  width: number; // natural px
  height: number; // natural px
  annotations: Annotation[];
  tags: string[]; // classIds applied as whole-image classification labels
}

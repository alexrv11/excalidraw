/**
 * Helpers for building valid Excalidraw v2 library elements.
 * All elements use roughness:0 (clean) and Excalidraw's default field set.
 */

type FillStyle = "solid" | "hachure" | "cross-hatch" | "none";
type StrokeStyle = "solid" | "dashed" | "dotted";

interface BaseOpts {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: FillStyle;
  strokeWidth?: number;
  strokeStyle?: StrokeStyle;
  roughness?: number;
  opacity?: number;
  rounded?: boolean;
}

function base(opts: BaseOpts, type: string): Record<string, unknown> {
  return {
    id: opts.id,
    type,
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    angle: 0,
    strokeColor: opts.strokeColor ?? "#1e293b",
    backgroundColor: opts.backgroundColor ?? "transparent",
    fillStyle: opts.fillStyle ?? "solid",
    strokeWidth: opts.strokeWidth ?? 2,
    strokeStyle: opts.strokeStyle ?? "solid",
    roughness: opts.roughness ?? 0,
    opacity: opts.opacity ?? 100,
    groupIds: [],
    frameId: null,
    roundness: opts.rounded ? { type: 3 } : null,
    seed: strHash(opts.id),
    version: 1,
    versionNonce: 0,
    index: null,
    isDeleted: false,
    boundElements: null,
    updated: 1700000000000,
    created: 1700000000000,
    link: null,
    locked: false,
  };
}

/** Deterministic integer hash of a string — used as element seed */
function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export const el = {
  rect(opts: BaseOpts) {
    return base(opts, "rectangle");
  },

  ellipse(opts: BaseOpts) {
    return base(opts, "ellipse");
  },

  diamond(opts: BaseOpts) {
    return base(opts, "diamond");
  },

  line(opts: BaseOpts & { points: [number, number][] }) {
    return {
      ...base(opts, "line"),
      points: opts.points,
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: null,
    };
  },

  arrow(opts: BaseOpts & { points: [number, number][]; endArrowhead?: string }) {
    return {
      ...base(opts, "arrow"),
      points: opts.points,
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: opts.endArrowhead ?? "arrow",
    };
  },

  text(
    opts: Omit<BaseOpts, "width" | "height"> & {
      text: string;
      fontSize?: number;
      textAlign?: "left" | "center" | "right";
      fontFamily?: 1 | 2 | 3;
    },
  ) {
    const fontSize = opts.fontSize ?? 14;
    const text = opts.text;
    return {
      ...base(
        {
          ...opts,
          width: fontSize * text.length * 0.55,
          height: fontSize * 1.5,
          backgroundColor: "transparent",
        },
        "text",
      ),
      text,
      originalText: text,
      fontSize,
      fontFamily: opts.fontFamily ?? 1,
      textAlign: opts.textAlign ?? "left",
      verticalAlign: "top",
      containerId: null,
      autoResize: true,
      lineHeight: 1.25,
    };
  },
};

export interface IconDef {
  id: string;
  name: string;
  elements: Record<string, unknown>[];
  svgPreview: string;
}

export interface CollectionDef {
  id: string;
  title: string;
  description: string;
  author: string;
  authorUrl: string;
  icons: IconDef[];
}

export function buildLibraryFile(col: CollectionDef) {
  return {
    type: "excalidrawlib",
    version: 2,
    source: "https://excalidraw.ventulab.com",
    libraryItems: col.icons.map((icon) => ({
      id: icon.id,
      status: "published",
      created: 1700000000000,
      name: icon.name,
      elements: icon.elements,
    })),
  };
}

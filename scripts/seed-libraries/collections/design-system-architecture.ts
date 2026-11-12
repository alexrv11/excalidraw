import { el, type CollectionDef } from "../lib-format.js";

const P = "#6965db"; // accent purple
const PL = "#ede9fe"; // light purple
const D = "#1e293b"; // dark
const G = "#64748b"; // gray
const A = "#f59e0b"; // amber
const AL = "#fef3c7"; // amber light
const T = "#0ea5e9"; // teal/blue
const TL = "#e0f2fe"; // teal light
const R = "#ef4444"; // red
const RL = "#fee2e2"; // red light
const GR = "#22c55e"; // green
const GRL = "#dcfce7"; // green light

/** Wrap arbitrary SVG content in a 160×160 viewBox */
function svg(content: string): string {
  return `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

export const designSystemArchitecture: CollectionDef = {
  id: "design-system-architecture",
  title: "Design System Architecture",
  description:
    "Icons for documenting design systems — tokens, themes, component hierarchies, states, patterns, and governance concepts.",
  author: "Excalidraw",
  authorUrl: "https://github.com/excalidraw",
  icons: [
    // ── 1. Component ───────────────────────────────────────────────────────────
    {
      id: "dsa-component",
      name: "Component",
      elements: [
        el.rect({ id: "dsa-comp-body", x: 10, y: 30, width: 140, height: 100, strokeColor: P, backgroundColor: PL, rounded: true }),
        el.rect({ id: "dsa-comp-hdr", x: 10, y: 30, width: 140, height: 30, strokeColor: P, backgroundColor: P, rounded: true }),
        el.text({ id: "dsa-comp-lbl", x: 36, y: 38, text: "<Component />", fontSize: 13, strokeColor: "#fff", textAlign: "left" }),
        el.line({ id: "dsa-comp-l1", x: 20, y: 95, width: 0, height: 0, points: [[0,0],[120,0]], strokeColor: P, strokeStyle: "dashed", strokeWidth: 1 }),
        el.rect({ id: "dsa-comp-slot1", x: 20, y: 70, width: 36, height: 20, strokeColor: P, backgroundColor: "transparent", strokeStyle: "dashed" }),
        el.rect({ id: "dsa-comp-slot2", x: 62, y: 70, width: 36, height: 20, strokeColor: P, backgroundColor: "transparent", strokeStyle: "dashed" }),
        el.rect({ id: "dsa-comp-slot3", x: 104, y: 70, width: 36, height: 20, strokeColor: P, backgroundColor: "transparent", strokeStyle: "dashed" }),
      ],
      svgPreview: svg(`
        <rect x="10" y="30" width="140" height="100" rx="8" fill="${PL}" stroke="${P}" stroke-width="2.5"/>
        <rect x="10" y="30" width="140" height="30" rx="8" fill="${P}"/>
        <rect x="10" y="52" width="140" height="8" rx="0" fill="${P}"/>
        <text x="80" y="52" text-anchor="middle" fill="white" font-family="monospace" font-size="11">&lt;Component /&gt;</text>
        <line x1="20" y1="95" x2="140" y2="95" stroke="${P}" stroke-width="1.5" stroke-dasharray="4 3"/>
        <rect x="20" y="70" width="36" height="20" rx="3" fill="none" stroke="${P}" stroke-width="1.5" stroke-dasharray="4 3"/>
        <rect x="62" y="70" width="36" height="20" rx="3" fill="none" stroke="${P}" stroke-width="1.5" stroke-dasharray="4 3"/>
        <rect x="104" y="70" width="36" height="20" rx="3" fill="none" stroke="${P}" stroke-width="1.5" stroke-dasharray="4 3"/>
      `),
    },

    // ── 2. Design Token ────────────────────────────────────────────────────────
    {
      id: "dsa-token",
      name: "Token",
      elements: [
        el.diamond({ id: "dsa-token-dia", x: 30, y: 10, width: 100, height: 110, strokeColor: "#b45309", backgroundColor: AL }),
        el.ellipse({ id: "dsa-token-dot", x: 65, y: 50, width: 30, height: 30, strokeColor: "#b45309", backgroundColor: A }),
        el.text({ id: "dsa-token-eq", x: 46, y: 90, text: "= value", fontSize: 12, strokeColor: "#92400e" }),
      ],
      svgPreview: svg(`
        <polygon points="80,8 155,65 80,122 5,65" fill="${AL}" stroke="#b45309" stroke-width="2.5"/>
        <circle cx="80" cy="65" r="16" fill="${A}" stroke="#b45309" stroke-width="2"/>
        <text x="80" y="108" text-anchor="middle" fill="#92400e" font-family="monospace" font-size="12">= value</text>
      `),
    },

    // ── 3. Theme ───────────────────────────────────────────────────────────────
    {
      id: "dsa-theme",
      name: "Theme",
      elements: [
        el.ellipse({ id: "dsa-theme-circle", x: 20, y: 20, width: 120, height: 120, strokeColor: D, backgroundColor: "#f8fafc" }),
        el.rect({ id: "dsa-theme-dark-fill", x: 80, y: 20, width: 61, height: 120, strokeColor: "transparent", backgroundColor: "#0f172a" }),
        el.ellipse({ id: "dsa-theme-outline", x: 20, y: 20, width: 120, height: 120, strokeColor: D, backgroundColor: "transparent" }),
        el.line({ id: "dsa-theme-split", x: 80, y: 20, width: 0, height: 0, points: [[0,0],[0,120]], strokeColor: D, strokeWidth: 2 }),
        el.text({ id: "dsa-theme-sun", x: 36, y: 68, text: "☀", fontSize: 22, strokeColor: "#b45309" }),
        el.text({ id: "dsa-theme-moon", x: 90, y: 68, text: "☽", fontSize: 22, strokeColor: "#94a3b8" }),
      ],
      svgPreview: svg(`
        <circle cx="80" cy="80" r="60" fill="#f8fafc" stroke="${D}" stroke-width="2.5"/>
        <path d="M80,20 A60,60 0 0,1 80,140 Z" fill="#0f172a"/>
        <circle cx="80" cy="80" r="60" fill="none" stroke="${D}" stroke-width="2.5"/>
        <line x1="80" y1="20" x2="80" y2="140" stroke="${D}" stroke-width="2"/>
        <text x="52" y="90" text-anchor="middle" font-size="26">☀️</text>
        <text x="108" y="90" text-anchor="middle" font-size="26">🌙</text>
      `),
    },

    // ── 4. Color Scale ─────────────────────────────────────────────────────────
    {
      id: "dsa-color-scale",
      name: "Color Scale",
      elements: [
        el.rect({ id: "dsa-col-1", x: 5,  y: 30, width: 25, height: 100, strokeColor: "#c7d2fe", backgroundColor: "#eef2ff" }),
        el.rect({ id: "dsa-col-2", x: 32, y: 30, width: 25, height: 100, strokeColor: "#a5b4fc", backgroundColor: "#c7d2fe" }),
        el.rect({ id: "dsa-col-3", x: 59, y: 30, width: 25, height: 100, strokeColor: P,         backgroundColor: PL }),
        el.rect({ id: "dsa-col-4", x: 86, y: 30, width: 25, height: 100, strokeColor: "#4f46e5", backgroundColor: P }),
        el.rect({ id: "dsa-col-5", x: 113,y: 30, width: 25, height: 100, strokeColor: "#312e81", backgroundColor: "#1e1b4b" }),
        el.rect({ id: "dsa-col-6", x: 140,y: 30, width: 15, height: 100, strokeColor: "#1e1b4b", backgroundColor: "#0f0e1a" }),
      ],
      svgPreview: svg(`
        <rect x="5"   y="30" width="22" height="100" rx="3" fill="#eef2ff" stroke="#c7d2fe" stroke-width="1.5"/>
        <rect x="29"  y="30" width="22" height="100" rx="3" fill="#c7d2fe" stroke="#a5b4fc" stroke-width="1.5"/>
        <rect x="53"  y="30" width="22" height="100" rx="3" fill="${PL}"   stroke="${P}"    stroke-width="1.5"/>
        <rect x="77"  y="30" width="22" height="100" rx="3" fill="${P}"    stroke="#4f46e5" stroke-width="1.5"/>
        <rect x="101" y="30" width="22" height="100" rx="3" fill="#4338ca" stroke="#3730a3" stroke-width="1.5"/>
        <rect x="125" y="30" width="22" height="100" rx="3" fill="#1e1b4b" stroke="#12104a" stroke-width="1.5"/>
      `),
    },

    // ── 5. Typography ──────────────────────────────────────────────────────────
    {
      id: "dsa-typography",
      name: "Typography",
      elements: [
        el.text({ id: "dsa-typo-aa", x: 15, y: 15, text: "Aa", fontSize: 60, strokeColor: D, fontFamily: 1 }),
        el.line({ id: "dsa-typo-baseline", x: 15, y: 95, width: 0, height: 0, points: [[0,0],[130,0]], strokeColor: G, strokeStyle: "dashed", strokeWidth: 1 }),
        el.line({ id: "dsa-typo-xline",    x: 15, y: 75, width: 0, height: 0, points: [[0,0],[130,0]], strokeColor: G, strokeStyle: "dashed", strokeWidth: 1 }),
        el.line({ id: "dsa-typo-capline",  x: 15, y: 15, width: 0, height: 0, points: [[0,0],[130,0]], strokeColor: G, strokeStyle: "dashed", strokeWidth: 1 }),
        el.text({ id: "dsa-typo-scale", x: 15, y: 110, text: "16 / 24 / 32 / 48", fontSize: 10, strokeColor: G }),
      ],
      svgPreview: svg(`
        <text x="10" y="95" font-family="Georgia,serif" font-size="80" fill="${D}">Aa</text>
        <line x1="10" y1="100" x2="150" y2="100" stroke="${G}" stroke-width="1.5" stroke-dasharray="4 3"/>
        <line x1="10" y1="78"  x2="150" y2="78"  stroke="${G}" stroke-width="1" stroke-dasharray="3 4"/>
        <line x1="10" y1="18"  x2="150" y2="18"  stroke="${G}" stroke-width="1" stroke-dasharray="3 4"/>
        <text x="10" y="118" font-family="sans-serif" font-size="10" fill="${G}">16 / 24 / 32 / 48</text>
      `),
    },

    // ── 6. Spacing ─────────────────────────────────────────────────────────────
    {
      id: "dsa-spacing",
      name: "Spacing",
      elements: [
        el.rect({ id: "dsa-sp-a", x: 10, y: 55, width: 45, height: 45, strokeColor: P, backgroundColor: PL }),
        el.rect({ id: "dsa-sp-b", x: 95, y: 55, width: 45, height: 45, strokeColor: P, backgroundColor: PL }),
        el.arrow({ id: "dsa-sp-arr1", x: 55, y: 77, width: 0, height: 0, points: [[0,0],[40,0]], strokeColor: P }),
        el.arrow({ id: "dsa-sp-arr2", x: 95, y: 77, width: 0, height: 0, points: [[0,0],[-40,0]], strokeColor: P }),
        el.text({ id: "dsa-sp-lbl", x: 68, y: 85, text: "8", fontSize: 13, strokeColor: P }),
        el.line({ id: "dsa-sp-tick1", x: 55, y: 70, width: 0, height: 0, points: [[0,0],[0,14]], strokeColor: P, strokeWidth: 1 }),
        el.line({ id: "dsa-sp-tick2", x: 95, y: 70, width: 0, height: 0, points: [[0,0],[0,14]], strokeColor: P, strokeWidth: 1 }),
      ],
      svgPreview: svg(`
        <rect x="10" y="55" width="45" height="45" rx="4" fill="${PL}" stroke="${P}" stroke-width="2.5"/>
        <rect x="95" y="55" width="45" height="45" rx="4" fill="${PL}" stroke="${P}" stroke-width="2.5"/>
        <line x1="55" y1="70" x2="55" y2="84" stroke="${P}" stroke-width="1.5"/>
        <line x1="95" y1="70" x2="95" y2="84" stroke="${P}" stroke-width="1.5"/>
        <line x1="55" y1="77" x2="95" y2="77" stroke="${P}" stroke-width="2"/>
        <polygon points="58,73 55,77 58,81" fill="${P}"/>
        <polygon points="92,73 95,77 92,81" fill="${P}"/>
        <text x="75" y="73" text-anchor="middle" fill="${P}" font-family="sans-serif" font-size="12">8px</text>
      `),
    },

    // ── 7. Grid ────────────────────────────────────────────────────────────────
    {
      id: "dsa-grid",
      name: "Grid",
      elements: [
        ...[0,1,2,3].flatMap((col) =>
          [0,1,2,3].map((row) =>
            el.rect({
              id: `dsa-grid-${col}-${row}`,
              x: 8 + col * 37, y: 8 + row * 37,
              width: 33, height: 33,
              strokeColor: col === 1 && row === 1 ? P : "#cbd5e1",
              backgroundColor: col === 1 && row === 1 ? PL : "transparent",
              strokeWidth: col === 1 && row === 1 ? 2 : 1,
            }),
          ),
        ),
      ],
      svgPreview: svg(`
        ${[0,1,2,3].flatMap((c) =>
          [0,1,2,3].map((r) => {
            const isHl = c === 1 && r === 1;
            return `<rect x="${8+c*37}" y="${8+r*37}" width="33" height="33" rx="2"
              fill="${isHl ? PL : "transparent"}"
              stroke="${isHl ? P : "#cbd5e1"}"
              stroke-width="${isHl ? 2 : 1}"/>`;
          })
        ).join("")}
      `),
    },

    // ── 8. Breakpoint ──────────────────────────────────────────────────────────
    {
      id: "dsa-breakpoint",
      name: "Breakpoint",
      elements: [
        el.rect({ id: "dsa-bp-desk", x: 5, y: 25, width: 90, height: 65, strokeColor: D }),
        el.rect({ id: "dsa-bp-desk-screen", x: 9, y: 29, width: 82, height: 50, strokeColor: D, backgroundColor: TL }),
        el.rect({ id: "dsa-bp-stand", x: 35, y: 90, width: 30, height: 8, strokeColor: D, backgroundColor: "#e2e8f0" }),
        el.rect({ id: "dsa-bp-phone", x: 108, y: 20, width: 42, height: 75, strokeColor: D, rounded: true }),
        el.rect({ id: "dsa-bp-phone-screen", x: 112, y: 30, width: 34, height: 55, strokeColor: D, backgroundColor: TL }),
        el.arrow({ id: "dsa-bp-arrow", x: 97, y: 55, width: 0, height: 0, points: [[0,0],[11,0]], strokeColor: P }),
      ],
      svgPreview: svg(`
        <rect x="5" y="25" width="90" height="65" rx="3" fill="white" stroke="${D}" stroke-width="2.5"/>
        <rect x="9" y="29" width="82" height="50" rx="1" fill="${TL}"/>
        <rect x="30" y="90" width="35" height="8" rx="2" fill="#e2e8f0" stroke="${D}" stroke-width="1.5"/>
        <rect x="108" y="20" width="42" height="75" rx="6" fill="white" stroke="${D}" stroke-width="2.5"/>
        <rect x="112" y="30" width="34" height="55" rx="2" fill="${TL}"/>
        <circle cx="129" cy="88" r="3" fill="${D}" opacity="0.4"/>
        <line x1="97" y1="57" x2="108" y2="57" stroke="${P}" stroke-width="2"/>
        <polygon points="105,53 108,57 105,61" fill="${P}"/>
      `),
    },

    // ── 9. State ───────────────────────────────────────────────────────────────
    {
      id: "dsa-state",
      name: "State",
      elements: [
        el.rect({ id: "dsa-st-default", x: 10, y: 10, width: 140, height: 30, strokeColor: "#94a3b8", backgroundColor: "#f8fafc", rounded: true }),
        el.rect({ id: "dsa-st-hover",   x: 10, y: 48, width: 140, height: 30, strokeColor: P,         backgroundColor: PL,     rounded: true }),
        el.rect({ id: "dsa-st-focus",   x: 10, y: 86, width: 140, height: 30, strokeColor: T,         backgroundColor: TL,     rounded: true }),
        el.rect({ id: "dsa-st-dis",     x: 10, y: 124, width: 140, height: 30, strokeColor: "#cbd5e1", backgroundColor: "#f1f5f9", rounded: true, opacity: 50 }),
        el.text({ id: "dsa-st-lbl1", x: 48, y: 18, text: "Default", fontSize: 11, strokeColor: G }),
        el.text({ id: "dsa-st-lbl2", x: 51, y: 56, text: "Hover",   fontSize: 11, strokeColor: P }),
        el.text({ id: "dsa-st-lbl3", x: 51, y: 94, text: "Focus",   fontSize: 11, strokeColor: T }),
        el.text({ id: "dsa-st-lbl4", x: 46, y: 132, text: "Disabled", fontSize: 11, strokeColor: "#94a3b8" }),
      ],
      svgPreview: svg(`
        <rect x="10" y="10"  width="140" height="30" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
        <rect x="10" y="48"  width="140" height="30" rx="6" fill="${PL}"   stroke="${P}"    stroke-width="2"/>
        <rect x="10" y="86"  width="140" height="30" rx="6" fill="${TL}"   stroke="${T}"    stroke-width="2"/>
        <rect x="10" y="124" width="140" height="30" rx="6" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" opacity="0.5"/>
        <text x="80" y="30"  text-anchor="middle" font-family="sans-serif" font-size="11" fill="${G}">Default</text>
        <text x="80" y="68"  text-anchor="middle" font-family="sans-serif" font-size="11" fill="${P}">Hover</text>
        <text x="80" y="106" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${T}">Focus</text>
        <text x="80" y="144" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#94a3b8" opacity="0.7">Disabled</text>
      `),
    },

    // ── 10. Variant ────────────────────────────────────────────────────────────
    {
      id: "dsa-variant",
      name: "Variant",
      elements: [
        el.rect({ id: "dsa-var-base", x: 55, y: 5, width: 50, height: 30, strokeColor: D, backgroundColor: "#f8fafc", rounded: true }),
        el.text({ id: "dsa-var-base-lbl", x: 63, y: 13, text: "Base", fontSize: 11, strokeColor: D }),
        el.line({ id: "dsa-var-line1", x: 60, y: 35, width: 0, height: 0, points: [[0,0],[-30,30]], strokeColor: G }),
        el.line({ id: "dsa-var-line2", x: 80, y: 35, width: 0, height: 0, points: [[0,0],[0,30]],   strokeColor: G }),
        el.line({ id: "dsa-var-line3", x: 100,y: 35, width: 0, height: 0, points: [[0,0],[30,30]],  strokeColor: G }),
        el.rect({ id: "dsa-var-sm",   x: 10, y: 65, width: 42, height: 25, strokeColor: P, backgroundColor: PL, rounded: true }),
        el.rect({ id: "dsa-var-md",   x: 59, y: 65, width: 42, height: 25, strokeColor: T, backgroundColor: TL, rounded: true }),
        el.rect({ id: "dsa-var-lg",   x: 108,y: 65, width: 42, height: 25, strokeColor: A, backgroundColor: AL, rounded: true }),
        el.text({ id: "dsa-var-sm-lbl", x: 20, y: 73, text: "sm", fontSize: 11, strokeColor: P }),
        el.text({ id: "dsa-var-md-lbl", x: 71, y: 73, text: "md", fontSize: 11, strokeColor: T }),
        el.text({ id: "dsa-var-lg-lbl", x: 120, y: 73, text: "lg", fontSize: 11, strokeColor: "#b45309" }),
      ],
      svgPreview: svg(`
        <rect x="55" y="5" width="50" height="30" rx="6" fill="#f8fafc" stroke="${D}" stroke-width="2"/>
        <text x="80" y="25" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${D}">Base</text>
        <line x1="60" y1="35" x2="30"  y2="65" stroke="${G}" stroke-width="1.5"/>
        <line x1="80" y1="35" x2="80"  y2="65" stroke="${G}" stroke-width="1.5"/>
        <line x1="100" y1="35" x2="130" y2="65" stroke="${G}" stroke-width="1.5"/>
        <rect x="10"  y="65" width="42" height="25" rx="6" fill="${PL}"  stroke="${P}"    stroke-width="2"/>
        <rect x="59"  y="65" width="42" height="25" rx="6" fill="${TL}"  stroke="${T}"    stroke-width="2"/>
        <rect x="108" y="65" width="42" height="25" rx="6" fill="${AL}"  stroke="${A}"    stroke-width="2"/>
        <text x="31"  y="82" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${P}">sm</text>
        <text x="80"  y="82" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${T}">md</text>
        <text x="129" y="82" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#b45309">lg</text>
      `),
    },

    // ── 11. Pattern ────────────────────────────────────────────────────────────
    {
      id: "dsa-pattern",
      name: "Pattern",
      elements: [
        ...[0,1,2].flatMap((col) =>
          [0,1].map((row) =>
            el.rect({
              id: `dsa-pat-${col}-${row}`,
              x: 8 + col * 50, y: 15 + row * 65,
              width: 44, height: 50,
              strokeColor: P, backgroundColor: PL, rounded: true,
              strokeWidth: 1.5,
            }),
          ),
        ),
        el.text({ id: "dsa-pat-lbl", x: 38, y: 148, text: "pattern", fontSize: 11, strokeColor: G }),
      ],
      svgPreview: svg(`
        ${[0,1,2].flatMap((c) =>
          [0,1].map((r) =>
            `<rect x="${8+c*50}" y="${15+r*65}" width="44" height="50" rx="6"
              fill="${PL}" stroke="${P}" stroke-width="1.5"/>`
          )
        ).join("")}
        <text x="80" y="150" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${G}">×6 pattern</text>
      `),
    },

    // ── 12. Foundation ─────────────────────────────────────────────────────────
    {
      id: "dsa-foundation",
      name: "Foundation",
      elements: [
        el.rect({ id: "dsa-fn-base",  x: 5,  y: 110, width: 150, height: 30, strokeColor: D, backgroundColor: D }),
        el.rect({ id: "dsa-fn-mid",   x: 20, y: 72,  width: 120, height: 36, strokeColor: D, backgroundColor: "#334155" }),
        el.rect({ id: "dsa-fn-top",   x: 40, y: 35,  width: 80,  height: 35, strokeColor: D, backgroundColor: "#64748b" }),
        el.text({ id: "dsa-fn-lbl-b", x: 42, y: 118, text: "Primitives", fontSize: 11, strokeColor: "#fff" }),
        el.text({ id: "dsa-fn-lbl-m", x: 51, y: 82,  text: "Tokens",     fontSize: 11, strokeColor: "#fff" }),
        el.text({ id: "dsa-fn-lbl-t", x: 61, y: 45,  text: "Components", fontSize: 10, strokeColor: "#fff" }),
      ],
      svgPreview: svg(`
        <rect x="5"  y="110" width="150" height="30" rx="3" fill="${D}"/>
        <rect x="20" y="72"  width="120" height="36" rx="3" fill="#334155"/>
        <rect x="40" y="35"  width="80"  height="35" rx="3" fill="#64748b"/>
        <text x="80" y="130" text-anchor="middle" font-family="sans-serif" font-size="10" fill="white">Primitives</text>
        <text x="80" y="94"  text-anchor="middle" font-family="sans-serif" font-size="10" fill="white">Tokens</text>
        <text x="80" y="57"  text-anchor="middle" font-family="sans-serif" font-size="10" fill="white">Components</text>
      `),
    },

    // ── 13. Prop / API ─────────────────────────────────────────────────────────
    {
      id: "dsa-prop",
      name: "Prop",
      elements: [
        el.rect({ id: "dsa-prop-box", x: 25, y: 30, width: 110, height: 90, strokeColor: D, backgroundColor: "#f8fafc", rounded: true }),
        el.text({ id: "dsa-prop-t1", x: 32, y: 44,  text: "size:",    fontSize: 12, strokeColor: T }),
        el.text({ id: "dsa-prop-t2", x: 32, y: 64,  text: "variant:", fontSize: 12, strokeColor: T }),
        el.text({ id: "dsa-prop-t3", x: 32, y: 84,  text: "onClick:", fontSize: 12, strokeColor: A }),
        el.text({ id: "dsa-prop-v1", x: 92, y: 44,  text: "sm", fontSize: 12, strokeColor: P }),
        el.text({ id: "dsa-prop-v2", x: 92, y: 64,  text: "primary", fontSize: 12, strokeColor: P }),
        el.text({ id: "dsa-prop-v3", x: 92, y: 84,  text: "fn()", fontSize: 12, strokeColor: GR }),
        el.line({ id: "dsa-prop-div", x: 25, y: 103, width: 0, height: 0, points: [[0,0],[110,0]], strokeColor: "#e2e8f0", strokeWidth: 1 }),
      ],
      svgPreview: svg(`
        <rect x="25" y="30" width="110" height="90" rx="8" fill="#f8fafc" stroke="${D}" stroke-width="2"/>
        <text x="32" y="52"  font-family="monospace" font-size="12" fill="${T}">size:</text>
        <text x="32" y="70"  font-family="monospace" font-size="12" fill="${T}">variant:</text>
        <text x="32" y="88"  font-family="monospace" font-size="12" fill="${A}">onClick:</text>
        <text x="100" y="52"  font-family="monospace" font-size="12" fill="${P}">sm</text>
        <text x="95" y="70"  font-family="monospace" font-size="12" fill="${P}">primary</text>
        <text x="100" y="88"  font-family="monospace" font-size="12" fill="${GR}">fn()</text>
        <line x1="25" y1="98" x2="135" y2="98" stroke="#e2e8f0" stroke-width="1"/>
      `),
    },

    // ── 14. Slot ───────────────────────────────────────────────────────────────
    {
      id: "dsa-slot",
      name: "Slot",
      elements: [
        el.rect({ id: "dsa-slot-outer", x: 10, y: 20, width: 140, height: 100, strokeColor: P, backgroundColor: PL, rounded: true }),
        el.rect({ id: "dsa-slot-inner", x: 30, y: 45, width: 100, height: 50, strokeColor: P, backgroundColor: "transparent", strokeStyle: "dashed" }),
        el.text({ id: "dsa-slot-lbl",   x: 50, y: 63, text: "{slot}", fontSize: 14, strokeColor: P }),
      ],
      svgPreview: svg(`
        <rect x="10" y="20" width="140" height="100" rx="8" fill="${PL}" stroke="${P}" stroke-width="2.5"/>
        <rect x="30" y="45" width="100" height="50" rx="4" fill="transparent" stroke="${P}" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="80" y="76" text-anchor="middle" font-family="monospace" font-size="14" fill="${P}">{slot}</text>
      `),
    },

    // ── 15. Design System (Atom) ───────────────────────────────────────────────
    {
      id: "dsa-design-system",
      name: "Design System",
      elements: [
        el.ellipse({ id: "dsa-ds-nucleus", x: 60, y: 55, width: 40, height: 40, strokeColor: P, backgroundColor: P }),
        el.ellipse({ id: "dsa-ds-orbit1", x: 15, y: 15, width: 130, height: 130, strokeColor: P, backgroundColor: "transparent", strokeStyle: "dashed", strokeWidth: 1.5 }),
        el.ellipse({ id: "dsa-ds-orbit2", x: 15, y: 40, width: 130, height: 80, strokeColor: T, backgroundColor: "transparent", strokeStyle: "dashed", strokeWidth: 1.5 }),
        el.ellipse({ id: "dsa-ds-p1", x: 10, y: 73, width: 16, height: 16, strokeColor: P, backgroundColor: PL }),
        el.ellipse({ id: "dsa-ds-p2", x: 134, y: 73, width: 16, height: 16, strokeColor: P, backgroundColor: PL }),
        el.ellipse({ id: "dsa-ds-p3", x: 72, y: 10, width: 16, height: 16, strokeColor: P, backgroundColor: PL }),
        el.ellipse({ id: "dsa-ds-t1", x: 10, y: 56, width: 12, height: 12, strokeColor: T, backgroundColor: TL }),
        el.ellipse({ id: "dsa-ds-t2", x: 138, y: 92, width: 12, height: 12, strokeColor: T, backgroundColor: TL }),
      ],
      svgPreview: svg(`
        <ellipse cx="80" cy="80" rx="65" ry="65" fill="none" stroke="${P}" stroke-width="1.5" stroke-dasharray="6 4"/>
        <ellipse cx="80" cy="80" rx="65" ry="40" fill="none" stroke="${T}" stroke-width="1.5" stroke-dasharray="6 4"/>
        <circle cx="80" cy="80" r="20" fill="${P}"/>
        <circle cx="15"  cy="80" r="8" fill="${PL}" stroke="${P}" stroke-width="2"/>
        <circle cx="145" cy="80" r="8" fill="${PL}" stroke="${P}" stroke-width="2"/>
        <circle cx="80"  cy="15" r="8" fill="${PL}" stroke="${P}" stroke-width="2"/>
        <circle cx="17"  cy="62" r="6" fill="${TL}" stroke="${T}" stroke-width="1.5"/>
        <circle cx="143" cy="98" r="6" fill="${TL}" stroke="${T}" stroke-width="1.5"/>
      `),
    },
  ],
};

import React, { useEffect, useState } from "react";

// ─── Adjustable settings ──────────────────────────────────────────────────────
const DEFAULT_ICON_SIZE = 72; // px — height/width of each preview icon
const DEFAULT_TILE_MIN_WIDTH = 132; // px — min width of each icon tile
const DEFAULT_ACCENT = "#6965db"; // Excalidraw purple

// ─── SVG Icons — Software Architecture (colored, sketch-style) ───────────────

const MicroserviceIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Microservice"
  >
    <polygon
      points="36,6 62,21 62,51 36,66 10,51 10,21"
      fill="#ede9fe"
      stroke="#7c3aed"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <line
      x1="36"
      y1="6"
      x2="36"
      y2="66"
      stroke="#7c3aed"
      strokeWidth="1.5"
      strokeDasharray="4 3"
    />
    <line
      x1="10"
      y1="21"
      x2="62"
      y2="51"
      stroke="#7c3aed"
      strokeWidth="1.5"
      strokeDasharray="4 3"
    />
    <line
      x1="62"
      y1="21"
      x2="10"
      y2="51"
      stroke="#7c3aed"
      strokeWidth="1.5"
      strokeDasharray="4 3"
    />
    <circle cx="36" cy="36" r="8" fill="#7c3aed" opacity="0.9" />
    <circle cx="36" cy="36" r="4" fill="white" />
  </svg>
);

const DatabaseIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Database"
  >
    <ellipse
      cx="36"
      cy="18"
      rx="22"
      ry="8"
      fill="#bfdbfe"
      stroke="#2563eb"
      strokeWidth="2.5"
    />
    <path
      d="M14 18 v28 Q14 56 36 56 Q58 56 58 46 V18"
      fill="#dbeafe"
      stroke="#2563eb"
      strokeWidth="2.5"
    />
    <ellipse
      cx="36"
      cy="46"
      rx="22"
      ry="8"
      fill="#bfdbfe"
      stroke="#2563eb"
      strokeWidth="2.5"
    />
    <ellipse
      cx="36"
      cy="32"
      rx="22"
      ry="8"
      fill="none"
      stroke="#2563eb"
      strokeWidth="1.5"
      strokeDasharray="4 3"
    />
    <circle cx="27" cy="17" r="2" fill="#2563eb" opacity="0.6" />
    <circle cx="34" cy="20" r="2" fill="#2563eb" opacity="0.6" />
    <circle cx="41" cy="17" r="2" fill="#2563eb" opacity="0.6" />
  </svg>
);

const CacheIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Cache"
  >
    <rect
      x="12"
      y="10"
      width="48"
      height="14"
      rx="3"
      fill="#fee2e2"
      stroke="#dc2626"
      strokeWidth="2.5"
    />
    <rect
      x="12"
      y="29"
      width="48"
      height="14"
      rx="3"
      fill="#fca5a5"
      stroke="#dc2626"
      strokeWidth="2.5"
    />
    <rect
      x="12"
      y="48"
      width="48"
      height="14"
      rx="3"
      fill="#f87171"
      stroke="#dc2626"
      strokeWidth="2.5"
    />
    <rect
      x="17"
      y="14"
      width="8"
      height="6"
      rx="1.5"
      fill="#dc2626"
      opacity="0.4"
    />
    <rect
      x="17"
      y="33"
      width="8"
      height="6"
      rx="1.5"
      fill="#dc2626"
      opacity="0.4"
    />
    <rect
      x="17"
      y="52"
      width="8"
      height="6"
      rx="1.5"
      fill="#dc2626"
      opacity="0.4"
    />
  </svg>
);

const EventBusIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Event Bus"
  >
    <rect
      x="6"
      y="27"
      width="60"
      height="18"
      rx="9"
      fill="#d1fae5"
      stroke="#059669"
      strokeWidth="2.5"
    />
    <circle cx="20" cy="36" r="5" fill="#059669" opacity="0.7" />
    <circle cx="36" cy="36" r="5" fill="#059669" opacity="0.7" />
    <circle cx="52" cy="36" r="5" fill="#059669" opacity="0.7" />
    <line x1="25" y1="36" x2="31" y2="36" stroke="#059669" strokeWidth="2" />
    <line x1="41" y1="36" x2="47" y2="36" stroke="#059669" strokeWidth="2" />
    <path
      d="M20 20 L20 27"
      stroke="#059669"
      strokeWidth="2"
      strokeDasharray="3 2"
    />
    <path
      d="M36 20 L36 27"
      stroke="#059669"
      strokeWidth="2"
      strokeDasharray="3 2"
    />
    <path
      d="M52 20 L52 27"
      stroke="#059669"
      strokeWidth="2"
      strokeDasharray="3 2"
    />
    <path
      d="M20 45 L20 52"
      stroke="#059669"
      strokeWidth="2"
      strokeDasharray="3 2"
    />
    <path
      d="M52 45 L52 52"
      stroke="#059669"
      strokeWidth="2"
      strokeDasharray="3 2"
    />
  </svg>
);

const DocumentsIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Documents"
  >
    <rect
      x="18"
      y="18"
      width="34"
      height="42"
      rx="3"
      fill="#f1f5f9"
      stroke="#64748b"
      strokeWidth="2.5"
    />
    <rect
      x="14"
      y="14"
      width="34"
      height="42"
      rx="3"
      fill="#f8fafc"
      stroke="#64748b"
      strokeWidth="2.5"
    />
    <rect
      x="10"
      y="10"
      width="34"
      height="42"
      rx="3"
      fill="white"
      stroke="#64748b"
      strokeWidth="2.5"
    />
    <line x1="18" y1="22" x2="36" y2="22" stroke="#94a3b8" strokeWidth="2" />
    <line x1="18" y1="29" x2="36" y2="29" stroke="#94a3b8" strokeWidth="2" />
    <line x1="18" y1="36" x2="30" y2="36" stroke="#94a3b8" strokeWidth="2" />
    <path
      d="M32 44 L38 50 L44 44"
      stroke="#6965db"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const BrowserIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Browser"
  >
    <rect
      x="8"
      y="12"
      width="56"
      height="48"
      rx="6"
      fill="#eff6ff"
      stroke="#3b82f6"
      strokeWidth="2.5"
    />
    <line x1="8" y1="26" x2="64" y2="26" stroke="#3b82f6" strokeWidth="2" />
    <circle cx="17" cy="19" r="3" fill="#f87171" />
    <circle cx="26" cy="19" r="3" fill="#fbbf24" />
    <circle cx="35" cy="19" r="3" fill="#34d399" />
    <rect
      x="40"
      y="15"
      width="20"
      height="8"
      rx="4"
      fill="white"
      stroke="#93c5fd"
      strokeWidth="1.5"
    />
    <circle
      cx="36"
      cy="46"
      r="12"
      fill="none"
      stroke="#3b82f6"
      strokeWidth="2"
    />
    <ellipse
      cx="36"
      cy="46"
      rx="6"
      ry="12"
      fill="none"
      stroke="#3b82f6"
      strokeWidth="1.5"
    />
    <line x1="24" y1="46" x2="48" y2="46" stroke="#3b82f6" strokeWidth="1.5" />
    <line x1="26" y1="39" x2="46" y2="39" stroke="#3b82f6" strokeWidth="1.2" />
    <line x1="26" y1="53" x2="46" y2="53" stroke="#3b82f6" strokeWidth="1.2" />
  </svg>
);

const MobileIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Mobile Device"
  >
    <rect
      x="22"
      y="6"
      width="28"
      height="50"
      rx="6"
      fill="#f8fafc"
      stroke="#475569"
      strokeWidth="2.5"
    />
    <line x1="22" y1="18" x2="50" y2="18" stroke="#475569" strokeWidth="1.5" />
    <line x1="22" y1="52" x2="50" y2="52" stroke="#475569" strokeWidth="1.5" />
    <circle cx="36" cy="58" r="3" fill="#475569" opacity="0.5" />
    <rect
      x="27"
      y="23"
      width="18"
      height="11"
      rx="3"
      fill="#fef9c3"
      stroke="#f59e0b"
      strokeWidth="1.5"
    />
    <rect
      x="27"
      y="38"
      width="18"
      height="11"
      rx="3"
      fill="#fef9c3"
      stroke="#f59e0b"
      strokeWidth="1.5"
    />
    <line x1="30" y1="27" x2="42" y2="27" stroke="#f59e0b" strokeWidth="1.5" />
    <line x1="30" y1="30" x2="38" y2="30" stroke="#f59e0b" strokeWidth="1.2" />
    <line x1="30" y1="43" x2="42" y2="43" stroke="#f59e0b" strokeWidth="1.5" />
  </svg>
);

// ─── SVG Icons — System Design Components (black line-art) ────────────────────

const AppServerIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="App Server"
  >
    <rect
      x="10"
      y="16"
      width="52"
      height="14"
      rx="3"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <rect
      x="10"
      y="34"
      width="52"
      height="14"
      rx="3"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <circle
      cx="52"
      cy="23"
      r="3"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <circle
      cx="52"
      cy="41"
      r="3"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <line x1="17" y1="23" x2="40" y2="23" stroke="#1e293b" strokeWidth="2" />
    <line x1="17" y1="41" x2="40" y2="41" stroke="#1e293b" strokeWidth="2" />
    <line x1="36" y1="48" x2="36" y2="56" stroke="#1e293b" strokeWidth="2" />
    <line x1="26" y1="56" x2="46" y2="56" stroke="#1e293b" strokeWidth="2" />
  </svg>
);

const LoadBalancerIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Load Balancer"
  >
    <circle
      cx="36"
      cy="22"
      r="10"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <text
      x="36"
      y="27"
      textAnchor="middle"
      fontSize="11"
      fontWeight="700"
      fill="#1e293b"
      fontFamily="sans-serif"
    >
      LB
    </text>
    <circle
      cx="16"
      cy="52"
      r="8"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <circle
      cx="36"
      cy="52"
      r="8"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <circle
      cx="56"
      cy="52"
      r="8"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <line x1="29" y1="30" x2="19" y2="44" stroke="#1e293b" strokeWidth="2" />
    <line x1="36" y1="32" x2="36" y2="44" stroke="#1e293b" strokeWidth="2" />
    <line x1="43" y1="30" x2="53" y2="44" stroke="#1e293b" strokeWidth="2" />
  </svg>
);

const ApiGatewayIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="API Gateway"
  >
    <polygon
      points="36,8 60,21 60,48 36,61 12,48 12,21"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <text
      x="36"
      y="38"
      textAnchor="middle"
      fontSize="10"
      fontWeight="700"
      fill="#1e293b"
      fontFamily="sans-serif"
    >
      API
    </text>
    <line
      x1="4"
      y1="34"
      x2="12"
      y2="34"
      stroke="#1e293b"
      strokeWidth="2"
      markerEnd="url(#arr)"
    />
    <line x1="60" y1="34" x2="68" y2="34" stroke="#1e293b" strokeWidth="2" />
  </svg>
);

const DnsIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="DNS"
  >
    <circle
      cx="36"
      cy="36"
      r="26"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <ellipse
      cx="36"
      cy="36"
      rx="12"
      ry="26"
      fill="none"
      stroke="#1e293b"
      strokeWidth="1.5"
    />
    <line x1="10" y1="36" x2="62" y2="36" stroke="#1e293b" strokeWidth="1.5" />
    <line x1="13" y1="23" x2="59" y2="23" stroke="#1e293b" strokeWidth="1.2" />
    <line x1="13" y1="49" x2="59" y2="49" stroke="#1e293b" strokeWidth="1.2" />
    <text
      x="36"
      y="40"
      textAnchor="middle"
      fontSize="9"
      fontWeight="700"
      fill="#1e293b"
      fontFamily="sans-serif"
    >
      DNS
    </text>
  </svg>
);

const CdnIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="CDN"
  >
    <path
      d="M20 44 C20 36 26 30 36 30 C38 24 44 20 50 22 C56 18 64 24 62 32 C66 34 68 40 64 44 Z"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <text
      x="36"
      y="42"
      textAnchor="middle"
      fontSize="9"
      fontWeight="700"
      fill="#1e293b"
      fontFamily="sans-serif"
    >
      CDN
    </text>
    <line x1="26" y1="52" x2="20" y2="60" stroke="#1e293b" strokeWidth="2" />
    <line x1="36" y1="52" x2="36" y2="60" stroke="#1e293b" strokeWidth="2" />
    <line x1="46" y1="52" x2="52" y2="60" stroke="#1e293b" strokeWidth="2" />
  </svg>
);

const MessageQueueIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Message Queue"
  >
    <rect
      x="8"
      y="26"
      width="16"
      height="20"
      rx="2"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <rect
      x="28"
      y="26"
      width="16"
      height="20"
      rx="2"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <rect
      x="48"
      y="26"
      width="16"
      height="20"
      rx="2"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <line x1="4" y1="36" x2="8" y2="36" stroke="#1e293b" strokeWidth="2" />
    <line x1="24" y1="36" x2="28" y2="36" stroke="#1e293b" strokeWidth="2" />
    <line x1="44" y1="36" x2="48" y2="36" stroke="#1e293b" strokeWidth="2" />
    <line x1="64" y1="36" x2="68" y2="36" stroke="#1e293b" strokeWidth="2" />
    <line x1="12" y1="32" x2="20" y2="32" stroke="#1e293b" strokeWidth="1.5" />
    <line x1="12" y1="36" x2="20" y2="36" stroke="#1e293b" strokeWidth="1.5" />
    <line x1="12" y1="40" x2="20" y2="40" stroke="#1e293b" strokeWidth="1.5" />
  </svg>
);

const RelationalDbIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Relational Database"
  >
    <rect
      x="8"
      y="12"
      width="56"
      height="48"
      rx="3"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <line x1="8" y1="24" x2="64" y2="24" stroke="#1e293b" strokeWidth="2" />
    <line x1="8" y1="36" x2="64" y2="36" stroke="#1e293b" strokeWidth="2" />
    <line x1="8" y1="48" x2="64" y2="48" stroke="#1e293b" strokeWidth="2" />
    <line x1="26" y1="12" x2="26" y2="60" stroke="#1e293b" strokeWidth="2" />
    <line x1="44" y1="12" x2="44" y2="60" stroke="#1e293b" strokeWidth="2" />
  </svg>
);

const DocumentDbIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Document Database"
  >
    <path
      d="M14 12 H50 L58 22 V58 Q58 62 54 62 H14 Q10 62 10 58 V16 Q10 12 14 12Z"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <path
      d="M50 12 L50 22 L58 22"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <line x1="18" y1="32" x2="50" y2="32" stroke="#1e293b" strokeWidth="2" />
    <line x1="18" y1="40" x2="50" y2="40" stroke="#1e293b" strokeWidth="2" />
    <line x1="18" y1="48" x2="38" y2="48" stroke="#1e293b" strokeWidth="2" />
  </svg>
);

const ObjectStorageIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Object Storage"
  >
    <path
      d="M12 20 Q12 14 36 14 Q60 14 60 20 L60 54 Q60 60 36 60 Q12 60 12 54 Z"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <path
      d="M12 20 Q12 26 36 26 Q60 26 60 20"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <line x1="12" y1="37" x2="60" y2="37" stroke="#1e293b" strokeWidth="1.5" />
    <line x1="36" y1="14" x2="36" y2="60" stroke="#1e293b" strokeWidth="1.5" />
  </svg>
);

const SysCacheIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Cache"
  >
    <circle
      cx="36"
      cy="36"
      r="22"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <path
      d="M36 14 A22 22 0 0 1 58 36"
      stroke="#1e293b"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M56 28 L58 36 L50 34"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="36"
      cy="36"
      r="8"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <line
      x1="36"
      y1="28"
      x2="36"
      y2="36"
      stroke="#1e293b"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <line
      x1="36"
      y1="36"
      x2="42"
      y2="36"
      stroke="#1e293b"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const WebClientIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Web Client"
  >
    <rect
      x="8"
      y="12"
      width="56"
      height="40"
      rx="4"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <line x1="8" y1="24" x2="64" y2="24" stroke="#1e293b" strokeWidth="2" />
    <circle
      cx="17"
      cy="18"
      r="2.5"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <circle
      cx="25"
      cy="18"
      r="2.5"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <rect
      x="32"
      y="14"
      width="24"
      height="8"
      rx="4"
      fill="none"
      stroke="#1e293b"
      strokeWidth="1.5"
    />
    <line x1="28" y1="56" x2="44" y2="56" stroke="#1e293b" strokeWidth="2" />
    <line x1="36" y1="52" x2="36" y2="56" stroke="#1e293b" strokeWidth="2" />
  </svg>
);

const MobileClientIcon = () => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Mobile Client"
  >
    <rect
      x="22"
      y="8"
      width="28"
      height="50"
      rx="6"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2.5"
    />
    <line x1="22" y1="20" x2="50" y2="20" stroke="#1e293b" strokeWidth="1.5" />
    <line x1="22" y1="52" x2="50" y2="52" stroke="#1e293b" strokeWidth="1.5" />
    <circle
      cx="36"
      cy="58"
      r="2.5"
      fill="none"
      stroke="#1e293b"
      strokeWidth="2"
    />
    <line
      x1="30"
      y1="14"
      x2="42"
      y2="14"
      stroke="#1e293b"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <rect
      x="27"
      y="27"
      width="18"
      height="18"
      rx="3"
      fill="none"
      stroke="#1e293b"
      strokeWidth="1.5"
    />
  </svg>
);

// ─── Manifest types ───────────────────────────────────────────────────────────

interface ManifestItem {
  id: string;
  name: string;
  previewUrl: string;
}

interface ManifestCollection {
  id: string;
  title: string;
  description: string;
  author: string;
  authorUrl: string;
  createdAt: string;
  updatedAt: string;
  downloads: number;
  libraryUrl: string;
  items: ManifestItem[];
}

interface Manifest {
  version: 1;
  updatedAt: string;
  collections: ManifestCollection[];
}

// ─── Library data ─────────────────────────────────────────────────────────────

type LibraryItem = { name: string; icon: React.ReactNode | string };

type Library = {
  id: string;
  title: string;
  author: string;
  authorUrl: string;
  downloads: number;
  date: string;
  description: string;
  libraryUrl: string;
  itemCount: number | "all";
  items: LibraryItem[];
};

const LIBRARIES: Library[] = [
  {
    id: "software-architecture",
    title: "Software Architecture",
    author: "Youri Tjang",
    authorUrl: "https://github.com/youritjang",
    downloads: 201634,
    date: "29 Dec 2020",
    description:
      "Collection of software architecture components: microservice, database, cache, event bus or pipeline, documents or code, browser, and mobile device.",
    libraryUrl:
      "https://libraries.excalidraw.com/libraries/youri-tjang/software-architecture.excalidrawlib",
    itemCount: 7,
    items: [
      { name: "Microservice", icon: <MicroserviceIcon /> },
      { name: "Database", icon: <DatabaseIcon /> },
      { name: "Cache", icon: <CacheIcon /> },
      { name: "Event Bus", icon: <EventBusIcon /> },
      { name: "Documents", icon: <DocumentsIcon /> },
      { name: "Browser", icon: <BrowserIcon /> },
      { name: "Mobile", icon: <MobileIcon /> },
    ],
  },
  {
    id: "system-design",
    title: "System Design Components",
    author: "Rohan Pithadiya",
    authorUrl: "https://github.com/rohanpithadiya",
    downloads: 86756,
    date: "4 Oct 2021",
    description:
      "Components useful in interviews and elsewhere to build high-level system diagrams.",
    libraryUrl:
      "https://libraries.excalidraw.com/libraries/rohan-pithadiya/system-design-components.excalidrawlib",
    itemCount: "all",
    items: [
      { name: "App Server", icon: <AppServerIcon /> },
      { name: "Load Balancer", icon: <LoadBalancerIcon /> },
      { name: "API Gateway", icon: <ApiGatewayIcon /> },
      { name: "DNS", icon: <DnsIcon /> },
      { name: "CDN", icon: <CdnIcon /> },
      { name: "Message Queue", icon: <MessageQueueIcon /> },
      { name: "Relational DB", icon: <RelationalDbIcon /> },
      { name: "Document DB", icon: <DocumentDbIcon /> },
      { name: "Object Storage", icon: <ObjectStorageIcon /> },
      { name: "Cache", icon: <SysCacheIcon /> },
      { name: "Web Client", icon: <WebClientIcon /> },
      { name: "Mobile Client", icon: <MobileClientIcon /> },
    ],
  },
];

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = "downloads" | "week" | "new" | "updated" | "author" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "downloads", label: "Total downloads" },
  { key: "week", label: "This week" },
  { key: "new", label: "New" },
  { key: "updated", label: "Updated" },
  { key: "author", label: "Author" },
  { key: "name", label: "Name" },
];

// ─── Download icon ────────────────────────────────────────────────────────────

const DownloadIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M8 2v8M5 7l3 3 3-3"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="2"
      y1="13"
      x2="14"
      y2="13"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

// ─── Search icon ──────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="8.5" cy="8.5" r="5.5" stroke="#94a3b8" strokeWidth="1.8" />
    <line
      x1="13"
      y1="13"
      x2="17"
      y2="17"
      stroke="#94a3b8"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

// ─── LibraryCard component ────────────────────────────────────────────────────

const LibraryCard: React.FC<{
  lib: Library;
  iconSize: number;
  minTileWidth: number;
  accent: string;
  onAdd: (url: string) => void;
  onDownload: (url: string, title: string) => void;
}> = ({ lib, iconSize, minTileWidth, accent, onAdd, onDownload }) => {
  const [hoveredTile, setHoveredTile] = useState<number | null>(null);

  const tileStyle = (idx: number): React.CSSProperties => ({
    minWidth: minTileWidth,
    padding: "12px 8px",
    background: "white",
    border: `1.5px solid ${hoveredTile === idx ? accent : "#e8eaf0"}`,
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    cursor: "default",
    transition:
      "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
    transform: hoveredTile === idx ? "translateY(-3px)" : "translateY(0)",
    boxShadow:
      hoveredTile === idx
        ? "0 6px 18px rgba(0,0,0,0.10)"
        : "0 1px 3px rgba(0,0,0,0.04)",
  });

  const downloadsStr = lib.downloads.toLocaleString();

  return (
    <div
      style={{
        background: "white",
        border: "1.5px solid #e2e4ee",
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      {/* Preview strip */}
      <div
        style={{
          background: "#fbfbfe",
          backgroundImage:
            "radial-gradient(circle, #c8cad8 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          padding: "24px 20px",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${minTileWidth}px, 1fr))`,
            gap: 16,
          }}
        >
          {lib.items.map((item, idx) => (
            <div
              key={item.name}
              style={tileStyle(idx)}
              onMouseEnter={() => setHoveredTile(idx)}
              onMouseLeave={() => setHoveredTile(null)}
            >
              <div
                style={{
                  width: iconSize,
                  height: iconSize,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {typeof item.icon === "string" ? (
                  <img
                    src={item.icon}
                    alt={item.name}
                    width={iconSize}
                    height={iconSize}
                    style={{ objectFit: "contain" }}
                  />
                ) : (
                  item.icon
                )}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#334155",
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
              >
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Info row */}
      <div
        style={{
          padding: "24px 28px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        {/* Left: title, meta, description */}
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {lib.title}
            </h2>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: accent,
                background: `${accent}18`,
                border: `1px solid ${accent}40`,
                borderRadius: 20,
                padding: "2px 10px",
                whiteSpace: "nowrap",
              }}
            >
              {lib.itemCount === "all"
                ? "Show all items"
                : `${lib.itemCount} items`}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 13,
              color: "#64748b",
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <a
              href={lib.authorUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: accent, fontWeight: 500, textDecoration: "none" }}
            >
              @{lib.author}
            </a>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <DownloadIcon />
              {downloadsStr}
            </span>
            <span>Created {lib.date}</span>
          </div>

          <p
            style={{
              fontSize: 14,
              color: "#475569",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {lib.description}
          </p>
        </div>

        {/* Right: buttons */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <DownloadButton
            label="Download"
            accent={accent}
            onClick={() => onDownload(lib.libraryUrl, lib.title)}
            outlined
          />
          <DownloadButton
            label="+ Add to Excalidraw"
            accent={accent}
            onClick={() => onAdd(lib.libraryUrl)}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Button helper ────────────────────────────────────────────────────────────

const DownloadButton: React.FC<{
  label: string;
  accent: string;
  onClick: () => void;
  outlined?: boolean;
}> = ({ label, accent, onClick, outlined }) => {
  const [hovered, setHovered] = useState(false);

  const bg = outlined
    ? hovered
      ? `${accent}10`
      : "white"
    : hovered
    ? darkenHex(accent)
    : accent;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 44,
        paddingInline: 20,
        border: outlined ? `1.5px solid ${accent}` : "none",
        borderRadius: 10,
        background: bg,
        color: outlined ? accent : "white",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 0.15s ease",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
};

// Slightly darken a hex color for hover state
function darkenHex(hex: string): string {
  try {
    const h = hex.replace("#", "");
    const r = Math.max(0, parseInt(h.slice(0, 2), 16) - 18);
    const g = Math.max(0, parseInt(h.slice(2, 4), 16) - 18);
    const b = Math.max(0, parseInt(h.slice(4, 6), 16) - 18);
    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return hex;
  }
}

// ─── Main page component ──────────────────────────────────────────────────────

function manifestCollectionToLibrary(col: ManifestCollection): Library {
  return {
    id: col.id,
    title: col.title,
    author: col.author,
    authorUrl: col.authorUrl,
    downloads: col.downloads,
    date: col.createdAt,
    description: col.description,
    libraryUrl: col.libraryUrl,
    itemCount: col.items.length,
    items: col.items.map((item) => ({
      name: item.name,
      icon: item.previewUrl,
    })),
  };
}

export const LibrariesPage: React.FC = () => {
  const [iconSize] = useState(DEFAULT_ICON_SIZE);
  const [minTileWidth] = useState(DEFAULT_TILE_MIN_WIDTH);
  const [accent] = useState(DEFAULT_ACCENT);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("downloads");
  const [allLibraries, setAllLibraries] = useState<Library[]>(LIBRARIES);

  useEffect(() => {
    fetch("/libraries/manifest.json")
      .then((r) => r.json())
      .then((manifest: Manifest) => {
        const local = manifest.collections.map(manifestCollectionToLibrary);
        setAllLibraries([...LIBRARIES, ...local]);
      })
      .catch(() => {
        // manifest not available — keep hardcoded libraries only
      });
  }, []);

  const filtered = allLibraries.filter((lib) => {
    if (!search) {
      return true;
    }
    const q = search.toLowerCase();
    return (
      lib.title.toLowerCase().includes(q) ||
      lib.description.toLowerCase().includes(q) ||
      lib.author.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "downloads" || sort === "week") {
      return b.downloads - a.downloads;
    }
    if (sort === "name") {
      return a.title.localeCompare(b.title);
    }
    if (sort === "author") {
      return a.author.localeCompare(b.author);
    }
    return 0;
  });

  // The token and referrer were passed by LibraryMenuBrowseButton in the query string.
  // We must echo them back in the hash so App.tsx can open the library panel.
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token") ?? "";
  const referrer = urlParams.get("referrer") ?? "/";

  const handleAdd = (libraryUrl: string) => {
    const hash = `#addLibrary=${encodeURIComponent(libraryUrl)}${
      token ? `&token=${encodeURIComponent(token)}` : ""
    }`;
    window.location.href = `${referrer}${hash}`;
  };

  const handleDownload = (libraryUrl: string, title: string) => {
    const a = document.createElement("a");
    a.href = libraryUrl;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.excalidrawlib`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      style={{
        background: "#f6f7fb",
        minHeight: "100vh",
        fontFamily: "'Inter', system-ui, sans-serif",
        paddingBottom: 80,
      }}
    >
      {/* Load fonts */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Kalam:wght@700&family=Inter:wght@400;500;600;700&display=swap"
      />

      {/* Content column */}
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 20px",
        }}
      >
        {/* Header */}
        <header
          style={{
            textAlign: "center",
            paddingTop: 72,
            paddingBottom: 48,
          }}
        >
          <h1
            style={{
              fontFamily: "'Kalam', cursive",
              fontSize: "clamp(40px, 6vw, 64px)",
              fontWeight: 700,
              margin: "0 0 16px",
              color: "#0f172a",
              lineHeight: 1.15,
            }}
          >
            Excalidraw <span style={{ color: accent }}>Libraries</span>
          </h1>
          <p
            style={{
              fontSize: 19,
              color: "#475569",
              margin: "0 0 10px",
              lineHeight: 1.6,
              maxWidth: 640,
              marginInline: "auto",
            }}
          >
            A directory of public libraries you can add to{" "}
            <a
              href="/"
              style={{ color: accent, textDecoration: "none", fontWeight: 500 }}
            >
              Excalidraw
            </a>{" "}
            in one click. Want to share yours?{" "}
            <a
              href="https://github.com/excalidraw/excalidraw-libraries#how-to-add-a-library"
              target="_blank"
              rel="noreferrer"
              style={{ color: accent, textDecoration: "none", fontWeight: 500 }}
            >
              Follow the instructions.
            </a>
          </p>
          <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>
            All libraries are under the MIT License.
          </p>
        </header>

        {/* Toolbar */}
        <div
          style={{
            background: "white",
            border: "1px solid #e8eaf0",
            borderRadius: 16,
            padding: "14px 20px",
            marginBottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {/* Search */}
          <div
            style={{
              flex: "1 1 280px",
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                lineHeight: 0,
              }}
            >
              <SearchIcon />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search libraries, e.g. database, AWS, flowchart…"
              style={{
                width: "100%",
                height: 48,
                paddingLeft: 44,
                paddingRight: 16,
                border: "1.5px solid #e2e4ee",
                borderRadius: 10,
                fontSize: 15,
                color: "#0f172a",
                background: "#f8f9fc",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Sort pills */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              flexShrink: 0,
            }}
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSort(opt.key)}
                  style={{
                    height: 44,
                    paddingInline: 16,
                    border: active ? "none" : "1.5px solid #e2e4ee",
                    borderRadius: 100,
                    background: active ? accent : "white",
                    color: active ? "white" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Result count */}
        {search && (
          <p
            style={{
              fontSize: 13,
              color: "#94a3b8",
              marginBottom: 24,
              marginTop: -16,
            }}
          >
            {sorted.length === 0
              ? "No libraries matched your search."
              : `${sorted.length} librar${
                  sorted.length === 1 ? "y" : "ies"
                } found`}
          </p>
        )}

        {/* Library cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 40,
          }}
        >
          {sorted.map((lib) => (
            <LibraryCard
              key={lib.id}
              lib={lib}
              iconSize={iconSize}
              minTileWidth={minTileWidth}
              accent={accent}
              onAdd={handleAdd}
              onDownload={handleDownload}
            />
          ))}
        </div>

        {/* Footer */}
        <footer
          style={{
            marginTop: 72,
            textAlign: "center",
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          <p>
            Missing a library?{" "}
            <a
              href="https://github.com/excalidraw/excalidraw-libraries"
              target="_blank"
              rel="noreferrer"
              style={{ color: accent, textDecoration: "none" }}
            >
              Contribute on GitHub
            </a>
          </p>
          <p style={{ marginTop: 8 }}>
            <a href="/" style={{ color: "#94a3b8", textDecoration: "none" }}>
              ← Back to Excalidraw
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default LibrariesPage;

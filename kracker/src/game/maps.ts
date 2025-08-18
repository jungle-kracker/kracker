import { Platform } from "./config";

export interface MapImage {
  key: string; // Phaser texture key (미리 preload)
  x: number;
  y: number;
  width: number;
  height: number;
  scrollFactor?: number; // 0이면 하늘처럼 고정, 1이면 맵과 함께
}

export interface MapData {
  meta: { key: string; name?: string; width: number; height: number };
  background?: {
    type: "solid" | "gradient";
    color?: string;
    gradient?: { top: string; bottom: string };
  };
  images?: MapImage[];
  platforms: Platform[]; // 충돌용 포함(바닥/벽)
}

export async function loadMapData(key: string): Promise<MapData> {
  const res = await fetch(`/maps/${key}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Map load failed: ${key}`);
  const data = (await res.json()) as MapData;
  return data;
}

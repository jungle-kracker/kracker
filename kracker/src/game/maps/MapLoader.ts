// src/game/maps/MapLoader.ts
import { Platform } from "../config";

export interface MapImage {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scrollFactor?: number;
}

export interface MapBackground {
  type: "solid" | "gradient" | "image" | "image+gradient"; // ⭐ "image+gradient" 타입 추가
  color?: string;
  gradient?: {
    top: string;
    bottom: string;
    direction?: "vertical" | "horizontal" | "diagonal";
  };
  image?: string;
  parallax?: number;
}

export interface MapData {
  meta: {
    key: string;
    name: string;
    width: number;
    height: number;
  };
  background?: MapBackground;
  images?: MapImage[];
  platforms: Platform[];
  spawns?: Array<{
    id?: number;
    name: string;
    x: number;
    y: number;
  }>;
}

export class MapLoader {
  private static presets: Map<string, MapData> = new Map();

  // JSON 파일 직접 로드 (이미 MapData 형식)
  static async loadTiledPreset(mapKey: string): Promise<MapData> {
    // 여러 경로 시도
    const possiblePaths = [
      `${process.env.PUBLIC_URL}/maps/${mapKey}.json`,
      `/maps/${mapKey}.json`,
      `./maps/${mapKey}.json`,
      `${window.location.origin}/maps/${mapKey}.json`,
    ];

    console.log("🔍 Trying to load map:", mapKey);
    console.log("📂 Possible paths:", possiblePaths);

    for (const path of possiblePaths) {
      try {
        console.log("🌐 Attempting fetch:", path);
        const response = await fetch(path, {
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        console.log(
          "📡 Response:",
          response.status,
          response.statusText,
          "from",
          path
        );

        if (!response.ok) {
          console.warn(`❌ Failed: ${path} - ${response.status}`);
          continue;
        }

        const text = await response.text();
        console.log("📄 Response length:", text.length, "chars");
        console.log("📄 First 200 chars:", text.substring(0, 200));

        let rawData: any;
        try {
          rawData = JSON.parse(text);
          console.log("✅ JSON parsed successfully from:", path);
          console.log("🔍 Raw data structure:", Object.keys(rawData));
        } catch (parseError) {
          console.error("❌ JSON parse error:", parseError);
          continue;
        }

        // 실제 구조에 맞게 MapData 변환
        let mapData: MapData;

        // meta 필드가 있는지 확인
        if (rawData.meta) {
          // 이미 올바른 구조
          mapData = rawData as MapData;
        } else {
          // 당신의 JSON 구조에 맞게 변환
          mapData = {
            meta: {
              key: mapKey,
              name: rawData.name || mapKey,
              width: rawData.width || 1200,
              height: rawData.height || 600,
            },
            background: rawData.background,
            images: rawData.images,
            platforms: rawData.platforms || [],
            spawns: rawData.spawns,
          };
          console.log("🔄 Converted structure to MapData format");
        }

        // 기본값 설정
        if (!mapData.spawns) {
          mapData.spawns = [
            { name: "A", x: 100, y: 100 },
            { name: "B", x: mapData.meta.width - 100, y: 100 },
          ];
        }

        // ⭐ 배경 타입 검증 및 로그
        if (mapData.background) {
          console.log("🎨 Background config:", {
            type: mapData.background.type,
            hasImage: !!mapData.background.image,
            hasGradient: !!mapData.background.gradient,
            parallax: mapData.background.parallax,
          });
        }

        // 프리셋으로 등록
        this.presets.set(mapKey, mapData);
        console.log("🎉 Map loaded successfully:", mapKey, "from", path);
        console.log("📊 Final map info:");
        console.log("  - Name:", mapData.meta.name);
        console.log(
          "  - Size:",
          mapData.meta.width + "x" + mapData.meta.height
        );
        console.log("  - Platforms:", mapData.platforms.length);
        console.log("  - Images:", mapData.images?.length || 0);
        console.log("  - Spawns:", mapData.spawns.length);

        return mapData;
      } catch (error) {
        console.warn(`❌ Error with ${path}:`, error);
      }
    }

    throw new Error(
      `Failed to load ${mapKey}.json from any path. Check console for details.`
    );
  }

  // 프리셋 맵 가져오기
  static getPreset(key: string): MapData | null {
    return this.presets.get(key) || null;
  }

  // level1.json만 로드 (실패시 에러)
  static async initializeDefaultMaps() {
    try {
      await this.loadTiledPreset("level1");
      console.log("✅ level1.json loaded successfully");
    } catch (error) {
      console.error("❌ Failed to load level1.json:", error);
      console.error("Make sure public/maps/level1.json exists!");
      throw new Error("level1.json is required but not found");
    }
  }
}

// 초기화 함수
export async function initializeMaps() {
  await MapLoader.initializeDefaultMaps();
}

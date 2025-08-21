// 증강 데이터 정의(JSON) + 이미지 매핑
import raw from "./augments.json";

export interface AugmentInfo {
  id: string; // 고유ID(파일명 기반)
  name: string; // 표시 이름(카드명)
  description: string; // 효과 설명(간단 요약)
  image: string; // 카드 이미지 경로
}

// 이미지 로더: 폴더 내 svg를 동적으로 로드하여 파일명 -> URL 매핑 생성
// CRA(Webpack) 환경에서 require.context 사용
const imageMap: Record<string, string> = (() => {
  try {
    const req = (require as any).context("../assets/cards", false, /\.svg$/);
    const map: Record<string, string> = {};
    req.keys().forEach((key: string) => {
      const fileName = key.replace(/^\.\//, "");
      const mod = req(key);
      const url: string = (mod && (mod.default || mod)) as string;
      map[fileName] = url;
    });
    return map;
  } catch (e) {
    // Fallback: 빈 맵
    return {} as Record<string, string>;
  }
})();

const jsonData: Array<{
  id: string;
  name: string;
  description: string;
  imageFile: string;
}> = raw as any;

export const AUGMENTS: AugmentInfo[] = jsonData.map((a) => ({
  id: a.id,
  name: a.name,
  description: a.description,
  image: imageMap[a.imageFile] as string,
}));

export function getRandomAugments(count: number): AugmentInfo[] {
  const pool = [...AUGMENTS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
}

// ===== 증강 효과 집계/도우미 (중앙 집중) =====

export type AugmentSnapshot = Record<string, { id: string; startedAt: number }>;

export interface AggregatedAugments {
  weapon: {
    reloadTimeDeltaMs: number;
    magazineDelta: number;
    fireIntervalAddMs: number;
  };
  bullet: {
    speedMul: number;
    damageMul: number;
    damageAdd: number;
    sizeMul: number;
    homingStrength: number;
    bounceCount: number;
    pierceCount: number;
    explodeRadius: number;
    slowOnHitMs: number;
    slowMul: number;
    stunMs: number;
    knockbackMul: number;
    gravityResistance: number;
    color?: string;
    parasiteDps: number;
    parasiteTicks: number;
  };
  player: {
    jumpHeightMul: number;
    extraJumps: number;
    gravityMul: number;
    moveSpeedMul: number;
    maxHealthDelta: number;
    lifestealOnHit: number;
    blink: boolean;
  };
}

export type AugmentJsonEffect = {
  id: string;
  name: string;
  description: string;
  imageFile: string;
  effects?: {
    weapon?: Partial<AggregatedAugments["weapon"]> & {
      reloadTimeDeltaMs?: number;
      magazineDelta?: number;
      fireIntervalAddMs?: number;
    };
    bullet?: Partial<AggregatedAugments["bullet"]>;
    player?: Partial<AggregatedAugments["player"]>;
  };
};

export const AUGMENT_JSON: AugmentJsonEffect[] = raw as any;

export function aggregateAugments(
  snapshot?: AugmentSnapshot | null
): AggregatedAugments {
  const base: AggregatedAugments = {
    weapon: { reloadTimeDeltaMs: 0, magazineDelta: 0, fireIntervalAddMs: 0 },
    bullet: {
      speedMul: 1,
      damageMul: 1,
      damageAdd: 0,
      sizeMul: 1,
      homingStrength: 0,
      bounceCount: 0,
      pierceCount: 0,
      explodeRadius: 0,
      slowOnHitMs: 0,
      slowMul: 1,
      stunMs: 0,
      knockbackMul: 1,
      gravityResistance: 0,
      color: undefined,
      parasiteDps: 0,
      parasiteTicks: 0,
    },
    player: {
      jumpHeightMul: 1,
      extraJumps: 0,
      gravityMul: 1,
      moveSpeedMul: 1,
      maxHealthDelta: 0,
      lifestealOnHit: 0,
      blink: false,
    },
  };

  if (!snapshot) return base;

  const byId = new Map<string, AugmentJsonEffect>();
  for (let i = 0; i < AUGMENT_JSON.length; i++)
    byId.set(AUGMENT_JSON[i].id, AUGMENT_JSON[i]);

  const keys = Object.keys(snapshot);
  for (let i = 0; i < keys.length; i++) {
    const id = keys[i];
    const def = byId.get(id);
    if (!def?.effects) continue;
    // 실행 로그: 어떤 증강이 집계에 반영되는지
    try {
      console.log(`🧩 증강 집계: ${def.name}(${def.id}) 적용`);
    } catch {}
    const e = def.effects;
    if (e.weapon) {
      if (
        typeof e.weapon.magazineDelta === "number" &&
        e.weapon.magazineDelta !== 0
      ) {
        try {
          console.log(
            `🔧 무기-탄창(총 탄창 수량) 변화: ${e.weapon.magazineDelta}`
          );
        } catch {}
      }
      if (typeof e.weapon.reloadTimeDeltaMs === "number")
        base.weapon.reloadTimeDeltaMs += e.weapon.reloadTimeDeltaMs;
      if (typeof e.weapon.magazineDelta === "number")
        base.weapon.magazineDelta += e.weapon.magazineDelta;
      if (typeof e.weapon.fireIntervalAddMs === "number")
        base.weapon.fireIntervalAddMs += e.weapon.fireIntervalAddMs;
    }
    if (e.bullet) {
      if (typeof e.bullet.speedMul === "number")
        base.bullet.speedMul *= e.bullet.speedMul;
      if (typeof e.bullet.damageMul === "number")
        base.bullet.damageMul *= e.bullet.damageMul;
      if (typeof e.bullet.damageAdd === "number")
        base.bullet.damageAdd += e.bullet.damageAdd;
      if (typeof e.bullet.sizeMul === "number")
        base.bullet.sizeMul *= e.bullet.sizeMul;
      if (typeof e.bullet.homingStrength === "number")
        base.bullet.homingStrength = Math.max(
          base.bullet.homingStrength,
          e.bullet.homingStrength
        );
      if (typeof e.bullet.bounceCount === "number")
        base.bullet.bounceCount += e.bullet.bounceCount;
      if (typeof e.bullet.pierceCount === "number")
        base.bullet.pierceCount += e.bullet.pierceCount;
      if (typeof e.bullet.explodeRadius === "number")
        base.bullet.explodeRadius = Math.max(
          base.bullet.explodeRadius,
          e.bullet.explodeRadius
        );
      if (typeof e.bullet.slowOnHitMs === "number")
        base.bullet.slowOnHitMs = Math.max(
          base.bullet.slowOnHitMs,
          e.bullet.slowOnHitMs
        );
      if (typeof e.bullet.slowMul === "number")
        base.bullet.slowMul = Math.min(base.bullet.slowMul, e.bullet.slowMul);
      if (typeof e.bullet.stunMs === "number")
        base.bullet.stunMs = Math.max(base.bullet.stunMs, e.bullet.stunMs);
      if (typeof e.bullet.knockbackMul === "number")
        base.bullet.knockbackMul *= e.bullet.knockbackMul;
      if (typeof e.bullet.gravityResistance === "number")
        base.bullet.gravityResistance = Math.max(
          base.bullet.gravityResistance,
          e.bullet.gravityResistance
        );
      if (typeof e.bullet.color === "string")
        base.bullet.color = e.bullet.color;
      if (typeof e.bullet.parasiteDps === "number")
        base.bullet.parasiteDps = Math.max(
          base.bullet.parasiteDps,
          e.bullet.parasiteDps
        );
      if (typeof e.bullet.parasiteTicks === "number")
        base.bullet.parasiteTicks = Math.max(
          base.bullet.parasiteTicks,
          e.bullet.parasiteTicks
        );
    }
    if (e.player) {
      if (typeof e.player.jumpHeightMul === "number")
        base.player.jumpHeightMul *= e.player.jumpHeightMul;
      if (typeof e.player.extraJumps === "number")
        base.player.extraJumps += e.player.extraJumps;
      if (typeof e.player.gravityMul === "number")
        base.player.gravityMul *= e.player.gravityMul;
      if (typeof e.player.moveSpeedMul === "number") {
        base.player.moveSpeedMul *= e.player.moveSpeedMul;
        try {
          console.log(
            `🏃‍♂️ 이동속도 증강 적용: ${def.name} -> 배율 ${e.player.moveSpeedMul}, 최종 배율: ${base.player.moveSpeedMul}`
          );
        } catch {}
      }
      if (typeof e.player.maxHealthDelta === "number")
        base.player.maxHealthDelta += e.player.maxHealthDelta;
      if (typeof e.player.lifestealOnHit === "number")
        base.player.lifestealOnHit += e.player.lifestealOnHit;
      if (typeof e.player.blink === "boolean")
        base.player.blink = base.player.blink || e.player.blink;
    }
  }
  return base;
}

// ===== 중앙화된 조회/헬퍼 =====

export function getAugmentDefById(id: string): AugmentJsonEffect | undefined {
  for (let i = 0; i < AUGMENT_JSON.length; i++)
    if (AUGMENT_JSON[i].id === id) return AUGMENT_JSON[i];
  return undefined;
}

export function getActiveAugmentNames(
  snapshot?: AugmentSnapshot | null
): string[] {
  if (!snapshot) return [];
  const ids = Object.keys(snapshot);
  const names: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const def = getAugmentDefById(ids[i]);
    if (def?.name) names.push(def.name);
  }
  return names;
}

export function findAugmentNamesWithEffect(
  snapshot: AugmentSnapshot | null | undefined,
  predicate: (def: AugmentJsonEffect) => boolean
): string[] {
  if (!snapshot) return [];
  const ids = Object.keys(snapshot);
  const names: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const def = getAugmentDefById(ids[i]);
    if (def && predicate(def)) names.push(def.name || def.id);
  }
  return names;
}

export function getAugmentsForPlayer(
  augmentByPlayer:
    | Map<string, AugmentSnapshot>
    | Record<string, AugmentSnapshot>
    | undefined,
  playerId: string | null | undefined
): AggregatedAugments | null {
  if (!augmentByPlayer || !playerId) return null;
  let snap: AugmentSnapshot | undefined;
  if (typeof (augmentByPlayer as any).get === "function") {
    snap = (augmentByPlayer as Map<string, AugmentSnapshot>).get(playerId);
  } else {
    snap = (augmentByPlayer as Record<string, AugmentSnapshot>)[playerId];
  }
  return aggregateAugments(snap || {});
}

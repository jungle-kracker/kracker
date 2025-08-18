// src/game/combat/shooting.ts - 충돌 시스템과 통합
import { Platform } from "../types/player.types";
import { Bullet } from "../bullet";

// ⭐ CollisionSystem을 별도 파일에서 import
export type { CollisionSystem } from "../systems/CollisionSystem";

/**
 * 현재 시간이 쿨다운을 지났는지 확인
 */
export function canShoot(
  lastShotTime: number,
  cooldownMs: number,
  now: number = Date.now()
): boolean {
  return now - lastShotTime >= cooldownMs;
}

/**
 * 한 발 사격을 수행한다.
 * - 총알 생성 및 발사
 * - 충돌 시스템에 자동 등록
 * - lastShotTime 갱신
 * - 연출용 recoil/wobble 증분 반환
 *
 * 사용 예:
 *   if (canShoot(lastShotTime, cooldown)) {
 *     const shot = doShoot({ ... });
 *     lastShotTime = shot.lastShotTime;
 *     shootRecoil += shot.recoilAdd;
 *     wobble += shot.wobbleAdd;
 *     // bullets 배열 관리는 CollisionSystem이 자동 처리
 *   }
 */
export function doShoot(opts: {
  scene: any;
  gunX: number;
  gunY: number;
  targetX: number;
  targetY: number;
  platforms: Platform[]; // 하위 호환성을 위해 유지 (실제로는 CollisionSystem 사용)
  speed?: number; // 기본 900
  cooldownMs: number; // shootCooldown
  lastShotTime: number;
  recoilBase?: number; // 기본 1.5
  wobbleBase?: number; // 기본 0.3
  collisionSystem?: any; // ⭐ CollisionSystem 타입을 any로 임시 변경
  bulletGroup?: Phaser.Physics.Arcade.Group; // ⭐ 총알 그룹 (옵션)
}): {
  bullet: Bullet;
  lastShotTime: number;
  recoilAdd: number;
  wobbleAdd: number;
} {
  const {
    scene,
    gunX,
    gunY,
    targetX,
    targetY,
    platforms, // 레거시 호환성용
    speed = 900,
    cooldownMs,
    lastShotTime,
    recoilBase = 1.5,
    wobbleBase = 0.3,
    collisionSystem,
    bulletGroup,
  } = opts;

  // ⭐ 총알 생성 (그룹 참조 포함)
  const bullet = new Bullet(
    scene,
    gunX,
    gunY,
    undefined,
    {
      speed: 1200,

      // 히트박스(충돌) 반지름
      bodyRadius: 16,

      // 꼬리(그라디언트 이미지)
      tailEnabled: true,
      visualScale: 1.4, // 꼬리 두께 배율

      // 몸통(원)
      bodyEnabled: true,
      bodyVisualScale: 0.28, // 원 반지름 = bodyRadius * 1.2
      bodyColor: 0xffcc00,
    },
    bulletGroup
  );

  // Phaser의 Vector2 사용
  const fromVec = new Phaser.Math.Vector2(gunX, gunY);
  const toVec = new Phaser.Math.Vector2(targetX, targetY);

  bullet.fire(fromVec, toVec, speed);

  // ⭐ 충돌 시스템에 총알 등록
  if (collisionSystem) {
    collisionSystem.addBullet(bullet);
  } else if (bulletGroup) {
    // 충돌 시스템이 없으면 최소한 그룹에라도 추가
    bulletGroup.add(bullet.sprite);
    bullet.sprite.setData("bullet", bullet);
    console.warn(
      "⚠️ CollisionSystem not provided, adding bullet to group only"
    );
  } else {
    console.warn(
      "⚠️ No collision system or bullet group provided - bullet won't collide with platforms"
    );
  }

  const now = Date.now();

  // ⭐ 실제 lastShotTime 업데이트는 여기서 수행
  const actualLastShotTime = now;

  // 디버그 로그
  const angleDeg = Phaser.Math.RadToDeg(
    Math.atan2(targetY - gunY, targetX - gunX)
  );
  console.log(
    `🔫 Shot fired: (${gunX.toFixed(1)}, ${gunY.toFixed(
      1
    )}) → (${targetX.toFixed(1)}, ${targetY.toFixed(
      1
    )}), angle=${angleDeg.toFixed(1)}°`
  );

  return {
    bullet,
    lastShotTime: actualLastShotTime, // ⭐ 실제 업데이트된 시간 사용
    recoilAdd: recoilBase,
    wobbleAdd: wobbleBase,
  };
}

/**
 * ⭐ 새로운 편의 함수: 충돌 시스템과 함께 총알 발사
 * 기존 doShoot의 래퍼로, 충돌 시스템 사용을 강제
 */
export function shootWithCollision(opts: {
  scene: any;
  gunX: number;
  gunY: number;
  targetX: number;
  targetY: number;
  speed?: number;
  cooldownMs: number;
  lastShotTime: number;
  recoilBase?: number;
  wobbleBase?: number;
  collisionSystem: any; // ⭐ CollisionSystem 타입을 any로 임시 변경
}): {
  bullet: Bullet;
  lastShotTime: number;
  recoilAdd: number;
  wobbleAdd: number;
} {
  return doShoot({
    ...opts,
    platforms: [], // 더미값 (사용하지 않음)
  });
}

/**
 * ⭐ 총알 발사 가능 여부 + 발사를 한번에 처리하는 헬퍼
 */
export function tryShoot(opts: {
  scene: any;
  gunX: number;
  gunY: number;
  targetX: number;
  targetY: number;
  speed?: number;
  cooldownMs: number;
  lastShotTime: number;
  recoilBase?: number;
  wobbleBase?: number;
  collisionSystem: any; // ⭐ CollisionSystem 타입을 any로 임시 변경
}): {
  success: boolean;
  bullet?: Bullet;
  lastShotTime: number;
  recoilAdd: number;
  wobbleAdd: number;
} {
  const { lastShotTime, cooldownMs } = opts;

  if (!canShoot(lastShotTime, cooldownMs)) {
    return {
      success: false,
      lastShotTime,
      recoilAdd: 0,
      wobbleAdd: 0,
    };
  }

  const result = shootWithCollision(opts);

  return {
    success: true,
    ...result,
  };
}

/**
 * ⭐ 연사 모드용 헬퍼
 */
export function rapidFire(opts: {
  scene: any;
  gunX: number;
  gunY: number;
  targetX: number;
  targetY: number;
  speed?: number;
  shotsPerSecond: number; // 초당 발사 수
  lastShotTime: number;
  collisionSystem: any; // ⭐ CollisionSystem 타입을 any로 임시 변경
  maxShots?: number; // 최대 발사 수 (기본값: 무제한)
}): {
  shotsFired: number;
  bullets: Bullet[];
  lastShotTime: number;
  totalRecoil: number;
  totalWobble: number;
} {
  const { shotsPerSecond, maxShots = Infinity, ...baseOpts } = opts;

  const cooldownMs = 1000 / shotsPerSecond;
  const bullets: Bullet[] = [];
  let shotsFired = 0;
  let currentLastShotTime = opts.lastShotTime;
  let totalRecoil = 0;
  let totalWobble = 0;

  // 현재 시간까지 발사 가능한 총알 수 계산
  const now = Date.now();
  const timeSinceLastShot = now - currentLastShotTime;
  const possibleShots = Math.min(
    Math.floor(timeSinceLastShot / cooldownMs),
    maxShots
  );

  for (let i = 0; i < possibleShots; i++) {
    const shot = doShoot({
      ...baseOpts,
      platforms: [], // 더미값
      cooldownMs,
      lastShotTime: currentLastShotTime,
    });

    bullets.push(shot.bullet);
    currentLastShotTime = shot.lastShotTime;
    totalRecoil += shot.recoilAdd;
    totalWobble += shot.wobbleAdd;
    shotsFired++;
  }

  if (shotsFired > 0) {
    console.log(`🔥 Rapid fire: ${shotsFired} shots in burst`);
  }

  return {
    shotsFired,
    bullets,
    lastShotTime: currentLastShotTime,
    totalRecoil,
    totalWobble,
  };
}

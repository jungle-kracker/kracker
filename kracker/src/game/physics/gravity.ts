// src/game/physics/gravity.ts

/**
 * 중력을 적용해 vy를 갱신한다.
 * @param vy        현재 수직 속도
 * @param dtSec     델타타임(초)
 * @param g         중력 가속도 (예: GAME_CONFIG.gravity)
 * @param maxFall   최대 낙하 속도 클램프 (기본 600)
 * @param active    중력 활성 여부 (벽잡기 등에서 false로 두면 적용 안 함)
 */
export function applyGravity(
  vy: number,
  dtSec: number,
  g: number,
  maxFall = 600,
  active = true
): number {
  if (!active) return vy;
  vy += g * dtSec;
  if (vy > maxFall) vy = maxFall;
  return vy;
}

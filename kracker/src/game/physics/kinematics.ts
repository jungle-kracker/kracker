// src/game/physics/kinematics.ts

/**
 * 속도를 적분해 위치를 반환한다.
 */
export function integrate(
  x: number,
  y: number,
  vx: number,
  vy: number,
  dtSec: number
): { x: number; y: number } {
  return { x: x + vx * dtSec, y: y + vy * dtSec };
}

/**
 * 감쇠(dampen) 유틸: 마찰처럼 속도를 줄인다.
 * @param val     현재 속도
 * @param factor  감쇠 계수 (기본 0.8)
 * @param eps     절대값이 eps 미만이면 0으로 스냅
 */
export function dampen(val: number, factor = 0.8, eps = 10): number {
  val *= factor;
  if (Math.abs(val) < eps) val = 0;
  return val;
}

// src/game/physics/collisions.ts
import { Platform } from "../types/player.types";

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ResolveResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isGrounded: boolean;
  hitTop: boolean;
  hitBottom: boolean;
  hitLeft: boolean;
  hitRight: boolean;
}

/**
 * 플레이어 바운딩 박스 계산
 */
export function computePlayerBounds(
  x: number,
  y: number,
  crouchHeight: number
): Bounds {
  const RADIUS = 25;
  const heightReduction = crouchHeight * 20;
  const crouchYOffset = crouchHeight * 15;

  return {
    left: x - RADIUS,
    right: x + RADIUS,
    top: y - RADIUS + crouchYOffset,
    bottom: y + RADIUS - heightReduction + crouchYOffset,
  };
}

/**
 * 플랫폼과의 겹침 체크
 */
export function checkOverlap(
  playerBounds: Bounds,
  platform: Platform
): boolean {
  const platBounds = {
    left: platform.x,
    right: platform.x + platform.width,
    top: platform.y,
    bottom: platform.y + platform.height,
  };

  return (
    playerBounds.right > platBounds.left &&
    playerBounds.left < platBounds.right &&
    playerBounds.bottom > platBounds.top &&
    playerBounds.top < platBounds.bottom
  );
}

/**
 * 충돌 방향 결정 - 더 안정적인 방법
 */
function determineCollisionDirection(
  playerBounds: Bounds,
  platform: Platform,
  vx: number,
  vy: number
): "top" | "bottom" | "left" | "right" | null {
  const platBounds = {
    left: platform.x,
    right: platform.x + platform.width,
    top: platform.y,
    bottom: platform.y + platform.height,
  };

  // 겹친 영역의 크기 계산
  const overlapLeft = playerBounds.right - platBounds.left;
  const overlapRight = platBounds.right - playerBounds.left;
  const overlapTop = playerBounds.bottom - platBounds.top;
  const overlapBottom = platBounds.bottom - playerBounds.top;

  // 가장 작은 겹침을 찾아서 충돌 방향 결정
  const minOverlap = Math.min(
    overlapLeft,
    overlapRight,
    overlapTop,
    overlapBottom
  );

  // 속도 방향도 고려하여 더 정확한 판정
  if (minOverlap === overlapTop && vy > 0) {
    return "top"; // 플레이어가 아래로 떨어져서 플랫폼 위에 착지
  } else if (minOverlap === overlapBottom && vy < 0) {
    return "bottom"; // 플레이어가 위로 올라가서 플랫폼 아래에 부딪힘
  } else if (minOverlap === overlapLeft && vx > 0) {
    return "left"; // 플레이어가 오른쪽으로 가서 플랫폼 왼쪽에 부딪힘
  } else if (minOverlap === overlapRight && vx < 0) {
    return "right"; // 플레이어가 왼쪽으로 가서 플랫폼 오른쪽에 부딪힘
  }

  // 속도가 거의 0이거나 애매한 경우, 가장 작은 겹침으로 결정
  if (minOverlap === overlapTop) return "top";
  if (minOverlap === overlapBottom) return "bottom";
  if (minOverlap === overlapLeft) return "left";
  if (minOverlap === overlapRight) return "right";

  return null;
}

/**
 * 안정화된 충돌 해결 시스템
 */
export function resolveCollisions(
  x: number,
  y: number,
  vx: number,
  vy: number,
  platforms: Platform[],
  crouchHeight: number,
  dtSec = 1 / 60
): ResolveResult {
  const RADIUS = 25;
  const heightReduction = crouchHeight * 20;
  const crouchYOffset = crouchHeight * 15;

  let newX = x;
  let newY = y;
  let newVx = vx;
  let newVy = vy;

  let isGrounded = false;
  let hitTop = false;
  let hitBottom = false;
  let hitLeft = false;
  let hitRight = false;

  // 현재 위치에서의 바운딩 박스
  let playerBounds = computePlayerBounds(newX, newY, crouchHeight);

  // 🔧 착지 안정성을 위한 추가 체크
  const GROUND_TOLERANCE = 3; // 착지 허용 오차
  const CROUCH_GROUND_TOLERANCE = 5; // 앉기 상태에서 더 큰 허용 오차

  for (const platform of platforms) {
    // 겹침 체크
    if (!checkOverlap(playerBounds, platform)) {
      continue;
    }

    // 충돌 방향 결정
    const collisionDirection = determineCollisionDirection(
      playerBounds,
      platform,
      newVx,
      newVy
    );

    if (!collisionDirection) continue;

    switch (collisionDirection) {
      case "top":
        // 📍 착지 처리 - 간단하고 정확하게
        const targetY = platform.y - RADIUS + heightReduction;

        // 앉기 상태에서는 더 큰 허용 오차 사용
        const tolerance =
          crouchHeight > 0.1 ? CROUCH_GROUND_TOLERANCE : GROUND_TOLERANCE;

        // 🔧 미세한 오차 보정
        if (Math.abs(newY - targetY) <= tolerance || newVy > 0) {
          newY = targetY;
          newVy = 0;
          isGrounded = true;
          hitBottom = true;

          // 🔍 디버깅: 착지 처리
          //   if (Math.abs(newY - targetY) > 1) {
          //     console.log(
          //       `🛬 Landing: Y ${newY.toFixed(1)} → ${targetY.toFixed(
          //         1
          //       )} (platform: ${platform.y})`
          //     );
          //   }
        }
        break;

      case "bottom":
        // 천장 부딪힘
        newY = platform.y + platform.height + RADIUS - crouchYOffset;
        newVy = Math.max(0, newVy); // 아래 방향 속도만 유지
        hitTop = true;
        break;

      case "left":
        // 왼쪽 벽 부딪힘
        newX = platform.x - RADIUS;
        newVx = Math.max(0, newVx); // 오른쪽 방향 속도만 유지
        hitRight = true;
        break;

      case "right":
        // 오른쪽 벽 부딪힘
        newX = platform.x + platform.width + RADIUS;
        newVx = Math.min(0, newVx); // 왼쪽 방향 속도만 유지
        hitLeft = true;
        break;
    }

    // 바운딩 박스 업데이트
    playerBounds = computePlayerBounds(newX, newY, crouchHeight);
  }

  // 🔧 추가 착지 안정성 체크
  if (!isGrounded && Math.abs(newVy) < 50) {
    // 속도가 거의 0이고 바닥 근처에 있는지 체크
    const tolerance =
      crouchHeight > 0.1 ? CROUCH_GROUND_TOLERANCE : GROUND_TOLERANCE;
    const groundCheckBounds = computePlayerBounds(
      newX,
      newY + tolerance,
      crouchHeight
    );

    for (const platform of platforms) {
      if (checkOverlap(groundCheckBounds, platform)) {
        // 바닥과 거의 접촉하고 있다면 착지로 처리
        const targetY = platform.y - RADIUS + heightReduction;
        if (Math.abs(newY - targetY) <= tolerance * 2) {
          //   console.log(
          //     `🔧 Stability landing: Y ${newY.toFixed(1)} → ${targetY.toFixed(1)}`
          //   );
          newY = targetY;
          newVy = 0;
          isGrounded = true;
          hitBottom = true;
          break;
        }
      }
    }
  }

  return {
    x: newX,
    y: newY,
    vx: newVx,
    vy: newVy,
    isGrounded,
    hitTop,
    hitBottom,
    hitLeft,
    hitRight,
  };
}

/**
 * 디버깅용 충돌 정보 로그
 */
export function logCollisionDebug(
  result: ResolveResult,
  originalX: number,
  originalY: number,
  originalVx: number,
  originalVy: number
): void {
  if (
    Math.abs(result.x - originalX) > 0.1 ||
    Math.abs(result.y - originalY) > 0.1 ||
    result.vx !== originalVx ||
    result.vy !== originalVy
  ) {
    console.log("🔧 Collision resolved:", {
      position: `(${originalX.toFixed(1)}, ${originalY.toFixed(
        1
      )}) → (${result.x.toFixed(1)}, ${result.y.toFixed(1)})`,
      velocity: `(${originalVx.toFixed(1)}, ${originalVy.toFixed(
        1
      )}) → (${result.vx.toFixed(1)}, ${result.vy.toFixed(1)})`,
      isGrounded: result.isGrounded,
      hits: {
        top: result.hitTop,
        bottom: result.hitBottom,
        left: result.hitLeft,
        right: result.hitRight,
      },
    });
  }
}

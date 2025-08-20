// src/game/mechanics/wallgrab.ts
import { KeyState, Platform, WallGrabState } from "../types/player.types";

/**
 * 벽 접촉 방향을 판정한다.
 * - playerBounds: 플레이어 AABB (left/right/top/bottom)
 * - platforms: 충돌 판정에 사용할 플랫폼 배열
 * - vx: 현재 수평 속도 (왼쪽<0, 오른쪽>0)
 */
export function checkWallCollision(
  playerBounds: { left: number; right: number; top: number; bottom: number },
  platforms: Platform[],
  vx: number,
  options?: { wallCheckDistance?: number }
): "left" | "right" | null {
  const wallCheckDistance = options?.wallCheckDistance ?? 30;

  for (const p of platforms) {
    const plat = {
      left: p.x,
      right: p.x + p.width,
      top: p.y,
      bottom: p.y + p.height,
    };

    // 세로로 충분히 겹칠 때만 체크 (여유 10px)
    const verticalOverlap =
      playerBounds.bottom > plat.top + 10 &&
      playerBounds.top < plat.bottom - 10;

    if (!verticalOverlap) continue;

    // 왼쪽 벽: 플레이어의 left가 플랫폼의 right 근처
    const nearLeftWall =
      playerBounds.left <= plat.right + 5 &&
      playerBounds.left >= plat.right - wallCheckDistance &&
      vx <= 0;

    if (nearLeftWall) return "left";

    // 오른쪽 벽: 플레이어의 right가 플랫폼의 left 근처
    const nearRightWall =
      playerBounds.right >= plat.left - 5 &&
      playerBounds.right <= plat.left + wallCheckDistance &&
      vx >= 0;

    if (nearRightWall) return "right";
  }

  return null;
}

/**
 * 벽잡기 상태를 갱신한다.
 *
 * 요구사항(원본 반영):
 *  - 조건: 공중 && 벽에 닿음 && 하강 중 && (해당 방향 키 누름) && 쿨다운 없음
 *  - 잡힌 동안:
 *      - 타이머 감소, 시간 초과/지상/벽 이탈/반대키 시 해제
 *      - 수평 속도 0, 수직 속도는 슬라이드 속도 이하로 제한
 *  - 점프 키 처리는 여기서 하지 않음 → performWallJump에서 처리
 */
export function updateWallGrab(
  state: WallGrabState & {
    velocityX: number;
    velocityY: number;
    isGrounded: boolean;
  },
  key: KeyState,
  wallDirection: "left" | "right" | null,
  deltaMs: number
): WallGrabState & {
  velocityX: number;
  velocityY: number;
  isGrounded: boolean;
} {
  let {
    isWallGrabbing,
    wallGrabDirection,
    wallGrabTimer,
    maxWallGrabTime,
    wallSlideSpeed,
    wallJumpCooldown,
    velocityX,
    velocityY,
    isGrounded,
  } = state;

  // 잡기 시작 조건
  const canStartGrab =
    !isGrounded &&
    wallDirection !== null &&
    velocityY > 0 && // 하강 중
    wallJumpCooldown <= 0 &&
    ((wallDirection === "left" && key.left) ||
      (wallDirection === "right" && key.right));

  if (canStartGrab && !isWallGrabbing) {
    isWallGrabbing = true;
    wallGrabDirection = wallDirection;
    wallGrabTimer = maxWallGrabTime;
    // 플레이어가 벽 쪽을 보고 있게 만들 필요가 있으면
    // facingDirection 같은 건 Player 레벨에서 처리
  }

  if (isWallGrabbing) {
    wallGrabTimer -= deltaMs;

    const shouldRelease =
      wallGrabTimer <= 0 ||
      isGrounded ||
      !wallDirection || // 벽 이탈
      (wallGrabDirection === "left" && key.right) ||
      (wallGrabDirection === "right" && key.left);

    if (shouldRelease) {
      isWallGrabbing = false;
      wallGrabDirection = null;
      wallGrabTimer = 0;
    } else {
      // 슬라이드: 수직 속도 제한, 수평 속도 정지
      velocityY = Math.min(velocityY, wallSlideSpeed);
      velocityX = 0;
    }
  }

  // 쿨다운 감소
  if (wallJumpCooldown > 0) {
    wallJumpCooldown -= deltaMs;
    if (wallJumpCooldown < 0) wallJumpCooldown = 0;
  }

  return {
    isWallGrabbing,
    wallGrabDirection,
    wallGrabTimer,
    maxWallGrabTime,
    wallSlideSpeed,
    wallJumpCooldown,
    velocityX,
    velocityY,
    isGrounded,
  };
}

/**
 * 벽점프를 수행한다.
 * - 전제: isWallGrabbing === true && wallGrabDirection 존재
 * - 결과:
 *    - velocityX / velocityY를 점프 힘으로 갱신
 *    - 벽잡기 해제
 *    - 쿨다운 설정
 */
export function performWallJump(
  state: WallGrabState & {
    velocityX: number;
    velocityY: number;
    isGrounded: boolean;
  },
  force: { x: number; y: number },
  cooldownMs = 1200
): WallGrabState & {
  velocityX: number;
  velocityY: number;
  isGrounded: boolean;
} {
  let {
    isWallGrabbing,
    wallGrabDirection,
    wallGrabTimer,
    maxWallGrabTime,
    wallSlideSpeed,
    wallJumpCooldown,
    velocityX,
    velocityY,
    isGrounded,
  } = state;

  if (!isWallGrabbing || !wallGrabDirection) {
    // 점프 불가: 상태 그대로 반환
    return state;
  }

  const dir = wallGrabDirection === "left" ? 1 : -1;

  velocityX = Math.max(200, Math.abs(force.x)) * dir; // 안전 하한
  velocityY = -Math.max(200, Math.abs(force.y)); // 위쪽(음수)

  // 상태 리셋/쿨다운
  isWallGrabbing = false;
  wallGrabDirection = null;
  wallGrabTimer = 0;
  wallJumpCooldown = Math.max(0, cooldownMs);
  isGrounded = false;

  return {
    isWallGrabbing,
    wallGrabDirection,
    wallGrabTimer,
    maxWallGrabTime,
    wallSlideSpeed,
    wallJumpCooldown,
    velocityX,
    velocityY,
    isGrounded,
  };
}

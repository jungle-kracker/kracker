// src/game/mechanics/wallgrab.ts
import { KeyState, Platform, WallGrabState } from "../types/player.types";
import { computePlayerBounds } from "../physics/collisions";

/**
 * 사각형 히트박스와 사각형 플랫폼의 충돌 감지
 */
function checkRectRectOverlap(
  rect1: { left: number; right: number; top: number; bottom: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean {
  const rect2Bounds = {
    left: rect2.x,
    right: rect2.x + rect2.width,
    top: rect2.y,
    bottom: rect2.y + rect2.height,
  };

  return !(
    rect1.right < rect2Bounds.left ||
    rect1.left > rect2Bounds.right ||
    rect1.bottom < rect2Bounds.top ||
    rect1.top > rect2Bounds.bottom
  );
}

/**
 * 벽 접촉 방향을 판정한다. (사각형 히트박스 기반)
 * - playerBounds: 플레이어의 사각형 바운딩 박스
 * - platforms: 충돌 판정에 사용할 플랫폼 배열
 * - vx: 현재 수평 속도 (왼쪽<0, 오른쪽>0)
 */
export function checkWallCollision(
  playerBounds: { left: number; right: number; top: number; bottom: number },
  platforms: Platform[],
  vx: number,
  options?: {
    wallCheckDistance?: number;
    x?: number;
    y?: number;
    crouchHeight?: number;
  }
): "left" | "right" | null {
  const wallCheckDistance = options?.wallCheckDistance ?? 20; // 벽 감지 거리

  // 사각형 히트박스 정보가 있으면 사용, 없으면 기존 바운딩 박스 사용
  let currentPlayerBounds = playerBounds;

  if (
    options?.x !== undefined &&
    options?.y !== undefined &&
    options?.crouchHeight !== undefined
  ) {
    currentPlayerBounds = computePlayerBounds(
      options.x,
      options.y,
      options.crouchHeight
    );
  }

  for (const p of platforms) {
    const plat = {
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
    };

    // 사각형 히트박스와 플랫폼의 충돌 감지
    if (!checkRectRectOverlap(currentPlayerBounds, plat)) {
      continue;
    }

    // 벽 방향 판정 (사각형 히트박스 기반)
    const playerLeft = currentPlayerBounds.left;
    const playerRight = currentPlayerBounds.right;
    const playerTop = currentPlayerBounds.top;
    const playerBottom = currentPlayerBounds.bottom;

    // 세로로 충분히 겹칠 때만 체크 (여유 6px)
    const verticalOverlap =
      playerBottom > plat.y + 6 && playerTop < plat.y + plat.height - 6;

    if (!verticalOverlap) continue;

    // 모서리 감지 임계값
    const cornerThreshold = 6;

    // 왼쪽 벽: 플레이어의 left가 플랫폼의 right 근처
    const nearLeftWall =
      playerLeft <= plat.x + plat.width + 2 &&
      playerLeft >= plat.x + plat.width - wallCheckDistance &&
      vx <= 0;

    // 오른쪽 벽: 플레이어의 right가 플랫폼의 left 근처
    const nearRightWall =
      playerRight >= plat.x - 2 &&
      playerRight <= plat.x + wallCheckDistance &&
      vx >= 0;

    // 모서리에서의 벽 감지 (더 정확한 판정)
    const nearTopLeft =
      Math.abs(playerTop - plat.y) < cornerThreshold && nearLeftWall;
    const nearBottomLeft =
      Math.abs(playerBottom - (plat.y + plat.height)) < cornerThreshold &&
      nearLeftWall;
    const nearTopRight =
      Math.abs(playerTop - plat.y) < cornerThreshold && nearRightWall;
    const nearBottomRight =
      Math.abs(playerBottom - (plat.y + plat.height)) < cornerThreshold &&
      nearRightWall;

    if (nearLeftWall && !nearTopLeft && !nearBottomLeft) return "left";
    if (nearRightWall && !nearTopRight && !nearBottomRight) return "right";
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

// src/game/render/limbs.ts
import { CharacterColors, GfxRefs } from "../types/player.types";
import { drawGun } from "./gun";
import { createGradientColors } from "./character.core";
import {
  getIdleKeyframeAtTime,
  getWalkingKeyframeAtTime,
  getCrouchKeyframeAtTime,
  getWallGrabKeyframeAtTime,
  getJumpKeyframeAtTime,
  type CharacterKeyframe,
  type FacingDirection,
  type AnimationType,
} from "../animations";

// 애니메이션 상태 인터페이스
interface AnimationState {
  facing: FacingDirection;
  currentTime: number;
  animationType: AnimationType;
  wallGrabDirection?: "left" | "right" | null;
}

// 🔍 디버깅용 카운터 (프레임 호출 빈도 체크)
let frameCount = 0;
let lastLogTime = 0;
let lastAnimationState = "";

export function drawCurve(
  graphics: any,
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number
) {
  graphics.moveTo(startX, startY);

  const steps = 210;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x =
      Math.pow(1 - t, 2) * startX +
      2 * (1 - t) * t * controlX +
      Math.pow(t, 2) * endX;
    const y =
      Math.pow(1 - t, 2) * startY +
      2 * (1 - t) * t * controlY +
      Math.pow(t, 2) * endY;
    graphics.lineTo(x, y);
  }
}

/**
 * 단순한 팔다리 그리기 (그라데이션 제거)
 */
function drawLimbWithGradient(
  graphics: any,
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  color: number,
  thickness: number = 3
) {
  graphics.clear();

  // 단순한 선 (그라데이션 제거)
  graphics.lineStyle(thickness, color);
  graphics.beginPath();
  drawCurve(graphics, startX, startY, controlX, controlY, endX, endY);
  graphics.strokePath();
}

/**
 * 방향 결정 함수
 */
function determineFacingDirection(
  mouseX: number,
  playerX: number,
  velocityX: number,
  currentFacing: FacingDirection = "right"
): FacingDirection {
  // 1순위: 마우스 방향 (충분한 거리가 있을 때만)
  const mouseDistance = Math.abs(mouseX - playerX);
  if (Math.abs(velocityX) > 3) {
    return velocityX > 0 ? "right" : "left";
  }
  if (mouseDistance > 20) {
    return mouseX > playerX ? "right" : "left";
  }

  // 3순위: 현재 방향 유지
  return currentFacing;
}

/**
 * 애니메이션 타입 결정 함수
 */
function determineAnimationType(
  isWallGrabbing: boolean,
  isGrounded: boolean,
  velocityX: number,
  crouchHeight: number
): AnimationType {
  let result: AnimationType;

  if (isWallGrabbing) {
    result = "wallGrab";
  } else if (crouchHeight > 0.1) {
    result = "crouch";
  } else if (!isGrounded) {
    // 공중에서의 상태 판단 (간단히 fall로 처리)
    result = "fall";
  } else if (isGrounded && Math.abs(velocityX) > 15) {
    result = "running";
  } else if (isGrounded && Math.abs(velocityX) > 5) {
    result = "walking";
  } else {
    result = "idle";
  }

  return result;
}

/**
 * 애니메이션 상태에서 키프레임을 가져오는 함수
 */
function getCurrentKeyframe(animationState: AnimationState): CharacterKeyframe {
  const { facing, currentTime, animationType, wallGrabDirection } =
    animationState;

  let keyframe: CharacterKeyframe;

  switch (animationType) {
    case "idle":
      keyframe = getIdleKeyframeAtTime(facing, currentTime);
      break;

    case "walking":
      keyframe = getWalkingKeyframeAtTime(currentTime, false);
      break;

    case "running":
      keyframe = getWalkingKeyframeAtTime(currentTime, true);
      break;

    case "crouch":
      keyframe = getCrouchKeyframeAtTime(facing, currentTime);
      break;

    case "wallGrab":
      const direction =
        wallGrabDirection || (facing === "left" ? "left" : "right");
      keyframe = getWallGrabKeyframeAtTime(direction, currentTime);
      break;

    case "jump":
      keyframe = getJumpKeyframeAtTime("jump", currentTime);
      break;

    case "fall":
      keyframe = getJumpKeyframeAtTime("fall", currentTime);
      break;

    default:
      keyframe = getIdleKeyframeAtTime(facing, currentTime);
      break;
  }

  return keyframe;
}

/**
 * 왼쪽 팔 조준 그리기 (그라데이션 적용)
 */
function drawLeftArmAiming(
  armGraphics: any,
  shoulderX: number,
  shoulderY: number,
  mouseX: number,
  mouseY: number,
  color: number,
  shootRecoil: number,
  gunGraphics: any,
  colors: CharacterColors
) {
  const armLength = 25;
  const recoilOffset = shootRecoil * 3;

  // 마우스를 향한 각도 (제한 없음)
  const dx = mouseX - shoulderX;
  const dy = mouseY - shoulderY;
  const angle = Math.atan2(dy, dx);

  // 팔 끝 위치 계산
  const armEndX = shoulderX + Math.cos(angle) * armLength + recoilOffset;
  const armEndY = shoulderY + Math.sin(angle) * armLength;

  // 제어점
  const controlX = shoulderX + Math.cos(angle - 0.4) * (armLength * 0.6);
  const controlY = shoulderY + Math.sin(angle - 0.4) * (armLength * 0.6);

  // 그라데이션 팔 그리기
  drawLimbWithGradient(
    armGraphics,
    shoulderX,
    shoulderY,
    controlX,
    controlY,
    armEndX,
    armEndY,
    color,
    3
  );

  // 총 그리기 (올바른 색상 전달)
  drawGun(gunGraphics, armEndX, armEndY, angle, true, colors, shootRecoil);
}

/**
 * 오른쪽 팔 조준 그리기 (그라데이션 적용)
 */
function drawRightArmAiming(
  armGraphics: any,
  shoulderX: number,
  shoulderY: number,
  mouseX: number,
  mouseY: number,
  color: number,
  shootRecoil: number,
  gunGraphics: any,
  colors: CharacterColors
) {
  const armLength = 25;
  const recoilOffset = shootRecoil * 3;

  // 마우스를 향한 각도 (제한 없음)
  const dx = mouseX - shoulderX;
  const dy = mouseY - shoulderY;
  const angle = Math.atan2(dy, dx);

  // 팔 끝 위치 계산
  const armEndX = shoulderX + Math.cos(angle) * armLength - recoilOffset;
  const armEndY = shoulderY + Math.sin(angle) * armLength;

  // 제어점
  const controlX = shoulderX + Math.cos(angle + 0.4) * (armLength * 0.6);
  const controlY = shoulderY + Math.sin(angle + 0.4) * (armLength * 0.6);

  // 그라데이션 팔 그리기
  drawLimbWithGradient(
    armGraphics,
    shoulderX,
    shoulderY,
    controlX,
    controlY,
    armEndX,
    armEndY,
    color,
    3
  );

  // 총 그리기 (올바른 색상 전달)
  drawGun(gunGraphics, armEndX, armEndY, angle, false, colors, shootRecoil);
}
/**
 * 메인 limbs 그리기 함수 - 새로운 키프레임 시스템 사용
 */
export function drawLimbs(
  refs: GfxRefs,
  params: {
    x: number;
    y: number;
    mouseX: number;
    mouseY: number;
    armSwing: number;
    legSwing: number;
    crouchHeight: number;
    baseCrouchOffset: number;
    isWallGrabbing: boolean;
    wallGrabDirection: "left" | "right" | null;
    isGrounded: boolean;
    velocityX: number;
    colors: CharacterColors;
    shootRecoil: number;
    // 새로 추가된 매개변수들
    currentTime?: number;
    currentFacing?: FacingDirection;
  }
) {
  const {
    x,
    y,
    mouseX,
    mouseY,
    crouchHeight,
    baseCrouchOffset,
    isWallGrabbing,
    wallGrabDirection,
    isGrounded,
    velocityX,
    colors,
    shootRecoil,
    currentTime = Date.now() / 1000, // 기본값: 현재 시간
    currentFacing = "right", // 기본값
  } = params;

  // 🔍 프레임 호출 빈도 체크
  frameCount++;
  const now = Date.now();
  if (now - lastLogTime > 1000) {
    // 1초마다
    console.log(
      `📊 FPS: ${frameCount} | isGrounded: ${isGrounded} | velocityX: ${velocityX.toFixed(
        1
      )}`
    );
    frameCount = 0;
    lastLogTime = now;
  }

  // 애니메이션 상태 결정
  const facing = determineFacingDirection(mouseX, x, velocityX, currentFacing);
  const animationType = determineAnimationType(
    isWallGrabbing,
    isGrounded,
    velocityX,
    crouchHeight
  );

  const animationState: AnimationState = {
    facing,
    currentTime,
    animationType,
    wallGrabDirection,
  };

  // 현재 키프레임 가져오기
  const currentKeyframe = getCurrentKeyframe(animationState);

  // 크라우치 오프셋 적용
  const crouchOffset = crouchHeight * baseCrouchOffset;

  // 총을 들고 있는지 확인 (마우스 방향으로 팔이 향하는지)
  const deltaX = mouseX - x;
  const isMouseOnRight = deltaX >= 0;
  const isAiming = Math.abs(deltaX) > 10; // 최소 거리 이상일 때만 조준

  if (isAiming) {
    // 조준 중일 때: 한쪽 팔은 총을 들고, 나머지는 키프레임 사용
    drawLimbsWithAiming(
      refs,
      x,
      y,
      currentKeyframe,
      crouchOffset,
      colors,
      mouseX,
      mouseY,
      shootRecoil,
      isMouseOnRight
    );
  } else {
    // 조준하지 않을 때: 모든 팔다리를 키프레임으로 그리기
    drawLimbsFromKeyframe(refs, x, y, currentKeyframe, crouchOffset, colors);
  }
}

/**
 * 키프레임 데이터를 기반으로 팔다리 그리기 (조준하지 않을 때, 그라데이션 적용)
 */
function drawLimbsFromKeyframe(
  refs: GfxRefs,
  baseX: number,
  baseY: number,
  keyframe: CharacterKeyframe,
  crouchOffset: number,
  colors: CharacterColors
) {
  const { leftArm, rightArm, leftLeg, rightLeg, gun } = refs;

  // 총 숨기기
  gun.clear();

  // 왼쪽 팔 그리기 (그라데이션)
  drawLimbWithGradient(
    leftArm,
    baseX + keyframe.leftArm.hip.x,
    baseY + keyframe.leftArm.hip.y + crouchOffset,
    baseX + keyframe.leftArm.knee.x,
    baseY + keyframe.leftArm.knee.y + crouchOffset,
    baseX + keyframe.leftArm.foot.x,
    baseY + keyframe.leftArm.foot.y + crouchOffset,
    colors.limbs,
    3
  );

  // 오른쪽 팔 그리기 (그라데이션)
  drawLimbWithGradient(
    rightArm,
    baseX + keyframe.rightArm.hip.x,
    baseY + keyframe.rightArm.hip.y + crouchOffset,
    baseX + keyframe.rightArm.knee.x,
    baseY + keyframe.rightArm.knee.y + crouchOffset,
    baseX + keyframe.rightArm.foot.x,
    baseY + keyframe.rightArm.foot.y + crouchOffset,
    colors.limbs,
    3
  );

  // 왼쪽 다리 그리기 (그라데이션)
  drawLimbWithGradient(
    leftLeg,
    baseX + keyframe.leftLeg.hip.x,
    baseY + keyframe.leftLeg.hip.y + crouchOffset,
    baseX + keyframe.leftLeg.knee.x,
    baseY + keyframe.leftLeg.knee.y + crouchOffset,
    baseX + keyframe.leftLeg.foot.x,
    baseY + keyframe.leftLeg.foot.y + crouchOffset,
    colors.limbs,
    3
  );

  // 오른쪽 다리 그리기 (그라데이션)
  drawLimbWithGradient(
    rightLeg,
    baseX + keyframe.rightLeg.hip.x,
    baseY + keyframe.rightLeg.hip.y + crouchOffset,
    baseX + keyframe.rightLeg.knee.x,
    baseY + keyframe.rightLeg.knee.y + crouchOffset,
    baseX + keyframe.rightLeg.foot.x,
    baseY + keyframe.rightLeg.foot.y + crouchOffset,
    colors.limbs,
    3
  );
}

/**
 * 조준할 때 팔다리 그리기 (한쪽 팔은 총, 나머지는 키프레임, 그라데이션 적용)
 */
function drawLimbsWithAiming(
  refs: GfxRefs,
  baseX: number,
  baseY: number,
  keyframe: CharacterKeyframe,
  crouchOffset: number,
  colors: CharacterColors,
  mouseX: number,
  mouseY: number,
  shootRecoil: number,
  isMouseOnRight: boolean
) {
  const { leftArm, rightArm, leftLeg, rightLeg, gun } = refs;

  // 다리는 항상 키프레임 사용 (그라데이션)
  drawLimbWithGradient(
    leftLeg,
    baseX + keyframe.leftLeg.hip.x,
    baseY + keyframe.leftLeg.hip.y + crouchOffset,
    baseX + keyframe.leftLeg.knee.x,
    baseY + keyframe.leftLeg.knee.y + crouchOffset,
    baseX + keyframe.leftLeg.foot.x,
    baseY + keyframe.leftLeg.foot.y + crouchOffset,
    colors.limbs,
    3
  );

  drawLimbWithGradient(
    rightLeg,
    baseX + keyframe.rightLeg.hip.x,
    baseY + keyframe.rightLeg.hip.y + crouchOffset,
    baseX + keyframe.rightLeg.knee.x,
    baseY + keyframe.rightLeg.knee.y + crouchOffset,
    baseX + keyframe.rightLeg.foot.x,
    baseY + keyframe.rightLeg.foot.y + crouchOffset,
    colors.limbs,
    3
  );

  if (isMouseOnRight) {
    // 오른팔로 조준
    const shoulderX = baseX + keyframe.rightArm.hip.x;
    const shoulderY = baseY + keyframe.rightArm.hip.y + crouchOffset;

    drawRightArmAiming(
      rightArm,
      shoulderX,
      shoulderY,
      mouseX,
      mouseY,
      colors.limbs,
      shootRecoil,
      gun,
      colors
    );

    // 왼팔은 키프레임 사용 (그라데이션)
    drawLimbWithGradient(
      leftArm,
      baseX + keyframe.leftArm.hip.x,
      baseY + keyframe.leftArm.hip.y + crouchOffset,
      baseX + keyframe.leftArm.knee.x,
      baseY + keyframe.leftArm.knee.y + crouchOffset,
      baseX + keyframe.leftArm.foot.x,
      baseY + keyframe.leftArm.foot.y + crouchOffset,
      colors.limbs,
      3
    );
  } else {
    // 왼팔로 조준
    const shoulderX = baseX + keyframe.leftArm.hip.x;
    const shoulderY = baseY + keyframe.leftArm.hip.y + crouchOffset;

    drawLeftArmAiming(
      leftArm,
      shoulderX,
      shoulderY,
      mouseX,
      mouseY,
      colors.limbs,
      shootRecoil,
      gun,
      colors
    );

    // 오른팔은 키프레임 사용 (그라데이션)
    drawLimbWithGradient(
      rightArm,
      baseX + keyframe.rightArm.hip.x,
      baseY + keyframe.rightArm.hip.y + crouchOffset,
      baseX + keyframe.rightArm.knee.x,
      baseY + keyframe.rightArm.knee.y + crouchOffset,
      baseX + keyframe.rightArm.foot.x,
      baseY + keyframe.rightArm.foot.y + crouchOffset,
      colors.limbs,
      3
    );
  }
}

/**
 * 개별 limb(팔/다리) 그리기 헬퍼 함수 (기존 버전 - 호환성 유지)
 */
function drawLimb(
  graphics: any,
  startX: number,
  startY: number,
  controlX: number,
  controlY: number,
  endX: number,
  endY: number,
  color: number
) {
  graphics.clear();
  graphics.lineStyle(3, color);
  graphics.beginPath();
  drawCurve(graphics, startX, startY, controlX, controlY, endX, endY);
  graphics.strokePath();
}

/**
 * 애니메이션 상태 업데이트를 위한 헬퍼 함수들
 */
export const AnimationUtils = {
  determineFacingDirection,
  determineAnimationType,
  getCurrentKeyframe,
};

/**
 * 디버깅을 위한 애니메이션 정보 출력
 */
export function getAnimationDebugInfo(
  mouseX: number,
  x: number,
  velocityX: number,
  isWallGrabbing: boolean,
  isGrounded: boolean,
  crouchHeight: number,
  currentFacing: FacingDirection = "right"
) {
  const facing = determineFacingDirection(mouseX, x, velocityX, currentFacing);
  const animationType = determineAnimationType(
    isWallGrabbing,
    isGrounded,
    velocityX,
    crouchHeight
  );

  return {
    facing,
    animationType,
    isAiming: Math.abs(mouseX - x) > 10,
    velocityX,
    isGrounded,
    crouchHeight,
  };
}

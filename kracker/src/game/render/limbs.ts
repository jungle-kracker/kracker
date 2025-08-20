// src/game/render/limbs.ts
import { CharacterColors, GfxRefs } from "../types/player.types";
import { drawGun } from "./gun";
import { createGradientColors } from "./character.core";
import { ParticleSystem } from "../particle";
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
 * 완전한 곡선 다리 그리기 (사진처럼 부드러운 곡선)
 */
function drawCurvedLimb(
  graphics: any,
  startX: number,
  startY: number,
  control1X: number,
  control1Y: number,
  control2X: number,
  control2Y: number,
  endX: number,
  endY: number,
  color: number,
  thickness: number = 3
) {
  graphics.clear();
  graphics.lineStyle(thickness, color);
  graphics.beginPath();

  // 3차 베지어 곡선으로 부드러운 곡선 생성
  graphics.moveTo(startX, startY);

  const steps = 50;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x =
      Math.pow(1 - t, 3) * startX +
      3 * Math.pow(1 - t, 2) * t * control1X +
      3 * (1 - t) * Math.pow(t, 2) * control2X +
      Math.pow(t, 3) * endX;
    const y =
      Math.pow(1 - t, 3) * startY +
      3 * Math.pow(1 - t, 2) * t * control1Y +
      3 * (1 - t) * Math.pow(t, 2) * control2Y +
      Math.pow(t, 3) * endY;
    graphics.lineTo(x, y);
  }

  graphics.strokePath();
}

/**
 * 완전한 곡선 다리 그리기 (그라데이션 포함)
 */
function drawCurvedLimbWithGradient(
  graphics: any,
  startX: number,
  startY: number,
  control1X: number,
  control1Y: number,
  control2X: number,
  control2Y: number,
  endX: number,
  endY: number,
  color: number,
  thickness: number = 3
) {
  graphics.clear();

  // 메인 곡선
  graphics.lineStyle(thickness, color);
  graphics.beginPath();

  const steps = 50;
  graphics.moveTo(startX, startY);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x =
      Math.pow(1 - t, 3) * startX +
      3 * Math.pow(1 - t, 2) * t * control1X +
      3 * (1 - t) * Math.pow(t, 2) * control2X +
      Math.pow(t, 3) * endX;
    const y =
      Math.pow(1 - t, 3) * startY +
      3 * Math.pow(1 - t, 2) * t * control1Y +
      3 * (1 - t) * Math.pow(t, 2) * control2Y +
      Math.pow(t, 3) * endY;
    graphics.lineTo(x, y);
  }
  graphics.strokePath();

  // 하이라이트 (위쪽 곡선)
  const highlightColor = Phaser.Display.Color.ValueToColor(color);
  highlightColor.lighten(30);
  graphics.lineStyle(thickness * 0.6, highlightColor.color);
  graphics.beginPath();

  graphics.moveTo(startX, startY - thickness * 0.3);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x =
      Math.pow(1 - t, 3) * startX +
      3 * Math.pow(1 - t, 2) * t * control1X +
      3 * (1 - t) * Math.pow(t, 2) * control2X +
      Math.pow(t, 3) * endX;
    const y =
      Math.pow(1 - t, 3) * (startY - thickness * 0.3) +
      3 * Math.pow(1 - t, 2) * t * (control1Y - thickness * 0.3) +
      3 * (1 - t) * Math.pow(t, 2) * (control2Y - thickness * 0.3) +
      Math.pow(t, 3) * (endY - thickness * 0.3);
    graphics.lineTo(x, y);
  }
  graphics.strokePath();

  // 그림자 (아래쪽 곡선)
  const shadowColor = Phaser.Display.Color.ValueToColor(color);
  shadowColor.darken(30);
  graphics.lineStyle(thickness * 0.6, shadowColor.color);
  graphics.beginPath();

  graphics.moveTo(startX, startY + thickness * 0.3);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x =
      Math.pow(1 - t, 3) * startX +
      3 * Math.pow(1 - t, 2) * t * control1X +
      3 * (1 - t) * Math.pow(t, 2) * control2X +
      Math.pow(t, 3) * endX;
    const y =
      Math.pow(1 - t, 3) * (startY + thickness * 0.3) +
      3 * Math.pow(1 - t, 2) * t * (control1Y + thickness * 0.3) +
      3 * (1 - t) * Math.pow(t, 2) * (control2Y + thickness * 0.3) +
      Math.pow(t, 3) * (endY + thickness * 0.3);
    graphics.lineTo(x, y);
  }
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
  crouchHeight: number,
  facing?: FacingDirection,
  isJumping?: boolean
): AnimationType {
  let result: AnimationType;

  if (isWallGrabbing) {
    result = "wallGrab";
  } else if (crouchHeight > 0.1) {
    result = "crouch";
  } else if (isJumping) {
    // 점프 중일 때 방향에 따른 점프 애니메이션
    if (facing === "left") {
      result = "jump-left";
    } else if (facing === "right") {
      result = "jump-right";
    } else {
      result = "jump";
    }
  } else if (!isGrounded) {
    // 공중에서의 상태 판단 (fall로 처리)
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

    case "jump-left":
      keyframe = getJumpKeyframeAtTime("jump", currentTime, "left");
      break;

    case "jump-right":
      keyframe = getJumpKeyframeAtTime("jump", currentTime, "right");
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

  // 단순 색상 팔 그리기
  drawLimb(
    armGraphics,
    shoulderX,
    shoulderY,
    controlX,
    controlY,
    armEndX,
    armEndY,
    color
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

  // 단순 색상 팔 그리기
  drawLimb(
    armGraphics,
    shoulderX,
    shoulderY,
    controlX,
    controlY,
    armEndX,
    armEndY,
    color
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
    isJumping?: boolean; // 점프 상태 추가
    isLanding?: boolean; // 착지 상태 추가
    landTime?: number; // 착지 시간 추가
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
    isJumping = false, // 기본값: 점프하지 않음
    isLanding = false, // 기본값: 착지하지 않음
    landTime = 0, // 기본값: 착지 시간 0
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

  // 착지 이펙트 생성 (착지 시간이 1.5초를 넘으면)
  if (isLanding && landTime > 0) {
    const timeSinceLand = currentTime - landTime;
    if (timeSinceLand > 1.5) {
      // 착지 이펙트 생성 (점프보다 작은 이펙트)
      // 이펙트는 Player.ts에서 처리하도록 플래그만 설정
      console.log("🎯 착지 이펙트 생성 필요: 시간", timeSinceLand.toFixed(2));
    }
  }

  // 애니메이션 상태 결정 (점프 상태 포함)
  const animationType = determineAnimationType(
    isWallGrabbing,
    isGrounded,
    velocityX,
    crouchHeight,
    facing,
    isJumping
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

  // 왼쪽 팔 그리기 (단순 색상)
  drawLimb(
    leftArm,
    baseX + keyframe.leftArm.hip.x,
    baseY + keyframe.leftArm.hip.y + crouchOffset,
    baseX + keyframe.leftArm.knee.x,
    baseY + keyframe.leftArm.knee.y + crouchOffset,
    baseX + keyframe.leftArm.foot.x,
    baseY + keyframe.leftArm.foot.y + crouchOffset,
    colors.head // 몸통과 같은 색상 사용
  );

  // 오른쪽 팔 그리기 (단순 색상)
  drawLimb(
    rightArm,
    baseX + keyframe.rightArm.hip.x,
    baseY + keyframe.rightArm.hip.y + crouchOffset,
    baseX + keyframe.rightArm.knee.x,
    baseY + keyframe.rightArm.knee.y + crouchOffset,
    baseX + keyframe.rightArm.foot.x,
    baseY + keyframe.rightArm.foot.y + crouchOffset,
    colors.head // 몸통과 같은 색상 사용
  );

  // 왼쪽 다리 그리기 (완전한 곡선, 단순 색상)
  const leftLegControl1X =
    baseX +
    keyframe.leftLeg.hip.x +
    (keyframe.leftLeg.knee.x - keyframe.leftLeg.hip.x) * 0.3;
  const leftLegControl1Y =
    baseY +
    keyframe.leftLeg.hip.y +
    crouchOffset +
    (keyframe.leftLeg.knee.y - keyframe.leftLeg.hip.y) * 0.3 -
    5;
  const leftLegControl2X =
    baseX +
    keyframe.leftLeg.knee.x +
    (keyframe.leftLeg.foot.x - keyframe.leftLeg.knee.x) * 0.7;
  const leftLegControl2Y =
    baseY +
    keyframe.leftLeg.knee.y +
    crouchOffset +
    (keyframe.leftLeg.foot.y - keyframe.leftLeg.knee.y) * 0.7 -
    3;

  drawCurvedLimb(
    leftLeg,
    baseX + keyframe.leftLeg.hip.x,
    baseY + keyframe.leftLeg.hip.y + crouchOffset,
    leftLegControl1X,
    leftLegControl1Y,
    leftLegControl2X,
    leftLegControl2Y,
    baseX + keyframe.leftLeg.foot.x,
    baseY + keyframe.leftLeg.foot.y + crouchOffset,
    colors.head, // 몸통과 같은 색상 사용
    3
  );

  // 오른쪽 다리 그리기 (완전한 곡선, 단순 색상)
  const rightLegControl1X =
    baseX +
    keyframe.rightLeg.hip.x +
    (keyframe.rightLeg.knee.x - keyframe.rightLeg.hip.x) * 0.3;
  const rightLegControl1Y =
    baseY +
    keyframe.rightLeg.hip.y +
    crouchOffset +
    (keyframe.rightLeg.knee.y - keyframe.rightLeg.hip.y) * 0.3 -
    5;
  const rightLegControl2X =
    baseX +
    keyframe.rightLeg.knee.x +
    (keyframe.rightLeg.foot.x - keyframe.rightLeg.knee.x) * 0.7;
  const rightLegControl2Y =
    baseY +
    keyframe.rightLeg.knee.y +
    crouchOffset +
    (keyframe.rightLeg.foot.y - keyframe.rightLeg.knee.y) * 0.7 -
    3;

  drawCurvedLimb(
    rightLeg,
    baseX + keyframe.rightLeg.hip.x,
    baseY + keyframe.rightLeg.hip.y + crouchOffset,
    rightLegControl1X,
    rightLegControl1Y,
    rightLegControl2X,
    rightLegControl2Y,
    baseX + keyframe.rightLeg.foot.x,
    baseY + keyframe.rightLeg.foot.y + crouchOffset,
    colors.head, // 몸통과 같은 색상 사용
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

  // 다리는 항상 키프레임 사용 (완전한 곡선, 단순 색상)
  const leftLegControl1X =
    baseX +
    keyframe.leftLeg.hip.x +
    (keyframe.leftLeg.knee.x - keyframe.leftLeg.hip.x) * 0.3;
  const leftLegControl1Y =
    baseY +
    keyframe.leftLeg.hip.y +
    crouchOffset +
    (keyframe.leftLeg.knee.y - keyframe.leftLeg.hip.y) * 0.3 -
    5;
  const leftLegControl2X =
    baseX +
    keyframe.leftLeg.knee.x +
    (keyframe.leftLeg.foot.x - keyframe.leftLeg.knee.x) * 0.7;
  const leftLegControl2Y =
    baseY +
    keyframe.leftLeg.knee.y +
    crouchOffset +
    (keyframe.leftLeg.foot.y - keyframe.leftLeg.knee.y) * 0.7 -
    3;

  drawCurvedLimb(
    leftLeg,
    baseX + keyframe.leftLeg.hip.x,
    baseY + keyframe.leftLeg.hip.y + crouchOffset,
    leftLegControl1X,
    leftLegControl1Y,
    leftLegControl2X,
    leftLegControl2Y,
    baseX + keyframe.leftLeg.foot.x,
    baseY + keyframe.leftLeg.foot.y + crouchOffset,
    colors.head, // 몸통과 같은 색상 사용
    3
  );

  const rightLegControl1X =
    baseX +
    keyframe.rightLeg.hip.x +
    (keyframe.rightLeg.knee.x - keyframe.rightLeg.hip.x) * 0.3;
  const rightLegControl1Y =
    baseY +
    keyframe.rightLeg.hip.y +
    crouchOffset +
    (keyframe.rightLeg.knee.y - keyframe.rightLeg.hip.y) * 0.3 -
    5;
  const rightLegControl2X =
    baseX +
    keyframe.rightLeg.knee.x +
    (keyframe.rightLeg.foot.x - keyframe.rightLeg.knee.x) * 0.7;
  const rightLegControl2Y =
    baseY +
    keyframe.rightLeg.knee.y +
    crouchOffset +
    (keyframe.rightLeg.foot.y - keyframe.rightLeg.knee.y) * 0.7 -
    3;

  drawCurvedLimb(
    rightLeg,
    baseX + keyframe.rightLeg.hip.x,
    baseY + keyframe.rightLeg.hip.y + crouchOffset,
    rightLegControl1X,
    rightLegControl1Y,
    rightLegControl2X,
    rightLegControl2Y,
    baseX + keyframe.rightLeg.foot.x,
    baseY + keyframe.rightLeg.foot.y + crouchOffset,
    colors.head, // 몸통과 같은 색상 사용
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
      colors.head, // 몸통과 같은 색상 사용
      shootRecoil,
      gun,
      colors
    );

    // 왼팔은 키프레임 사용 (단순 색상)
    drawLimb(
      leftArm,
      baseX + keyframe.leftArm.hip.x,
      baseY + keyframe.leftArm.hip.y + crouchOffset,
      baseX + keyframe.leftArm.knee.x,
      baseY + keyframe.leftArm.knee.y + crouchOffset,
      baseX + keyframe.leftArm.foot.x,
      baseY + keyframe.leftArm.foot.y + crouchOffset,
      colors.head // 몸통과 같은 색상 사용
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
      colors.head, // 몸통과 같은 색상 사용
      shootRecoil,
      gun,
      colors
    );

    // 오른팔은 키프레임 사용 (단순 색상)
    drawLimb(
      rightArm,
      baseX + keyframe.rightArm.hip.x,
      baseY + keyframe.rightArm.hip.y + crouchOffset,
      baseX + keyframe.rightArm.knee.x,
      baseY + keyframe.rightArm.knee.y + crouchOffset,
      baseX + keyframe.rightArm.foot.x,
      baseY + keyframe.rightArm.foot.y + crouchOffset,
      colors.head // 몸통과 같은 색상 사용
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

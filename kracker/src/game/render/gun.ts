// src/game/render/gun.ts
import { CharacterColors, GunPose } from "../types/player.types";

/**
 * 총 라인 그리기
 */
export function drawGun(
  gunGfx: any,
  armEndX: number,
  armEndY: number,
  gunAngle: number,
  isLeft: boolean,
  colors: CharacterColors,
  shootRecoil = 0
) {
  gunGfx.clear();

  const gunColor = (colors as any).gun ?? 0x333333;
  const baseLength = 30;
  const gunLength = baseLength + shootRecoil * 3; // 약간 과장

  const gunWidth = 4;

  const gunEndX = armEndX + Math.cos(gunAngle) * gunLength;
  const gunEndY = armEndY + Math.sin(gunAngle) * gunLength;

  const adjustedArmEndX = armEndX;
  const adjustedArmEndY = armEndY - 3;
  const adjustedGunEndX = gunEndX;
  const adjustedGunEndY = gunEndY - 3;

  gunGfx.lineStyle(gunWidth, gunColor);
  gunGfx.beginPath();
  gunGfx.moveTo(adjustedArmEndX, adjustedArmEndY);
  gunGfx.lineTo(adjustedGunEndX, adjustedGunEndY);
  gunGfx.strokePath();

  const handleLength = 10;
  const handleAngle = isLeft
    ? gunAngle + (3 * Math.PI) / 2
    : gunAngle + Math.PI / 2;

  const handleEndX = adjustedArmEndX + Math.cos(handleAngle) * handleLength;
  const handleEndY = adjustedArmEndY + Math.sin(handleAngle) * handleLength;

  gunGfx.lineStyle(3, gunColor);
  gunGfx.beginPath();
  gunGfx.moveTo(adjustedArmEndX, adjustedArmEndY);
  gunGfx.lineTo(handleEndX, handleEndY);
  gunGfx.strokePath();
}

/**
 * 총구(팔 끝) 위치/각도 계산
 * - 원본 Player.getGunPosition 로직을 그대로 반영
 */
export function getGunPosition(params: {
  x: number;
  y: number;
  mouseX: number;
  mouseY: number;
  crouchHeight: number;
  baseCrouchOffset: number;
}): GunPose {
  const { x, y, mouseX, mouseY, crouchHeight, baseCrouchOffset } = params;

  const deltaX = mouseX - x;
  const isMouseOnRight = deltaX >= 0;
  const crouchOffset = crouchHeight * baseCrouchOffset;

  const armLength = 25;
  const gunLength = 30;

  let armEndX: number, armEndY: number, gunAngle: number;

  if (isMouseOnRight) {
    const rightShoulderX = x + 20;
    const rightShoulderY = y + crouchOffset;
    const dx = mouseX - rightShoulderX;
    const dy = mouseY - rightShoulderY;
    let angle = Math.atan2(dy, dx);

    if (angle > Math.PI / 2) angle = Math.PI / 2;
    if (angle < -Math.PI / 2) angle = -Math.PI / 2;

    armEndX = rightShoulderX + Math.cos(angle) * armLength;
    armEndY = rightShoulderY + Math.sin(angle) * armLength;
    gunAngle = angle;
  } else {
    const leftShoulderX = x - 20;
    const leftShoulderY = y + crouchOffset;
    const dx = mouseX - leftShoulderX;
    const dy = mouseY - leftShoulderY;
    let angle = Math.atan2(dy, dx);

    if (angle > 0) angle = Math.min(angle, Math.PI / 2);
    else angle = Math.max(angle, -Math.PI / 2);

    armEndX = leftShoulderX + Math.cos(angle) * armLength;
    armEndY = leftShoulderY + Math.sin(angle) * armLength;
    gunAngle = angle;
  }

  const gunEndX = armEndX + Math.cos(gunAngle) * gunLength;
  const gunEndY = armEndY + Math.sin(gunAngle) * gunLength;

  return { x: gunEndX, y: gunEndY, angle: gunAngle };
}

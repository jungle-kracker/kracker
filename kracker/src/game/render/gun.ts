// src/game/render/gun.ts - 기존 로직 기반으로 개선
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
 * 🔥 개선된 총구(팔 끝) 위치/각도 계산 - 왼쪽 Y값 문제 해결
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

  console.log(
    `🎯 총구 위치 계산: 플레이어(${x.toFixed(1)}, ${y.toFixed(
      1
    )}), 마우스(${mouseX.toFixed(1)}, ${mouseY.toFixed(1)})`
  );

  const deltaX = mouseX - x;
  const isMouseOnRight = deltaX >= 0;

  // 🔥 웅크리기 오프셋 - 양쪽 동일하게 적용
  const crouchOffset = crouchHeight * baseCrouchOffset;

  const armLength = 25;
  const gunLength = 30;

  let armEndX: number, armEndY: number, gunAngle: number;

  if (isMouseOnRight) {
    // 오른쪽 어깨 위치
    const rightShoulderX = x + 20;
    const rightShoulderY = y + crouchOffset; // 🔥 웅크리기 반영

    const dx = mouseX - rightShoulderX;
    const dy = mouseY - rightShoulderY;
    let angle = Math.atan2(dy, dx);

    // 각도 제한 (오른쪽)
    if (angle > Math.PI / 2) angle = Math.PI / 2;
    if (angle < -Math.PI / 2) angle = -Math.PI / 2;

    armEndX = rightShoulderX + Math.cos(angle) * armLength;
    armEndY = rightShoulderY + Math.sin(angle) * armLength;
    gunAngle = angle;

    console.log(
      `➡️ 오른쪽 사격: 어깨(${rightShoulderX}, ${rightShoulderY.toFixed(
        1
      )}), 각도: ${((angle * 180) / Math.PI).toFixed(1)}도`
    );
  } else {
    // 🔥 왼쪽 어깨 위치 - 오른쪽과 대칭으로 수정
    const leftShoulderX = x - 20;
    const leftShoulderY = y + crouchOffset; // 🔥 오른쪽과 동일한 Y 계산

    const dx = mouseX - leftShoulderX;
    const dy = mouseY - leftShoulderY;
    let angle = Math.atan2(dy, dx);

    // 🔥 왼쪽 각도 제한 수정 - 더 자연스럽게
    if (angle > Math.PI / 2) angle = Math.PI / 2;
    else if (angle < -Math.PI / 2) angle = -Math.PI / 2;

    armEndX = leftShoulderX + Math.cos(angle) * armLength;
    armEndY = leftShoulderY + Math.sin(angle) * armLength;
    gunAngle = angle;

    console.log(
      `⬅️ 왼쪽 사격: 어깨(${leftShoulderX}, ${leftShoulderY.toFixed(
        1
      )}), 각도: ${((angle * 180) / Math.PI).toFixed(1)}도`
    );
  }

  // 🔥 총구 끝 위치 계산 (총알이 나가는 지점)
  const gunEndX = armEndX + Math.cos(gunAngle) * gunLength;
  const gunEndY = armEndY + Math.sin(gunAngle) * gunLength;

  console.log(
    `🔫 최종 총구 위치: (${gunEndX.toFixed(1)}, ${gunEndY.toFixed(1)})`
  );

  return {
    x: gunEndX,
    y: gunEndY,
    angle: gunAngle,
  };
}

/**
 * 🔥 벽과의 안전 거리 확인
 */
export function checkWallDistance(
  gunX: number,
  gunY: number,
  angle: number,
  platforms: Array<{ x: number; y: number; width: number; height: number }>,
  minDistance: number = 20
): { isSafe: boolean; distance: number } {
  const stepSize = 2;
  const maxCheckDistance = 60;

  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  for (let distance = 0; distance < maxCheckDistance; distance += stepSize) {
    const testX = gunX + dirX * distance;
    const testY = gunY + dirY * distance;

    for (const platform of platforms) {
      if (
        testX >= platform.x &&
        testX <= platform.x + platform.width &&
        testY >= platform.y &&
        testY <= platform.y + platform.height
      ) {
        console.log(
          `🚧 벽까지 거리: ${distance}px ${
            distance < minDistance ? "(너무 가까움!)" : "(안전)"
          }`
        );
        return {
          isSafe: distance >= minDistance,
          distance,
        };
      }
    }
  }

  return { isSafe: true, distance: maxCheckDistance };
}

/**
 * 🔥 안전한 총알 스폰 위치 계산
 */
export function calculateSafeBulletSpawn(
  gunX: number,
  gunY: number,
  angle: number,
  platforms: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [],
  safetyDistance: number = 15
): { x: number; y: number } {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  // 벽 거리 체크
  const wallCheck = checkWallDistance(
    gunX,
    gunY,
    angle,
    platforms,
    safetyDistance
  );

  if (wallCheck.isSafe) {
    // 안전하면 원래 총구 위치에서 조금만 앞으로
    return {
      x: gunX + dirX * 5,
      y: gunY + dirY * 5,
    };
  } else {
    // 벽이 가까우면 안전한 거리만큼 뒤로
    const safeOffset = Math.max(5, safetyDistance - wallCheck.distance + 5);
    console.log(`🛡️ 벽이 가까워서 ${safeOffset}px 뒤로 이동`);
    return {
      x: gunX - dirX * safeOffset,
      y: gunY - dirY * safeOffset,
    };
  }
}

// src/game/render/character.pose.ts
import { CharacterColors, GfxRefs } from "../types/player.types";
import { renderBodyWithGradient, createGradientColors } from "./character.core";

/**
 * 얼굴 그리기 (입체감 추가, 그림자 제거)
 */
export function updateFace(
  refs: GfxRefs,
  params: {
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    isWallGrabbing?: boolean;
    colors: CharacterColors;
  }
) {
  const { face } = refs;
  const { x, y, health, maxHealth, isWallGrabbing, colors } = params;

  face.clear();

  // 얼굴 색상 (몸통보다 약간 밝게)
  const faceColors = createGradientColors(colors.head);

  // 얼굴 배경 (밝은 색상으로)
  face.fillStyle(faceColors.light);
  face.fillCircle(x + 3, y, 8);

  // 눈 (입체감 있는 검은색)
  face.fillStyle(0x000000);
  face.fillCircle(x, y - 5, 2.5); // 왼쪽 눈
  face.fillCircle(x + 6, y - 5, 2.5); // 오른쪽 눈

  // 눈 하이라이트 (흰색 반사)
  face.fillStyle(0xffffff);
  face.fillCircle(x - 0.5, y - 6, 1);
  face.fillCircle(x + 5.5, y - 6, 1);

  // 입 (체력에 따라 변화, 원래 로직으로)
  if (health > 50) {
    // 건강할 때: 미소 (웃기)
    face.lineStyle(2, 0x000000);
    face.beginPath();
    face.arc(x + 3, y + 2, 4, 0, Math.PI);
    face.strokePath();
  } else if (health > 20) {
    // 중간: 직선
    face.lineStyle(2, 0x000000);
    face.beginPath();
    face.moveTo(x, y + 2);
    face.lineTo(x + 6, y + 2);
    face.strokePath();
  } else {
    // 위험: 찡그림
    face.lineStyle(2, 0x000000);
    face.beginPath();
    face.arc(x + 3, y + 4, 4, Math.PI, Math.PI * 2);
    face.strokePath();
  }

  // 벽잡기 집중한 표정
  if (isWallGrabbing) {
    face.fillStyle(0x000000);
    face.fillRect(x - 2, y - 8, 4, 2); // 찡그린 이마
  }
}

/**
 * 몸(원) 위치/스케일/기울기 업데이트 (그라데이션 적용)
 */
export function updatePose(
  refs: GfxRefs,
  params: {
    x: number;
    y: number;
    wobble: number;
    crouchHeight: number;
    baseCrouchOffset: number;
    wallLean?: number; // 좌(-), 우(+)
    colors: CharacterColors;
    health: number;
    maxHealth: number;
    isWallGrabbing?: boolean;
    scaleOverride?: { x: number; y: number }; // 옵션
  }
) {
  const { body } = refs;
  const {
    x,
    y,
    wobble,
    crouchHeight,
    baseCrouchOffset,
    wallLean = 0,
    colors,
    health,
    maxHealth,
    isWallGrabbing,
    scaleOverride,
  } = params;

  const crouchOffset = crouchHeight * baseCrouchOffset;

  // 살짝 좌우/상하 흔들림
  const finalX = x + Math.sin(wobble) * 1 + wallLean;
  const finalY = y + Math.cos(wobble * 1.5) * 0.5 + crouchOffset;

  body.x = finalX;
  body.y = finalY;

  // 스케일(웅크리기)
  const scaleY = scaleOverride?.y ?? 1 - crouchHeight * 0.04;
  const scaleX = scaleOverride?.x ?? 1 + crouchHeight * 0.005;
  body.setScale(scaleX, scaleY);

  // 그라데이션으로 몸통 렌더링
  const radius = 20;
  renderBodyWithGradient(body, 0, 0, radius, colors);

  // 얼굴 갱신 (그라데이션 포함)
  updateFace(refs, {
    x: finalX,
    y: finalY,
    health,
    maxHealth,
    isWallGrabbing,
    colors,
  });
}

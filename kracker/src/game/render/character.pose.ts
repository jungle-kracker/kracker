// src/game/render/character.pose.ts
import { CharacterColors, GfxRefs } from "../types/player.types";

/**
 * 얼굴 그리기
 */
export function updateFace(
  refs: GfxRefs,
  params: {
    x: number;
    y: number;
    health: number;
    maxHealth: number;
    isWallGrabbing?: boolean;
  }
) {
  const { face } = refs;
  const { x, y, health, maxHealth, isWallGrabbing } = params;

  face.clear();
  face.lineStyle(2, 0x000000);

  // 기본 표정
  face.beginPath();
  face.arc(x, y - 5, 3, 0, Math.PI * 2); // 왼쪽 눈
  face.arc(x + 6, y - 5, 3, 0, Math.PI * 2); // 오른쪽 눈
  face.strokePath();

  // 입 (체력에 따라 변화)
  face.beginPath();
  if (health > 50) {
    // 건강할 때: 미소
    face.arc(x + 3, y + 2, 4, 0, Math.PI);
  } else if (health > 20) {
    // 중간: 직선
    face.moveTo(x, y + 2);
    face.lineTo(x + 6, y + 2);
  } else {
    // 위험: 찡그림
    face.arc(x + 3, y + 4, 4, Math.PI, Math.PI * 2);
  }
  face.strokePath();

  // 벽잡기 집중한 표정
  if (isWallGrabbing) {
    face.fillRect(x - 2, y - 8, 4, 2); // 찡그린 이마
  }
}

/**
 * 몸(원) 위치/스케일/기울기 업데이트
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
  body.x = x + Math.sin(wobble) * 1 + wallLean;
  body.y = y + Math.cos(wobble * 1.5) * 0.5 + crouchOffset;

  // 스케일(웅크리기)
  const scaleY = scaleOverride?.y ?? 1 - crouchHeight * 0.04;
  const scaleX = scaleOverride?.x ?? 1 + crouchHeight * 0.005;
  body.setScale(scaleX, scaleY);

  // 색상 동기화(옵션)
  if (typeof body.setFillStyle === "function") {
    body.setFillStyle(colors.head);
  }

  // 얼굴 갱신
  updateFace(refs, { x, y, health, maxHealth, isWallGrabbing });
}

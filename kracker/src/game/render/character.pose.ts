// src/game/render/character.pose.ts
import { CharacterColors, GfxRefs } from "../types/player.types";

/**
 * 얼굴(눈/입/표정) 업데이트
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
  face.fillStyle(0x000000);

  // 눈
  face.fillCircle(x - 5, y - 5, 2);
  face.fillCircle(x + 5, y - 5, 2);

  // 입 (체력 비율에 따라)
  const hp = Math.max(0, Math.min(1, health / maxHealth));

  if (hp > 0.7) {
    // 웃는 입
    face.lineStyle(2, 0x000000);
    face.beginPath();
    face.arc(x, y + 2, 5, 0, Math.PI);
    face.strokePath();
  } else if (hp > 0.3) {
    // 무표정
    face.fillRect(x - 4, y, 8, 2);
  } else {
    // 찌그린 입
    face.lineStyle(2, 0x000000);
    face.beginPath();
    face.arc(x, y + 5, 5, Math.PI, 0);
    face.strokePath();
  }

  // 벽잡기 집중한 표정
  if (isWallGrabbing) {
    face.fillRect(x - 2, y - 8, 4, 2); // 찡그린 이마
  }
}

/**
 * 몸(원) 위치/스케일/기울기 업데이트 + 얼굴 동기화
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
  const scaleY = scaleOverride?.y ?? 1 - crouchHeight * 0.2;
  const scaleX = scaleOverride?.x ?? 1 + crouchHeight * 0.1;
  body.setScale(scaleX, scaleY);

  // 색상 동기화(옵션)
  if (typeof body.setFillStyle === "function") {
    body.setFillStyle(colors.head);
  }

  // 얼굴도 갱신
  updateFace(refs, { x, y, health, maxHealth, isWallGrabbing });
}

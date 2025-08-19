// src/game/render/character.core.ts
import { CharacterColors, GfxRefs } from "../types/player.types";

/**
 * 캐릭터 그래픽 오브젝트 생성
 * - 팔/다리/총: Graphics
 * - 몸통: Circle
 * - 얼굴: Graphics
 * - 기본 depth는 원본과 동일하게 설정
 */
export function createCharacter(
  scene: any,
  x: number,
  y: number,
  colors: CharacterColors
): GfxRefs {
  const leftArm = scene.add.graphics();
  const rightArm = scene.add.graphics();
  const leftLeg = scene.add.graphics();
  const rightLeg = scene.add.graphics();
  const gun = scene.add.graphics();

  const body = scene.add.circle(x, y, 20, colors.head);
  const face = scene.add.graphics();

  // HP바 그래픽
  const hpBarBg = scene.add.graphics();
  const hpBarFill = scene.add.graphics();
  hpBarBg.setVisible(false);
  hpBarFill.setVisible(false);

  // Depth (원본과 동일)
  body.setDepth(-3);
  face.setDepth(-3);
  leftArm.setDepth(-5);
  rightArm.setDepth(-5);
  leftLeg.setDepth(-5);
  rightLeg.setDepth(-5);
  gun.setDepth(-5);
  hpBarBg.setDepth(-2);
  hpBarFill.setDepth(-2);

  const refs: GfxRefs = {
    body,
    face,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    gun,
    hpBarBg,
    hpBarFill,
  };

  return refs;
}

/**
 * 캐릭터 그래픽 오브젝트 제거
 */
export function destroyCharacter(refs: GfxRefs): void {
  tryDestroy(refs.gun);
  tryDestroy(refs.leftArm);
  tryDestroy(refs.rightArm);
  tryDestroy(refs.leftLeg);
  tryDestroy(refs.rightLeg);
  tryDestroy(refs.face);
  tryDestroy(refs.body);
  tryDestroy(refs.hpBarBg);
  tryDestroy(refs.hpBarFill);
}

function tryDestroy(obj: any) {
  if (obj && typeof obj.destroy === "function" && !obj._destroyed) {
    obj.destroy();
  }
}

/**
 * 몸통 색상 변경 유틸 (옵션)
 */
export function setBodyColor(refs: GfxRefs, color: number) {
  if (refs.body && typeof refs.body.setFillStyle === "function") {
    refs.body.setFillStyle(color);
  }
}

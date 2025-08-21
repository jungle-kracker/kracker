// src/game/input/keyboard.ts
import { KeyState } from "../types/player.types";

export interface KeysHandle {
  keys: any; // Phaser.Types.Input.Keyboard.CursorKeys 와 유사 구조
}

/**
 * Phaser 키보드 바인딩을 생성한다.
 * - W, A, S, D, SPACE
 */
export function setupKeyboard(scene: any): KeysHandle | null {
  if (!scene?.input?.keyboard) return null;
  const keys = scene.input.keyboard.addKeys("W,A,S,D,SPACE,SHIFT");
  return { keys };
}

/**
 * 현재 키 입력 상태를 스냅샷으로 반환한다.
 * - 원본 Player.ts의 매핑을 유지
 */
export function getKeyState(handle: KeysHandle | null): KeyState {
  if (!handle?.keys) {
    return {
      left: false,
      right: false,
      jump: false,
      shoot: false,
      crouch: false,
      blink: false,
    };
  }
  const k = handle.keys;
  return {
    left: !!k.A?.isDown,
    right: !!k.D?.isDown,
    // 점프는 스페이스바만 인정 (더블점프 전용)
    jump: !!k.SPACE?.isDown,
    shoot: !!k.S?.isDown, // 원본 로직과 동일: S로 사격
    crouch: !!k.S?.isDown, // 원본 로직과 동일: S로 웅크리기
    // 블링크: Shift 키
    blink: !!k.SHIFT?.isDown,
  };
}

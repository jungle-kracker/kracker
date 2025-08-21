// src/game/config/KeyBindings.ts
// 모든 키 바인딩을 중앙에서 관리

// ===== 기본 키 바인딩 정의 =====
export interface KeyBinding {
  key: string;
  description: string;
  category: string;
  defaultKey: string;
  alternativeKeys?: string[];
}

export interface KeyBindingGroup {
  [key: string]: KeyBinding;
}

// ===== 맵 전환 키 - 제거됨 =====
export const MAP_KEYS: KeyBindingGroup = {
  // 모든 맵 전환 키 제거됨
} as const;

// ===== 플레이어 색상 변경 키 - 제거됨 =====
export const COLOR_KEYS: KeyBindingGroup = {
  // 모든 색상 변경 키 제거됨
} as const;

// ===== 그림자 조작 키 - 제거됨 =====
export const SHADOW_KEYS: KeyBindingGroup = {
  // 모든 그림자 조작 키 제거됨
} as const;

// ===== 디버그 키 제거 =====
// DEBUG_KEYS 전체 제거

// ===== 카메라 조작 키 - 제거됨 =====
export const CAMERA_KEYS: KeyBindingGroup = {
  // 모든 카메라 조작 키 제거됨
} as const;

// ===== 게임 제어 키 - 제거됨 =====
export const GAME_KEYS: KeyBindingGroup = {
  // 모든 게임 제어 키 제거됨
} as const;

// ===== 전체 키 바인딩 통합 =====
export const ALL_KEY_BINDINGS = {
  map: MAP_KEYS,
  color: COLOR_KEYS,
  shadow: SHADOW_KEYS,
  camera: CAMERA_KEYS,
  game: GAME_KEYS,
} as const;

// ===== 키 바인딩 유틸리티 =====
export class KeyBindingManager {
  private customBindings: Map<string, string> = new Map();
  private reverseLookup: Map<string, string> = new Map();

  constructor() {
    this.buildReverseLookup();
  }

  // 역방향 조회 테이블 구축
  private buildReverseLookup(): void {
    Object.values(ALL_KEY_BINDINGS).forEach((group) => {
      Object.entries(group).forEach(([action, binding]) => {
        this.reverseLookup.set(binding.key, action);

        // 대체 키들도 추가
        if (binding.alternativeKeys) {
          binding.alternativeKeys.forEach((altKey) => {
            this.reverseLookup.set(altKey, action);
          });
        }
      });
    });
  }

  // 키 코드로 액션 찾기
  getActionByKey(keyCode: string): string | null {
    // 커스텀 바인딩에서 먼저 찾기
    const customAction = this.getCustomAction(keyCode);
    if (customAction) return customAction;

    // 기본 바인딩에서 찾기
    return this.reverseLookup.get(keyCode) || null;
  }

  // 액션에 해당하는 키 찾기
  getKeyByAction(category: string, action: string): string | null {
    const group = (ALL_KEY_BINDINGS as any)[category];
    if (!group || !group[action]) return null;

    // 커스텀 바인딩 확인
    const customKey = this.customBindings.get(`${category}.${action}`);
    if (customKey) return customKey;

    // 기본 바인딩 반환
    return group[action].key;
  }

  // 커스텀 키 바인딩 설정
  setCustomBinding(category: string, action: string, newKey: string): boolean {
    const group = (ALL_KEY_BINDINGS as any)[category];
    if (!group || !group[action]) {
      console.warn(`Invalid action: ${category}.${action}`);
      return false;
    }

    // 기존 바인딩 제거
    const oldKey = this.getKeyByAction(category, action);
    if (oldKey) {
      this.reverseLookup.delete(oldKey);
    }

    // 새 바인딩 설정
    const bindingKey = `${category}.${action}`;
    this.customBindings.set(bindingKey, newKey);
    this.reverseLookup.set(newKey, action);

    console.log(`Key binding changed: ${category}.${action} = ${newKey}`);
    return true;
  }

  // 커스텀 바인딩 제거 (기본값으로 복구)
  removeCustomBinding(category: string, action: string): void {
    const bindingKey = `${category}.${action}`;
    const customKey = this.customBindings.get(bindingKey);

    if (customKey) {
      this.customBindings.delete(bindingKey);
      this.reverseLookup.delete(customKey);

      // 기본 바인딩 복구
      const group = (ALL_KEY_BINDINGS as any)[category];
      if (group && group[action]) {
        this.reverseLookup.set(group[action].key, action);
      }
    }
  }

  // 커스텀 액션 조회
  private getCustomAction(keyCode: string): string | null {
    for (const [bindingKey, customKey] of Array.from(
      this.customBindings.entries()
    )) {
      if (customKey === keyCode) {
        return bindingKey.split(".")[1]; // category.action에서 action만 추출
      }
    }
    return null;
  }

  // 모든 커스텀 바인딩 초기화
  resetAllBindings(): void {
    this.customBindings.clear();
    this.buildReverseLookup();
    console.log("All key bindings reset to default");
  }

  // 키 충돌 검사
  hasKeyConflict(newKey: string): string[] {
    const conflicts: string[] = [];

    // 기본 바인딩과 충돌 확인
    if (this.reverseLookup.has(newKey)) {
      conflicts.push(this.reverseLookup.get(newKey)!);
    }

    // 커스텀 바인딩과 충돌 확인
    for (const [bindingKey, customKey] of Array.from(
      this.customBindings.entries()
    )) {
      if (customKey === newKey) {
        conflicts.push(bindingKey);
      }
    }

    return conflicts;
  }

  // 바인딩 정보 가져오기
  getBindingInfo(category: string, action: string): KeyBinding | null {
    const group = (ALL_KEY_BINDINGS as any)[category];
    if (!group || !group[action]) return null;

    const binding = { ...group[action] };

    // 커스텀 바인딩이 있으면 키 업데이트
    const customKey = this.customBindings.get(`${category}.${action}`);
    if (customKey) {
      binding.key = customKey;
    }

    return binding;
  }

  // 카테고리별 바인딩 목록
  getBindingsByCategory(category: string): KeyBinding[] {
    const group = (ALL_KEY_BINDINGS as any)[category];
    if (!group) return [];

    return Object.entries(group).map(([action, binding]: [string, any]) => {
      const result = { ...binding };

      // 커스텀 바인딩이 있으면 키 업데이트
      const customKey = this.customBindings.get(`${category}.${action}`);
      if (customKey) {
        result.key = customKey;
      }

      return result;
    });
  }

  // 전체 바인딩 목록
  getAllBindings(): { [category: string]: KeyBinding[] } {
    const result: { [category: string]: KeyBinding[] } = {};

    Object.keys(ALL_KEY_BINDINGS).forEach((category) => {
      result[category] = this.getBindingsByCategory(category);
    });

    return result;
  }

  // 설정 내보내기
  exportBindings(): string {
    const customBindings: { [key: string]: string } = {};

    for (const [bindingKey, customKey] of Array.from(
      this.customBindings.entries()
    )) {
      customBindings[bindingKey] = customKey;
    }

    return JSON.stringify(
      {
        version: "1.0",
        customBindings,
        timestamp: Date.now(),
      },
      null,
      2
    );
  }

  // 설정 가져오기
  importBindings(bindingsJson: string): boolean {
    try {
      const data = JSON.parse(bindingsJson);

      if (!data.customBindings) {
        console.warn("Invalid bindings format");
        return false;
      }

      // 기존 커스텀 바인딩 초기화
      this.resetAllBindings();

      // 새 바인딩 적용
      Object.entries(data.customBindings).forEach(
        ([bindingKey, customKey]: [string, any]) => {
          const [category, action] = bindingKey.split(".");
          this.setCustomBinding(category, action, customKey);
        }
      );

      console.log("Key bindings imported successfully");
      return true;
    } catch (error) {
      console.error("Failed to import key bindings:", error);
      return false;
    }
  }
}

// ===== 키 바인딩 헬퍼 함수들 =====

// Phaser 키 코드를 표준 키 이름으로 변환
export function normalizeKeyCode(phaserKey: string): string {
  const keyMap: { [key: string]: string } = {
    ONE: "1",
    TWO: "2",
    THREE: "3",
    FOUR: "4",
    FIVE: "5",
    SIX: "6",
    SEVEN: "7",
    EIGHT: "8",
    NINE: "9",
    ZERO: "0",
    MINUS: "-",
    PLUS: "+",
    EQUALS: "=",
    BACKSPACE: "Backspace",
    TAB: "Tab",
    ENTER: "Enter",
    SHIFT: "Shift",
    CTRL: "Control",
    ALT: "Alt",
    SPACE: "Space",
    ESC: "Escape",
    F1: "F1",
    F2: "F2",
    F3: "F3",
    F4: "F4",
    F5: "F5",
    F11: "F11",
    F12: "F12",
    PERIOD: ".",
    COMMA: ",",
    // 숫자 패드
    NUM_ZERO: "Numpad0",
    NUM_ONE: "Numpad1",
    NUM_TWO: "Numpad2",
    NUM_THREE: "Numpad3",
  };

  return keyMap[phaserKey] || phaserKey;
}

// 키 이름을 사용자 친화적 형태로 변환
export function getDisplayKeyName(keyCode: string): string {
  const displayMap: { [key: string]: string } = {
    BACKSPACE: "백스페이스",
    TAB: "탭",
    ENTER: "엔터",
    SHIFT: "시프트",
    CTRL: "컨트롤",
    ALT: "알트",
    SPACE: "스페이스",
    ESC: "이스케이프",
    PERIOD: "마침표(.)",
    COMMA: "쉼표(,)",
    PLUS: "플러스(+)",
    MINUS: "마이너스(-)",
    EQUALS: "등호(=)",
  };

  return displayMap[keyCode] || keyCode;
}

// 카테고리별 도움말 텍스트 생성
export function generateHelpText(
  category: string,
  keyBindingManager: KeyBindingManager
): string {
  const bindings = keyBindingManager.getBindingsByCategory(category);

  if (bindings.length === 0) {
    return `${category}: 설정된 키가 없습니다.`;
  }

  const keyTexts = bindings.map((binding) => {
    const displayKey = getDisplayKeyName(binding.key);
    return `${displayKey}:${binding.description.split(" ")[0]}`;
  });

  return keyTexts.join(" ");
}

// 모든 카테고리의 도움말 텍스트 생성
export function generateAllHelpTexts(keyBindingManager: KeyBindingManager): {
  [category: string]: string;
} {
  const result: { [category: string]: string } = {};

  Object.keys(ALL_KEY_BINDINGS).forEach((category) => {
    result[category] = generateHelpText(category, keyBindingManager);
  });

  return result;
}

// 키 충돌 검사 및 경고
export function validateKeyBindings(
  keyBindingManager: KeyBindingManager
): string[] {
  const warnings: string[] = [];
  const usedKeys = new Set<string>();

  Object.keys(ALL_KEY_BINDINGS).forEach((category) => {
    const bindings = keyBindingManager.getBindingsByCategory(category);

    bindings.forEach((binding) => {
      if (usedKeys.has(binding.key)) {
        warnings.push(`키 충돌: ${binding.key} (${category})`);
      } else {
        usedKeys.add(binding.key);
      }
    });
  });

  return warnings;
}

// ===== 기본 인스턴스 및 내보내기 =====
export const keyBindingManager = new KeyBindingManager();

// 타입 정의
export type KeyBindingCategory = keyof typeof ALL_KEY_BINDINGS;
export type MapKeyAction = keyof typeof MAP_KEYS;
export type ColorKeyAction = keyof typeof COLOR_KEYS;
export type ShadowKeyAction = keyof typeof SHADOW_KEYS;
export type CameraKeyAction = keyof typeof CAMERA_KEYS;
export type GameKeyAction = keyof typeof GAME_KEYS;

// 기본 내보내기
export default {
  MAP_KEYS,
  COLOR_KEYS,
  SHADOW_KEYS,
  CAMERA_KEYS,
  GAME_KEYS,
  ALL_KEY_BINDINGS,
  KeyBindingManager,
  keyBindingManager,
  normalizeKeyCode,
  getDisplayKeyName,
  generateHelpText,
  generateAllHelpTexts,
  validateKeyBindings,
} as const;

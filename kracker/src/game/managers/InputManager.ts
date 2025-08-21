// src/game/managers/InputManager.ts - 상수 적용 버전
import { Debug } from "../debug/DebugManager";
import { LogCategory } from "../debug/Logger";

// 🆕 상수 및 키 바인딩 import
import { INPUT_CONSTANTS } from "../config/GameConstants";
import {
  keyBindingManager,
  MAP_KEYS,
  COLOR_KEYS,
  SHADOW_KEYS,
  generateAllHelpTexts,
} from "../config/KeyBindings";

export interface InputManagerConfig {
  enabled: boolean;
  useCustomBindings: boolean;
  preventKeyRepeat: boolean;
  keyRepeatDelay: number;
}

const DEFAULT_CONFIG: InputManagerConfig = {
  enabled: true,
  useCustomBindings: true,
  preventKeyRepeat: true,
  keyRepeatDelay: INPUT_CONSTANTS.KEY_REPEAT_DELAY,
};

export class InputManager {
  private scene: Phaser.Scene;
  private config: InputManagerConfig;
  private isEnabled: boolean = true;

  // 키 반복 방지
  private pressedKeys = new Set<string>();
  private keyTimers = new Map<string, number>();

  // 콜백 함수들
  private callbacks = {
    onMapChange: null as ((mapKey: string) => Promise<void>) | null,
    onColorChange: null as ((color: string) => void) | null,
    onShadowAngleChange: null as ((angle: number) => void) | null,
    onShadowAnimate: null as (() => void) | null,
    onShadowToggle: null as (() => void) | null,
    onShadowPreset: null as ((preset: string) => void) | null,
    onShadowTest: null as ((testType: string) => void) | null,
    onUIUpdate: null as (() => void) | null,
  };

  constructor(scene: Phaser.Scene, config?: Partial<InputManagerConfig>) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };

    Debug.log.info(LogCategory.INPUT, "InputManager 초기화됨", this.config);
  }

  // 초기화 - 키보드 이벤트 등록
  initialize(): void {
    if (!this.scene.input.keyboard) {
      Debug.log.error(LogCategory.INPUT, "Keyboard input not available");
      return;
    }

    this.setupAllKeyBindings();
    this.logKeyBindings();

    Debug.log.info(LogCategory.INPUT, "모든 키보드 이벤트 등록 완료");
  }

  // 🆕 모든 키 바인딩 설정 - 게임 필수 기능만 유지
  private setupAllKeyBindings(): void {
    // 모든 추가 키바인드 제거됨 (게임 필수 기능만 유지)
    // - WASD: 움직임
    // - SPACE: 점프
    // - S: 사격/웅크리기
    // - SHIFT: 블링크

    Debug.log.debug(
      LogCategory.INPUT,
      "키 바인딩 설정 완료 - 게임 필수 기능만 유지"
    );
  }

  // 🆕 그림자 키 설정 - 제거됨
  private setupShadowKeys(): void {
    // 모든 그림자 키 설정 제거됨
  }

  // 🆕 키 등록 헬퍼
  private registerKey(
    keyCode: string,
    handler: () => void | Promise<void>
  ): void {
    if (!this.scene.input.keyboard) return;

    this.scene.input.keyboard.on(`keydown-${keyCode}`, async () => {
      if (!this.isEnabled) return;

      // 키 반복 방지
      if (this.config.preventKeyRepeat && this.isKeyRepeating(keyCode)) {
        return;
      }

      this.markKeyPressed(keyCode);

      try {
        await handler();
      } catch (error) {
        Debug.log.error(
          LogCategory.INPUT,
          `키 핸들러 에러 (${keyCode})`,
          error
        );
      }
    });

    // 키 업 이벤트로 반복 상태 해제
    this.scene.input.keyboard.on(`keyup-${keyCode}`, () => {
      this.markKeyReleased(keyCode);
    });
  }

  // 🆕 키 반복 방지 로직
  private isKeyRepeating(keyCode: string): boolean {
    if (!this.config.preventKeyRepeat) return false;

    const now = Date.now();
    const lastPressed = this.keyTimers.get(keyCode);

    return lastPressed ? now - lastPressed < this.config.keyRepeatDelay : false;
  }

  private markKeyPressed(keyCode: string): void {
    this.pressedKeys.add(keyCode);
    this.keyTimers.set(keyCode, Date.now());
  }

  private markKeyReleased(keyCode: string): void {
    this.pressedKeys.delete(keyCode);
  }

  // 🆕 핸들러 메서드들
  private async handleMapChange(mapKey: string): Promise<void> {
    Debug.log.info(LogCategory.INPUT, `맵 전환 요청: ${mapKey}`);
    if (this.callbacks.onMapChange) {
      await this.callbacks.onMapChange(mapKey);
    }
  }

  private handleColorChange(color: string): void {
    Debug.log.debug(LogCategory.INPUT, `색상 변경 요청: ${color}`);
    if (this.callbacks.onColorChange) {
      this.callbacks.onColorChange(color);
    }
  }

  private handleShadowAngleChange(angle: number): void {
    Debug.log.debug(LogCategory.SHADOW, `그림자 각도 변경: ${angle}도`);
    if (this.callbacks.onShadowAngleChange) {
      this.callbacks.onShadowAngleChange(angle);
    }
    this.callbacks.onUIUpdate?.();
  }

  private handleShadowAnimate(): void {
    Debug.log.info(LogCategory.SHADOW, "그림자 애니메이션 시작");
    if (this.callbacks.onShadowAnimate) {
      this.callbacks.onShadowAnimate();
    }
  }

  private handleShadowToggle(): void {
    Debug.log.info(LogCategory.SHADOW, "그림자 토글");
    if (this.callbacks.onShadowToggle) {
      this.callbacks.onShadowToggle();
    }
    this.callbacks.onUIUpdate?.();
  }

  private handleShadowPreset(preset: string): void {
    Debug.log.info(LogCategory.SHADOW, `그림자 프리셋: ${preset}`);
    if (this.callbacks.onShadowPreset) {
      this.callbacks.onShadowPreset(preset);
    }
    this.callbacks.onUIUpdate?.();
  }

  private handleShadowTest(testType: string): void {
    Debug.log.debug(LogCategory.SHADOW, `그림자 테스트: ${testType}`);
    if (this.callbacks.onShadowTest) {
      this.callbacks.onShadowTest(testType);
    }
    this.callbacks.onUIUpdate?.();
  }

  // 콜백 등록 메서드들 (기존과 동일)
  onMapChange(callback: (mapKey: string) => Promise<void>): void {
    this.callbacks.onMapChange = callback;
  }

  onColorChange(callback: (color: string) => void): void {
    this.callbacks.onColorChange = callback;
  }

  onShadowAngleChange(callback: (angle: number) => void): void {
    this.callbacks.onShadowAngleChange = callback;
  }

  onShadowAnimate(callback: () => void): void {
    this.callbacks.onShadowAnimate = callback;
  }

  onShadowToggle(callback: () => void): void {
    this.callbacks.onShadowToggle = callback;
  }

  onShadowPreset(callback: (preset: string) => void): void {
    this.callbacks.onShadowPreset = callback;
  }

  onShadowTest(callback: (testType: string) => void): void {
    this.callbacks.onShadowTest = callback;
  }

  onUIUpdate(callback: () => void): void {
    this.callbacks.onUIUpdate = callback;
  }

  // 🆕 커스텀 키 바인딩 메서드들
  setCustomKeyBinding(
    category: string,
    action: string,
    newKey: string
  ): boolean {
    const success = keyBindingManager.setCustomBinding(
      category,
      action,
      newKey
    );

    if (success && this.config.useCustomBindings) {
      // 키 바인딩 재등록
      this.reinitializeBindings();
      Debug.log.info(
        LogCategory.INPUT,
        `커스텀 키 바인딩 설정: ${category}.${action} = ${newKey}`
      );
    }

    return success;
  }

  resetKeyBindings(): void {
    keyBindingManager.resetAllBindings();
    this.reinitializeBindings();
    Debug.log.info(LogCategory.INPUT, "키 바인딩 기본값으로 리셋");
  }

  private reinitializeBindings(): void {
    // 기존 이벤트 리스너 정리는 Phaser가 자동으로 처리
    this.setupAllKeyBindings();
  }

  // 🆕 도움말 텍스트 생성
  getHelpTexts(): { [category: string]: string } {
    return generateAllHelpTexts(keyBindingManager);
  }

  getCurrentKeyBindings(): any {
    return keyBindingManager.getAllBindings();
  }

  // 🆕 키 바인딩 로깅
  private logKeyBindings(): void {
    const helpTexts = this.getHelpTexts();

    Debug.log.info(LogCategory.INPUT, "=== 활성 키 바인딩 ===");
    Object.entries(helpTexts).forEach(([category, text]) => {
      Debug.log.info(LogCategory.INPUT, `${category}: ${text}`);
    });
    Debug.log.info(LogCategory.INPUT, "====================");
  }

  // 입력 활성화/비활성화
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    Debug.log.info(
      LogCategory.INPUT,
      `InputManager ${enabled ? "활성화" : "비활성화"}`
    );
  }

  // 설정 업데이트
  updateConfig(newConfig: Partial<InputManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    Debug.log.info(LogCategory.INPUT, "입력 설정 업데이트됨", newConfig);
  }

  // 현재 설정 반환
  getConfig(): InputManagerConfig {
    return { ...this.config };
  }

  // 🆕 현재 눌린 키들 반환
  getPressedKeys(): string[] {
    return Array.from(this.pressedKeys);
  }

  // 🆕 특정 키가 눌려있는지 확인
  isKeyPressed(keyCode: string): boolean {
    return this.pressedKeys.has(keyCode);
  }

  // 🆕 키 바인딩 내보내기/가져오기
  exportKeyBindings(): string {
    return keyBindingManager.exportBindings();
  }

  importKeyBindings(bindingsJson: string): boolean {
    const success = keyBindingManager.importBindings(bindingsJson);

    if (success && this.config.useCustomBindings) {
      this.reinitializeBindings();
    }

    return success;
  }

  // 🆕 키 충돌 검사
  checkKeyConflicts(): string[] {
    const conflicts: string[] = [];
    const bindings = keyBindingManager.getAllBindings();
    const usedKeys = new Set<string>();

    Object.entries(bindings).forEach(([category, categoryBindings]) => {
      categoryBindings.forEach((binding) => {
        if (usedKeys.has(binding.key)) {
          conflicts.push(`${category}: ${binding.key} 충돌`);
        } else {
          usedKeys.add(binding.key);
        }
      });
    });

    return conflicts;
  }

  // 디버그 정보
  getDebugInfo() {
    return {
      config: this.config,
      isEnabled: this.isEnabled,
      pressedKeys: this.getPressedKeys(),
      keyConflicts: this.checkKeyConflicts(),
      bindingCount: Object.keys(keyBindingManager.getAllBindings()).length,
    };
  }

  logDebugInfo(): void {
    const info = this.getDebugInfo();
    Debug.log.info(LogCategory.INPUT, "=== INPUT MANAGER DEBUG INFO ===");
    Debug.log.info(LogCategory.INPUT, "입력 관리자 정보", info);

    if (info.keyConflicts.length > 0) {
      Debug.log.warn(LogCategory.INPUT, "키 충돌 발견", info.keyConflicts);
    }

    this.logKeyBindings();
    Debug.log.info(LogCategory.INPUT, "==============================");
  }

  // 정리
  destroy(): void {
    Debug.log.info(LogCategory.INPUT, "InputManager 정리 시작");

    // 상태 초기화
    this.pressedKeys.clear();
    this.keyTimers.clear();

    // 콜백 정리
    this.callbacks = {
      onMapChange: null,
      onColorChange: null,
      onShadowAngleChange: null,
      onShadowAnimate: null,
      onShadowToggle: null,
      onShadowPreset: null,
      onShadowTest: null,
      onUIUpdate: null,
    };

    Debug.log.info(LogCategory.INPUT, "InputManager 정리 완료");
  }
}

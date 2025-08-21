// src/game/managers/ShadowManager.ts
import { Debug } from "../debug/DebugManager";
import { LogCategory } from "../debug/Logger";

export interface ShadowPreset {
  name: string;
  angle: number;
  color: number;
  length?: number;
  opacity?: number;
}

export interface DayCycleStep {
  name: string;
  angle: number;
  color: number;
  duration: number; // 각 단계의 지속 시간 (ms)
}

export interface ShadowAnimationConfig {
  dayCycleDuration: number; // 전체 하루 주기 시간 (ms)
  stepTransitionTime: number; // 각 단계 전환 시간 (ms)
  autoLoop: boolean; // 자동 반복 여부
}

const DEFAULT_SHADOW_PRESETS: Record<string, ShadowPreset> = {
  morning: {
    name: "아침",
    angle: 75,
    color: 0x1a1a2e,
    opacity: 0.6,
  },
  noon: {
    name: "정오",
    angle: 90,
    color: 0x000a25,
    opacity: 0.8,
  },
  evening: {
    name: "저녁",
    angle: 105,
    color: 0x2d1b3d,
    opacity: 0.7,
  },
  night: {
    name: "밤",
    angle: 90,
    color: 0x050515,
    opacity: 0.9,
  },
};

const DEFAULT_DAY_CYCLE: DayCycleStep[] = [
  {
    name: "아침",
    angle: 75,
    color: 0x1a1a2e,
    duration: 3000,
  },
  {
    name: "정오",
    angle: 90,
    color: 0x000a25,
    duration: 3000,
  },
  {
    name: "저녁",
    angle: 105,
    color: 0x2d1b3d,
    duration: 3000,
  },
  {
    name: "밤",
    angle: 90,
    color: 0x050515,
    duration: 3000,
  },
];

const DEFAULT_ANIMATION_CONFIG: ShadowAnimationConfig = {
  dayCycleDuration: 12000, // 12초 = 하루
  stepTransitionTime: 2000, // 2초 전환
  autoLoop: false,
};

export class ShadowManager {
  private scene: Phaser.Scene;
  private mapRenderer: any; // MapRenderer 타입

  // 프리셋 관리
  private presets: Record<string, ShadowPreset>;
  private currentPreset: string | null = null;

  // 애니메이션 관리
  private animationConfig: ShadowAnimationConfig;
  private dayCycle: DayCycleStep[];
  private isAnimating: boolean = false;
  private currentCycleStep: number = 0;
  private animationTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, mapRenderer: any) {
    this.scene = scene;
    this.mapRenderer = mapRenderer;
    this.presets = { ...DEFAULT_SHADOW_PRESETS };
    this.dayCycle = [...DEFAULT_DAY_CYCLE];
    this.animationConfig = { ...DEFAULT_ANIMATION_CONFIG };

    Debug.log.info(LogCategory.SHADOW, "ShadowManager 초기화됨");
  }

  // 초기화
  initialize(): void {
    // 기본 프리셋 적용
    this.applyPreset("noon");

    Debug.log.info(LogCategory.SHADOW, "ShadowManager 설정 완료");
  }

  // 그림자 시스템 접근
  private getShadowSystem() {
    return this.mapRenderer?.getShadowSystem?.();
  }

  // 그림자 각도 설정
  setLightAngle(angle: number): void {
    const shadowSystem = this.getShadowSystem();
    if (shadowSystem) {
      shadowSystem.setLightAngle?.(angle);
      Debug.log.debug(LogCategory.SHADOW, `그림자 각도 설정: ${angle}도`);
    } else {
      Debug.log.warn(LogCategory.SHADOW, "ShadowSystem을 찾을 수 없음");
    }
  }

  // 그림자 색상 설정
  setShadowColor(color: number): void {
    const shadowSystem = this.getShadowSystem();
    if (shadowSystem) {
      shadowSystem.setShadowColor?.(color);
      const colorHex = color.toString(16).padStart(6, "0");
      Debug.log.debug(LogCategory.SHADOW, `그림자 색상 설정: #${colorHex}`);
    } else {
      Debug.log.warn(LogCategory.SHADOW, "ShadowSystem을 찾을 수 없음");
    }
  }

  // 그림자 ON/OFF 토글
  toggleShadows(): boolean {
    const shadowSystem = this.getShadowSystem();
    if (!shadowSystem) {
      Debug.log.warn(LogCategory.SHADOW, "ShadowSystem을 찾을 수 없음");
      return false;
    }

    const config = shadowSystem.getConfig?.();
    const currentEnabled = config?.enabled || false;
    const newEnabled = !currentEnabled;

    shadowSystem.setEnabled?.(newEnabled);

    Debug.log.info(
      LogCategory.SHADOW,
      `그림자 시스템: ${newEnabled ? "ON" : "OFF"}`
    );
    return newEnabled;
  }

  // 프리셋 적용
  applyPreset(presetName: string): boolean {
    const preset = this.presets[presetName];
    if (!preset) {
      Debug.log.error(
        LogCategory.SHADOW,
        `존재하지 않는 프리셋: ${presetName}`
      );
      return false;
    }

    // 애니메이션 중이면 중지
    this.stopAnimation();

    // 프리셋 적용
    this.setLightAngle(preset.angle);
    this.setShadowColor(preset.color);

    // 추가 설정이 있다면 적용
    const shadowSystem = this.getShadowSystem();
    if (shadowSystem && preset.opacity !== undefined) {
      // opacity 설정이 가능하다면
      shadowSystem.setOpacity?.(preset.opacity);
    }

    this.currentPreset = presetName;
    this.forceUpdate();

    Debug.log.info(LogCategory.SHADOW, `프리셋 적용: ${preset.name}`, preset);
    return true;
  }

  // 그림자 강제 업데이트
  forceUpdate(): void {
    this.mapRenderer?.forceShadowUpdate?.();
    Debug.log.trace(LogCategory.SHADOW, "그림자 강제 업데이트");
  }

  // 각도 애니메이션 (부드러운 전환)
  animateLightAngle(targetAngle: number, duration: number = 2000): void {
    const shadowSystem = this.getShadowSystem();
    if (!shadowSystem) return;

    // 기존 애니메이션이 있다면 중지
    shadowSystem.animateLightAngle?.(targetAngle, duration);

    Debug.log.debug(
      LogCategory.SHADOW,
      `각도 애니메이션: ${targetAngle}도 (${duration}ms)`
    );
  }

  // 하루 주기 애니메이션 시작
  startDayCycleAnimation(): void {
    if (this.isAnimating) {
      Debug.log.warn(LogCategory.SHADOW, "이미 애니메이션 실행 중");
      return;
    }

    this.isAnimating = true;
    this.currentCycleStep = 0;

    Debug.log.info(LogCategory.SHADOW, "하루 주기 애니메이션 시작");
    this.executeNextCycleStep();
  }

  // 애니메이션 중지
  stopAnimation(): void {
    if (this.animationTimer) {
      this.animationTimer.destroy();
      this.animationTimer = undefined;
    }

    this.isAnimating = false;
    Debug.log.info(LogCategory.SHADOW, "애니메이션 중지됨");
  }

  // 다음 사이클 단계 실행
  private executeNextCycleStep(): void {
    if (!this.isAnimating || this.currentCycleStep >= this.dayCycle.length) {
      if (this.animationConfig.autoLoop && this.isAnimating) {
        // 자동 반복이 활성화되어 있으면 처음부터 다시 시작
        this.currentCycleStep = 0;
        this.executeNextCycleStep();
      } else {
        // 애니메이션 완료
        this.isAnimating = false;
        Debug.log.info(LogCategory.SHADOW, "하루 주기 애니메이션 완료");
      }
      return;
    }

    const step = this.dayCycle[this.currentCycleStep];
    Debug.log.debug(
      LogCategory.SHADOW,
      `→ ${step.name} (각도: ${step.angle}도)`
    );

    // 각도 애니메이션
    this.animateLightAngle(step.angle, this.animationConfig.stepTransitionTime);

    // 색상 변경
    this.setShadowColor(step.color);

    // 다음 단계를 위한 타이머 설정
    this.animationTimer = this.scene.time.delayedCall(step.duration, () => {
      this.currentCycleStep++;
      this.executeNextCycleStep();
    });
  }

  // 테스트 기능들
  performTest(testType: string): void {
    const shadowSystem = this.getShadowSystem();
    if (!shadowSystem) {
      Debug.log.error(LogCategory.SHADOW, "ShadowSystem을 찾을 수 없음");
      return;
    }

    switch (testType) {
      case "color":
        Debug.log.debug(LogCategory.SHADOW, "그림자 색상: 빨간색 테스트");
        this.setShadowColor(0xff0000);
        break;

      case "depth":
        Debug.log.debug(LogCategory.SHADOW, "그림자 depth: 100으로 변경");
        shadowSystem.setDepth?.(100);
        this.forceUpdate();
        break;

      case "force":
        Debug.log.debug(LogCategory.SHADOW, "=== 강제 그림자 테스트 ===");
        // 강제로 보이는 설정
        shadowSystem.setShadowColor?.(0xff0000); // 빨간색
        shadowSystem.setDepth?.(500); // 앞으로
        shadowSystem.setEnabled?.(true);

        // 간단한 테스트 플랫폼으로 강제 업데이트
        const testPlatforms = [{ x: 200, y: 200, width: 400, height: 50 }];

        const camera = this.scene.cameras.main;
        const cameraInfo = {
          x: camera.scrollX,
          y: camera.scrollY,
          width: camera.width,
          height: camera.height,
        };

        shadowSystem.forceUpdate?.(testPlatforms, cameraInfo);
        Debug.log.debug(LogCategory.SHADOW, "강제 그림자 업데이트 완료");
        break;

      default:
        Debug.log.warn(
          LogCategory.SHADOW,
          `알 수 없는 테스트 타입: ${testType}`
        );
    }
  }

  // 커스텀 프리셋 추가
  addPreset(name: string, preset: ShadowPreset): void {
    this.presets[name] = { ...preset, name };
    Debug.log.info(LogCategory.SHADOW, `프리셋 추가: ${name}`, preset);
  }

  // 프리셋 제거
  removePreset(name: string): boolean {
    if (!(name in this.presets)) {
      Debug.log.warn(LogCategory.SHADOW, `존재하지 않는 프리셋: ${name}`);
      return false;
    }

    delete this.presets[name];

    // 현재 프리셋이 제거된 경우 리셋
    if (this.currentPreset === name) {
      this.currentPreset = null;
    }

    Debug.log.info(LogCategory.SHADOW, `프리셋 제거: ${name}`);
    return true;
  }

  // 하루 주기 커스터마이징
  setDayCycle(cycle: DayCycleStep[]): void {
    this.dayCycle = [...cycle];
    Debug.log.info(LogCategory.SHADOW, "하루 주기 업데이트됨", cycle);
  }

  // 애니메이션 설정 업데이트
  updateAnimationConfig(config: Partial<ShadowAnimationConfig>): void {
    this.animationConfig = { ...this.animationConfig, ...config };
    Debug.log.info(LogCategory.SHADOW, "애니메이션 설정 업데이트됨", config);
  }

  // 그림자 시스템 상태 가져오기
  getShadowStatus() {
    const shadowSystem = this.getShadowSystem();
    if (!shadowSystem) {
      return {
        available: false,
        enabled: false,
        config: null,
      };
    }

    const config = shadowSystem.getConfig?.();
    return {
      available: true,
      enabled: config?.enabled || false,
      config: config,
      currentPreset: this.currentPreset,
      isAnimating: this.isAnimating,
      cycleStep: this.isAnimating ? this.currentCycleStep : null,
    };
  }

  // 현재 설정 반환
  getConfig() {
    return {
      presets: { ...this.presets },
      dayCycle: [...this.dayCycle],
      animationConfig: { ...this.animationConfig },
      currentPreset: this.currentPreset,
      isAnimating: this.isAnimating,
    };
  }

  // 사용 가능한 프리셋 목록
  getAvailablePresets(): string[] {
    return Object.keys(this.presets);
  }

  // 프리셋 정보 가져오기
  getPreset(name: string): ShadowPreset | null {
    return this.presets[name] || null;
  }

  // 다음 프리셋으로 순환
  cycleToNextPreset(): string | null {
    const presetNames = this.getAvailablePresets();
    if (presetNames.length === 0) return null;

    const currentIndex = this.currentPreset
      ? presetNames.indexOf(this.currentPreset)
      : -1;
    const nextIndex = (currentIndex + 1) % presetNames.length;
    const nextPreset = presetNames[nextIndex];

    this.applyPreset(nextPreset);
    Debug.log.info(LogCategory.SHADOW, `프리셋 순환: ${nextPreset}`);
    return nextPreset;
  }

  // 이전 프리셋으로 순환
  cycleToPreviousPreset(): string | null {
    const presetNames = this.getAvailablePresets();
    if (presetNames.length === 0) return null;

    const currentIndex = this.currentPreset
      ? presetNames.indexOf(this.currentPreset)
      : -1;
    const prevIndex =
      currentIndex <= 0 ? presetNames.length - 1 : currentIndex - 1;
    const prevPreset = presetNames[prevIndex];

    this.applyPreset(prevPreset);
    Debug.log.info(LogCategory.SHADOW, `프리셋 역순환: ${prevPreset}`);
    return prevPreset;
  }

  // 특정 시간대 프리셋 자동 적용
  applyTimeBasedPreset(): void {
    const currentHour = new Date().getHours();
    let presetName: string;

    if (currentHour >= 6 && currentHour < 12) {
      presetName = "morning";
    } else if (currentHour >= 12 && currentHour < 17) {
      presetName = "noon";
    } else if (currentHour >= 17 && currentHour < 20) {
      presetName = "evening";
    } else {
      presetName = "night";
    }

    this.applyPreset(presetName);
    Debug.log.info(
      LogCategory.SHADOW,
      `시간 기반 프리셋 적용: ${presetName} (${currentHour}시)`
    );
  }

  // 랜덤 프리셋 적용
  applyRandomPreset(): string | null {
    const presetNames = this.getAvailablePresets();
    if (presetNames.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * presetNames.length);
    const randomPreset = presetNames[randomIndex];

    this.applyPreset(randomPreset);
    Debug.log.info(LogCategory.SHADOW, `랜덤 프리셋 적용: ${randomPreset}`);
    return randomPreset;
  }

  // 부드러운 프리셋 전환
  transitionToPreset(
    presetName: string,
    duration: number = 2000
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const preset = this.presets[presetName];
      if (!preset) {
        Debug.log.error(
          LogCategory.SHADOW,
          `존재하지 않는 프리셋: ${presetName}`
        );
        resolve(false);
        return;
      }

      // 애니메이션 중이면 중지
      this.stopAnimation();

      // 부드러운 각도 전환
      this.animateLightAngle(preset.angle, duration);

      // 색상은 즉시 변경 (각도 애니메이션과 함께)
      this.setShadowColor(preset.color);

      // 완료 후 프리셋 설정
      this.scene.time.delayedCall(duration, () => {
        this.currentPreset = presetName;
        this.forceUpdate();
        Debug.log.info(
          LogCategory.SHADOW,
          `부드러운 프리셋 전환 완료: ${preset.name}`
        );
        resolve(true);
      });

      Debug.log.info(
        LogCategory.SHADOW,
        `부드러운 프리셋 전환 시작: ${preset.name} (${duration}ms)`
      );
    });
  }

  // 커스텀 애니메이션 시퀀스 실행
  playCustomSequence(
    sequence: Array<{ preset: string; duration: number }>
  ): void {
    if (sequence.length === 0) {
      Debug.log.warn(LogCategory.SHADOW, "빈 시퀀스는 실행할 수 없음");
      return;
    }

    this.stopAnimation();
    this.isAnimating = true;

    let currentIndex = 0;

    const playNext = () => {
      if (currentIndex >= sequence.length || !this.isAnimating) {
        this.isAnimating = false;
        Debug.log.info(LogCategory.SHADOW, "커스텀 시퀀스 완료");
        return;
      }

      const step = sequence[currentIndex];
      Debug.log.debug(
        LogCategory.SHADOW,
        `시퀀스 단계 ${currentIndex + 1}/${sequence.length}: ${step.preset}`
      );

      this.applyPreset(step.preset);

      this.animationTimer = this.scene.time.delayedCall(step.duration, () => {
        currentIndex++;
        playNext();
      });
    };

    Debug.log.info(LogCategory.SHADOW, "커스텀 시퀀스 시작", sequence);
    playNext();
  }

  // 화면 크기 변경 처리
  handleResize(width: number, height: number): void {
    // 그림자 시스템이 화면 크기 변경을 알아야 한다면
    const shadowSystem = this.getShadowSystem();
    if (shadowSystem && shadowSystem.handleResize) {
      shadowSystem.handleResize(width, height);
      Debug.log.debug(
        LogCategory.SHADOW,
        `그림자 시스템 리사이즈: ${width}x${height}`
      );
    }
  }

  // 디버그 정보 출력
  logDebugInfo(): void {
    const status = this.getShadowStatus();
    const config = this.getConfig();

    Debug.log.info(LogCategory.SHADOW, "=== SHADOW MANAGER DEBUG INFO ===");
    Debug.log.info(LogCategory.SHADOW, "그림자 상태", status);
    Debug.log.info(LogCategory.SHADOW, "설정 정보", {
      presetCount: Object.keys(config.presets).length,
      cycleSteps: config.dayCycle.length,
      animationConfig: config.animationConfig,
    });
    Debug.log.info(
      LogCategory.SHADOW,
      "사용 가능한 프리셋",
      this.getAvailablePresets()
    );
    Debug.log.info(LogCategory.SHADOW, "================================");
  }

  // 설정을 JSON으로 내보내기
  exportConfig(): string {
    return JSON.stringify(this.getConfig(), null, 2);
  }

  // JSON에서 설정 가져오기
  importConfig(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);

      if (config.presets) {
        this.presets = { ...config.presets };
      }

      if (config.dayCycle) {
        this.dayCycle = [...config.dayCycle];
      }

      if (config.animationConfig) {
        this.animationConfig = {
          ...this.animationConfig,
          ...config.animationConfig,
        };
      }

      Debug.log.info(LogCategory.SHADOW, "그림자 설정 가져오기 완료");
      return true;
    } catch (error) {
      Debug.log.error(LogCategory.SHADOW, "그림자 설정 가져오기 실패", error);
      return false;
    }
  }

  // 기본 설정으로 리셋
  resetToDefaults(): void {
    this.stopAnimation();
    this.presets = { ...DEFAULT_SHADOW_PRESETS };
    this.dayCycle = [...DEFAULT_DAY_CYCLE];
    this.animationConfig = { ...DEFAULT_ANIMATION_CONFIG };
    this.currentPreset = null;

    // 정오 프리셋 적용
    this.applyPreset("noon");

    Debug.log.info(LogCategory.SHADOW, "그림자 설정이 기본값으로 리셋됨");
  }

  // 정리
  destroy(): void {
    Debug.log.info(LogCategory.SHADOW, "ShadowManager 정리 시작");

    // 애니메이션 중지
    this.stopAnimation();

    // 참조 정리
    this.mapRenderer = null;
    this.currentPreset = null;

    Debug.log.info(LogCategory.SHADOW, "ShadowManager 정리 완료");
  }
}

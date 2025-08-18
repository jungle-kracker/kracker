// src/game/shadow/index.ts - 그림자 시스템 모듈 통합 내보내기

// 메인 시스템
export { ShadowSystem } from "./ShadowSystem";
export { ShadowRenderer } from "./ShadowRenderer";
export { ShadowCalculator } from "./ShadowCalculator";

// 타입 정의
export type {
  LightConfig,
  CameraInfo,
  ShadowPolygon,
  ShadowCalculationResult,
  ShadowRendererConfig,
} from "./ShadowTypes";

// 기본 설정
export { DEFAULT_LIGHT_CONFIG, DEFAULT_SHADOW_CONFIG } from "./ShadowTypes";

/**
 * 그림자 시스템 사용 예시:
 *
 * ```typescript
 * import { ShadowSystem } from './shadow';
 *
 * // MapRenderer에서
 * const shadowSystem = new ShadowSystem(scene);
 * shadowSystem.update(platforms, cameraInfo);
 *
 * // 동적 제어
 * shadowSystem.setLightAngle(75); // 각도 변경
 * shadowSystem.animateLightAngle(105, 2000); // 부드러운 각도 변경
 * shadowSystem.applyShadowPreset('evening'); // 프리셋 적용
 * ```
 */

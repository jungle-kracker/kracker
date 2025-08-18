// src/game/animations/types/index.ts

// import를 맨 위로 이동
import type { AnimationConfig, FacingDirection } from "./animation.types";

// 모든 애니메이션 관련 타입들을 한 곳에서 export
export * from "./animation.types";

// 자주 사용되는 타입들에 대한 별칭 제공
export type {
  LimbPosition,
  LimbKeyframe,
  CharacterKeyframe,
  Animation,
  AnimationState,
  FacingDirection,
  AnimationType,
  AnimationConfig,
  AnimationTransition,
} from "./animation.types";

// 기본값들을 위한 상수 export
export const DEFAULT_ANIMATION_CONFIG: Partial<AnimationConfig> = {
  loop: false,
  speed: 1.0,
  blendTime: 0.2,
  priority: 0,
  interpolation: "linear",
};

export const DEFAULT_FACING_DIRECTION: FacingDirection = "right";

export const ANIMATION_PRIORITIES = {
  IDLE: 0,
  WALKING: 10,
  RUNNING: 15,
  CROUCH: 20,
  WALL_GRAB: 30,
  JUMP: 40,
  FALL: 35,
} as const;

// src/game/animations/index.ts

// 모든 import를 맨 위로 이동
import { IdleAnimations } from "./keyframes/idle.keyframes";
import { WalkingAnimations } from "./keyframes/walk.keyframes";
import { CrouchAnimations } from "./keyframes/crouch.keyframes";
import { WallGrabAnimations } from "./keyframes/wallgrab.keyframes";
import { JumpAnimations } from "./keyframes/jump.keyframes";

// 모든 타입 정의
export * from "./types";

// 개별 키프레임 파일들을 직접 export
export {
  idleRightAnimation,
  idleLeftAnimation,
  getIdleAnimation,
  getIdleKeyframeAtTime,
  IdleAnimations,
} from "./keyframes/idle.keyframes";

export {
  walkingAnimation,
  runningAnimation,
  getWalkingKeyframeAtTime,
  WalkingAnimations,
} from "./keyframes/walk.keyframes";

export {
  createCrouchDownAnimation,
  createStandUpAnimation,
  createCrouchIdleAnimation,
  getCrouchKeyframeAtTime,
  CrouchAnimations,
} from "./keyframes/crouch.keyframes";

export {
  getWallGrabKeyframeAtTime,
  getWallGrabAnimation,
  WallGrabAnimations,
} from "./keyframes/wallgrab.keyframes";

export {
  jumpAnimation,
  fallAnimation,
  landAnimation,
  getJumpKeyframeAtTime,
  JumpAnimations,
} from "./keyframes/jump.keyframes";

// 애니메이션 맵 생성
export const AnimationMap = {
  // Idle 애니메이션들
  "idle-right": IdleAnimations.right,
  "idle-left": IdleAnimations.left,

  // Movement 애니메이션들
  walk: WalkingAnimations.walk,
  run: WalkingAnimations.run,

  // Crouch 애니메이션들
  "crouch-down-right": CrouchAnimations.crouchDownRight,
  "crouch-down-left": CrouchAnimations.crouchDownLeft,
  "crouch-idle-right": CrouchAnimations.crouchIdleRight,
  "crouch-idle-left": CrouchAnimations.crouchIdleLeft,
  "stand-up-right": CrouchAnimations.standUpRight,
  "stand-up-left": CrouchAnimations.standUpLeft,

  // Wall grab 애니메이션들
  "wall-grab-left": WallGrabAnimations.grabLeft,
  "wall-grab-right": WallGrabAnimations.grabRight,
  "wall-slide-left": WallGrabAnimations.slideLeft,
  "wall-slide-right": WallGrabAnimations.slideRight,
  "wall-release-left": WallGrabAnimations.releaseLeft,
  "wall-release-right": WallGrabAnimations.releaseRight,

  // Jump 애니메이션들
  jump: JumpAnimations.jump,
  fall: JumpAnimations.fall,
  land: JumpAnimations.land,
} as const;

export type AnimationName = keyof typeof AnimationMap;

export const AnimationCategories = {
  idle: IdleAnimations,
  movement: WalkingAnimations,
  crouch: CrouchAnimations,
  wallGrab: WallGrabAnimations,
  jump: JumpAnimations,
} as const;

// 모든 사용 가능한 애니메이션 목록
export const AVAILABLE_ANIMATIONS = [
  // Idle
  "idle-right",
  "idle-left",

  // Movement
  "walk",
  "run",

  // Crouch
  "crouch-down-right",
  "crouch-down-left",
  "crouch-idle-right",
  "crouch-idle-left",
  "stand-up-right",
  "stand-up-left",

  // Wall grab
  "wall-grab-left",
  "wall-grab-right",
  "wall-slide-left",
  "wall-slide-right",
  "wall-release-left",
  "wall-release-right",

  // Jump
  "jump",
  "fall",
  "land",
] as const;

// 업데이트된 시스템 정보
export const ANIMATION_SYSTEM_INFO = {
  version: "2.0.0",
  features: [
    "keyframe-based animations",
    "direction-aware idle poses",
    "breathing animations",
    "walking/running cycles",
    "crouch animations",
    "wall grab animations",
    "jump/fall/land animations",
    "type-safe animation names",
    "keyframe interpolation",
  ],
  planned: [
    "animation manager",
    "blending system",
    "transition system",
    "animation events",
  ],
  stats: {
    totalAnimations: AVAILABLE_ANIMATIONS.length,
    categories: Object.keys(AnimationCategories).length,
  },
} as const;

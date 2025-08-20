// src/game/animations/types/animation.types.ts

/**
 * 2D 위치 좌표
 */
export interface LimbPosition {
  x: number;
  y: number;
}

/**
 * 개별 팔다리의 키프레임 (어깨/엉덩이 → 팔꿈치/무릎 → 손/발)
 */
export interface LimbKeyframe {
  hip: LimbPosition; // 어깨 또는 엉덩이 위치
  knee: LimbPosition; // 팔꿈치 또는 무릎 위치 (컨트롤 포인트)
  foot: LimbPosition; // 손 또는 발 위치
}

/**
 * 전신 캐릭터의 한 프레임 키프레임
 */
export interface CharacterKeyframe {
  time: number; // 0.0 - 1.0 사이의 시간
  leftLeg: LimbKeyframe;
  rightLeg: LimbKeyframe;
  leftArm: LimbKeyframe;
  rightArm: LimbKeyframe;
}

/**
 * 애니메이션 정의
 */
export interface Animation {
  name: string;
  duration: number; // 애니메이션 전체 길이 (초)
  loop: boolean; // 반복 여부
  keyframes: CharacterKeyframe[];
  blendable?: boolean; // 다른 애니메이션과 블렌딩 가능 여부
  priority?: number; // 애니메이션 우선순위 (높을수록 우선)
}

/**
 * 캐릭터가 바라보는 방향
 */
export type FacingDirection = "left" | "right";

/**
 * 애니메이션 타입
 */
export type AnimationType =
  | "idle"
  | "walking"
  | "running"
  | "wallGrab"
  | "crouch"
  | "jump"
  | "fall";

/**
 * 애니메이션 상태
 */
export interface AnimationState {
  facing: FacingDirection;
  currentTime: number;
  animationType: AnimationType;
  transitionProgress?: number; // 애니메이션 전환 시 진행도 (0-1)
  transitionFrom?: AnimationType; // 전환 전 애니메이션
}

/**
 * 애니메이션 재생 상태
 */
export type PlaybackState = "playing" | "paused" | "stopped" | "blending";

/**
 * 보간(interpolation) 타입
 */
export type InterpolationType =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "cubic";

/**
 * 애니메이션 블렌딩 모드
 */
export type BlendMode = "additive" | "override" | "multiply";

/**
 * 애니메이션 설정
 */
export interface AnimationConfig {
  name: string;
  loop?: boolean;
  speed?: number; // 재생 속도 배수 (1.0 = 기본속도)
  blendTime?: number; // 블렌딩 시간 (초)
  priority?: number;
  interpolation?: InterpolationType;
}

/**
 * 애니메이션 전환 설정
 */
export interface AnimationTransition {
  from: AnimationType;
  to: AnimationType;
  duration: number; // 전환 시간 (초)
  curve?: InterpolationType;
  condition?: () => boolean; // 전환 조건 함수 (옵션)
}

/**
 * 애니메이션 이벤트
 */
export interface AnimationEvent {
  time: number; // 애니메이션 시간 (0-1)
  type: string; // 이벤트 타입 ('footstep', 'attack', 'land' 등)
  data?: any; // 추가 데이터
}

/**
 * 완전한 애니메이션 정의 (이벤트 포함)
 */
export interface CompleteAnimation extends Animation {
  events?: AnimationEvent[];
  transitions?: AnimationTransition[];
}

/**
 * 애니메이션 컬렉션 (관련된 애니메이션들을 묶음)
 */
export interface AnimationCollection {
  name: string;
  animations: Record<string, Animation>;
  defaultAnimation?: string;
  transitions?: AnimationTransition[];
}

/**
 * 키프레임 보간에 사용되는 유틸리티 타입들
 */
export interface InterpolationResult {
  keyframe: CharacterKeyframe;
  progress: number; // 현재 키프레임에서의 진행도
  nextKeyframeIndex: number;
}

/**
 * 애니메이션 매니저의 내부 상태
 */
export interface AnimationManagerState {
  activeAnimations: Map<
    string,
    {
      animation: Animation;
      startTime: number;
      weight: number;
      config: AnimationConfig;
    }
  >;
  globalTime: number;
  defaultFacing: FacingDirection;
}

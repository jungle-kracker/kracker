// src/game/animations/keyframes/crouch.keyframes.ts

import { Animation, CharacterKeyframe, FacingDirection } from "../types";

/**
 * 웅크리기 시작 자세 (서있는 상태)
 */
const STANDING_KEYFRAME: CharacterKeyframe = {
  time: 0.0,
  leftLeg: {
    hip: { x: -10, y: 20 },
    knee: { x: -8, y: 30 },
    foot: { x: -10, y: 40 },
  },
  rightLeg: {
    hip: { x: 10, y: 20 },
    knee: { x: 8, y: 30 },
    foot: { x: 10, y: 40 },
  },
  leftArm: {
    hip: { x: -10, y: 0 },
    knee: { x: -15, y: 5 },
    foot: { x: -30, y: 10 },
  },
  rightArm: {
    hip: { x: 10, y: 0 },
    knee: { x: 15, y: 5 },
    foot: { x: 30, y: 10 },
  },
};

/**
 * 완전히 웅크린 자세
 */
function createCrouchedKeyframe(facing: FacingDirection): CharacterKeyframe {
  if (facing === "right") {
    return {
      time: 1.0,
      leftLeg: {
        // 뒷다리
        hip: { x: -10, y: 25 },
        knee: { x: -20, y: 20 }, // 무릎이 많이 구부러짐
        foot: { x: -25, y: 40 },
      },
      rightLeg: {
        // 앞다리
        hip: { x: 10, y: 25 },
        knee: { x: 25, y: 20 }, // 무릎이 많이 구부러짐
        foot: { x: 30, y: 40 },
      },
      leftArm: {
        hip: { x: -10, y: 5 },
        knee: { x: -15, y: 10 },
        foot: { x: -25, y: 15 },
      },
      rightArm: {
        hip: { x: 10, y: 5 },
        knee: { x: 15, y: 10 },
        foot: { x: 25, y: 15 },
      },
    };
  } else {
    return {
      time: 1.0,
      leftLeg: {
        // 앞다리
        hip: { x: -10, y: 25 },
        knee: { x: -25, y: 20 }, // 무릎이 많이 구부러짐
        foot: { x: -30, y: 40 },
      },
      rightLeg: {
        // 뒷다리
        hip: { x: 10, y: 25 },
        knee: { x: 20, y: 20 }, // 무릎이 많이 구부러짐
        foot: { x: 25, y: 40 },
      },
      leftArm: {
        hip: { x: -10, y: 5 },
        knee: { x: -15, y: 10 },
        foot: { x: -25, y: 15 },
      },
      rightArm: {
        hip: { x: 10, y: 5 },
        knee: { x: 15, y: 10 },
        foot: { x: 25, y: 15 },
      },
    };
  }
}

/**
 * 웅크리기 시작 애니메이션 (서있는 상태 → 웅크린 상태)
 */
export function createCrouchDownAnimation(facing: FacingDirection): Animation {
  return {
    name: `crouch-down-${facing}`,
    duration: 0.3,
    loop: false,
    keyframes: [
      STANDING_KEYFRAME,
      {
        ...STANDING_KEYFRAME,
        time: 0.5,
        leftLeg: {
          hip: { x: -10, y: 22 },
          knee: { x: -12, y: 25 },
          foot: { x: -15, y: 40 },
        },
        rightLeg: {
          hip: { x: 10, y: 22 },
          knee: { x: 12, y: 25 },
          foot: { x: 15, y: 40 },
        },
      },
      createCrouchedKeyframe(facing),
    ],
    priority: 20,
  };
}

/**
 * 일어서기 애니메이션 (웅크린 상태 → 서있는 상태)
 */
export function createStandUpAnimation(facing: FacingDirection): Animation {
  const crouchDown = createCrouchDownAnimation(facing);
  return {
    name: `stand-up-${facing}`,
    duration: 0.25,
    loop: false,
    keyframes: [...crouchDown.keyframes].reverse().map((kf, index, arr) => ({
      ...kf,
      time: index / (arr.length - 1),
    })),
    priority: 20,
  };
}

/**
 * 웅크린 상태에서의 Idle 애니메이션
 */
export function createCrouchIdleAnimation(facing: FacingDirection): Animation {
  const baseCrouchKeyframe = createCrouchedKeyframe(facing);

  return {
    name: `crouch-idle-${facing}`,
    duration: 2.5, // 조금 더 느린 호흡
    loop: true,
    keyframes: [
      baseCrouchKeyframe,
      {
        ...baseCrouchKeyframe,
        time: 0.5,
        leftLeg: {
          ...baseCrouchKeyframe.leftLeg,
          hip: {
            ...baseCrouchKeyframe.leftLeg.hip,
            y: baseCrouchKeyframe.leftLeg.hip.y - 0.3,
          },
        },
        rightLeg: {
          ...baseCrouchKeyframe.rightLeg,
          hip: {
            ...baseCrouchKeyframe.rightLeg.hip,
            y: baseCrouchKeyframe.rightLeg.hip.y - 0.3,
          },
        },
      },
      {
        ...baseCrouchKeyframe,
        time: 1.0,
      },
    ],
    blendable: true,
    priority: 5,
  };
}

/**
 * 특정 시간에서의 웅크린 키프레임 계산
 */
export function getCrouchKeyframeAtTime(
  facing: FacingDirection,
  time: number
): CharacterKeyframe {
  const baseKeyframe = createCrouchedKeyframe(facing);
  const breathingOffset = Math.sin(time * ((2 * Math.PI) / 2.5)) * 0.3; // 2.5초 주기

  return {
    ...baseKeyframe,
    time,
    leftLeg: {
      ...baseKeyframe.leftLeg,
      hip: {
        ...baseKeyframe.leftLeg.hip,
        y: baseKeyframe.leftLeg.hip.y + breathingOffset,
      },
    },
    rightLeg: {
      ...baseKeyframe.rightLeg,
      hip: {
        ...baseKeyframe.rightLeg.hip,
        y: baseKeyframe.rightLeg.hip.y + breathingOffset,
      },
    },
  };
}

/**
 * 크라우치 애니메이션 컬렉션
 */
export const CrouchAnimations = {
  crouchDownRight: createCrouchDownAnimation("right"),
  crouchDownLeft: createCrouchDownAnimation("left"),
  standUpRight: createStandUpAnimation("right"),
  standUpLeft: createStandUpAnimation("left"),
  crouchIdleRight: createCrouchIdleAnimation("right"),
  crouchIdleLeft: createCrouchIdleAnimation("left"),
} as const;

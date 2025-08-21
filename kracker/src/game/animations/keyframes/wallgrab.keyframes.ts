// src/game/animations/keyframes/wallgrab.keyframes.ts

import { Animation, CharacterKeyframe } from "../types";

/**
 * 왼쪽 벽을 잡는 자세
 */
const WALL_GRAB_LEFT_KEYFRAME: CharacterKeyframe = {
  time: 0,
  leftLeg: {
    hip: { x: -10, y: 10 },
    knee: { x: -18, y: 28 }, // 벽쪽 다리가 구부러짐
    foot: { x: -15, y: 35 },
  },
  rightLeg: {
    hip: { x: 10, y: 10 },
    knee: { x: 15, y: 30 }, // 반대쪽 다리는 덜 구부러짐
    foot: { x: 10, y: 40 },
  },
  leftArm: {
    // 벽을 잡는 팔
    hip: { x: -10, y: 0 },
    knee: { x: -20, y: -5 }, // 팔꿈치가 위로
    foot: { x: -30, y: -10 }, // 손이 벽에
  },
  rightArm: {
    // 자유로운 팔
    hip: { x: 10, y: 0 },
    knee: { x: 15, y: 8 },
    foot: { x: 25, y: 15 },
  },
};

/**
 * 오른쪽 벽을 잡는 자세
 */
const WALL_GRAB_RIGHT_KEYFRAME: CharacterKeyframe = {
  time: 0,
  leftLeg: {
    hip: { x: -10, y: 10 },
    knee: { x: -15, y: 30 }, // 반대쪽 다리는 덜 구부러짐
    foot: { x: -10, y: 40 },
  },
  rightLeg: {
    hip: { x: 10, y: 10 },
    knee: { x: 18, y: 28 }, // 벽쪽 다리가 구부러짐
    foot: { x: 15, y: 35 },
  },
  leftArm: {
    // 자유로운 팔
    hip: { x: -10, y: 0 },
    knee: { x: -15, y: 8 },
    foot: { x: -25, y: 15 },
  },
  rightArm: {
    // 벽을 잡는 팔
    hip: { x: 10, y: 0 },
    knee: { x: 20, y: -5 }, // 팔꿈치가 위로
    foot: { x: 30, y: -10 }, // 손이 벽에
  },
};

/**
 * 벽잡기 애니메이션 (약간의 흔들림 포함)
 */
function createWallGrabAnimation(direction: "left" | "right"): Animation {
  const baseKeyframe =
    direction === "left" ? WALL_GRAB_LEFT_KEYFRAME : WALL_GRAB_RIGHT_KEYFRAME;

  return {
    name: `wall-grab-${direction}`,
    duration: 2.0,
    loop: true,
    keyframes: [
      baseKeyframe,
      {
        ...baseKeyframe,
        time: 0.5,
        // 약간의 흔들림 (지구력 소모 표현)
        leftLeg: {
          ...baseKeyframe.leftLeg,
          hip: {
            ...baseKeyframe.leftLeg.hip,
            y: baseKeyframe.leftLeg.hip.y + 0.5,
          },
        },
        rightLeg: {
          ...baseKeyframe.rightLeg,
          hip: {
            ...baseKeyframe.rightLeg.hip,
            y: baseKeyframe.rightLeg.hip.y + 0.5,
          },
        },
      },
      {
        ...baseKeyframe,
        time: 1.0,
      },
    ],
    priority: 30,
  };
}

/**
 * 벽에서 미끄러지는 애니메이션
 */
function createWallSlideAnimation(direction: "left" | "right"): Animation {
  const grabKeyframe =
    direction === "left" ? WALL_GRAB_LEFT_KEYFRAME : WALL_GRAB_RIGHT_KEYFRAME;

  return {
    name: `wall-slide-${direction}`,
    duration: 0.5,
    loop: true,
    keyframes: [
      grabKeyframe,
      {
        ...grabKeyframe,
        time: 1.0,
        // 다리가 더 펴짐 (미끄러지는 느낌)
        leftLeg: {
          ...grabKeyframe.leftLeg,
          knee: {
            x: grabKeyframe.leftLeg.knee.x * 0.8,
            y: grabKeyframe.leftLeg.knee.y + 3,
          },
          foot: {
            x: grabKeyframe.leftLeg.foot.x * 0.8,
            y: grabKeyframe.leftLeg.foot.y + 5,
          },
        },
        rightLeg: {
          ...grabKeyframe.rightLeg,
          knee: {
            x: grabKeyframe.rightLeg.knee.x * 0.8,
            y: grabKeyframe.rightLeg.knee.y + 3,
          },
          foot: {
            x: grabKeyframe.rightLeg.foot.x * 0.8,
            y: grabKeyframe.rightLeg.foot.y + 5,
          },
        },
      },
    ],
    priority: 25,
  };
}

/**
 * 특정 시간에서의 벽잡기 키프레임 계산
 */
export function getWallGrabKeyframeAtTime(
  direction: "left" | "right",
  time: number
): CharacterKeyframe {
  const baseKeyframe =
    direction === "left" ? WALL_GRAB_LEFT_KEYFRAME : WALL_GRAB_RIGHT_KEYFRAME;
  const wobbleOffset = Math.sin(time * Math.PI) * 0.3; // 약간의 흔들림

  return {
    ...baseKeyframe,
    time,
    leftLeg: {
      ...baseKeyframe.leftLeg,
      hip: {
        ...baseKeyframe.leftLeg.hip,
        y: baseKeyframe.leftLeg.hip.y + wobbleOffset,
      },
    },
    rightLeg: {
      ...baseKeyframe.rightLeg,
      hip: {
        ...baseKeyframe.rightLeg.hip,
        y: baseKeyframe.rightLeg.hip.y + wobbleOffset,
      },
    },
  };
}

/**
 * 벽잡기에서 일반 상태로 전환하는 애니메이션
 */
function createWallReleaseAnimation(direction: "left" | "right"): Animation {
  const grabKeyframe =
    direction === "left" ? WALL_GRAB_LEFT_KEYFRAME : WALL_GRAB_RIGHT_KEYFRAME;

  // 일반 공중 자세 (떨어지는 자세)
  const fallKeyframe: CharacterKeyframe = {
    time: 1.0,
    leftLeg: {
      hip: { x: -10, y: 20 },
      knee: { x: -8, y: 25 },
      foot: { x: -5, y: 30 },
    },
    rightLeg: {
      hip: { x: 10, y: 20 },
      knee: { x: 8, y: 25 },
      foot: { x: 5, y: 30 },
    },
    leftArm: {
      hip: { x: -10, y: 0 },
      knee: { x: -12, y: 8 },
      foot: { x: -15, y: 15 },
    },
    rightArm: {
      hip: { x: 10, y: 0 },
      knee: { x: 12, y: 8 },
      foot: { x: 15, y: 15 },
    },
  };

  return {
    name: `wall-release-${direction}`,
    duration: 0.2,
    loop: false,
    keyframes: [grabKeyframe, fallKeyframe],
    priority: 35,
  };
}

/**
 * 벽잡기 애니메이션 컬렉션
 */
export const WallGrabAnimations = {
  grabLeft: createWallGrabAnimation("left"),
  grabRight: createWallGrabAnimation("right"),
  slideLeft: createWallSlideAnimation("left"),
  slideRight: createWallSlideAnimation("right"),
  releaseLeft: createWallReleaseAnimation("left"),
  releaseRight: createWallReleaseAnimation("right"),
} as const;

/**
 * 벽잡기 방향에 따른 애니메이션 선택 헬퍼
 */
export function getWallGrabAnimation(
  direction: "left" | "right",
  isSliding: boolean = false
): Animation {
  if (isSliding) {
    return direction === "left"
      ? WallGrabAnimations.slideLeft
      : WallGrabAnimations.slideRight;
  }
  return direction === "left"
    ? WallGrabAnimations.grabLeft
    : WallGrabAnimations.grabRight;
}

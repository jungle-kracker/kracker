// src/game/animations/keyframes/jump.keyframes.ts

import { Animation, CharacterKeyframe } from "../types";

/**
 * 점프 준비 자세 (웅크렸다가 뛰는 자세)
 */
const JUMP_PREPARE_KEYFRAME: CharacterKeyframe = {
  time: 0.0,
  leftLeg: {
    hip: { x: -10, y: 15 },
    knee: { x: -15, y: 20 }, // 무릎이 많이 구부러짐
    foot: { x: -12, y: 40 },
  },
  rightLeg: {
    hip: { x: 10, y: 15 },
    knee: { x: 15, y: 20 }, // 무릎이 많이 구부러짐
    foot: { x: 12, y: 40 },
  },
  leftArm: {
    hip: { x: -10, y: 5 }, // 팔이 뒤로
    knee: { x: -20, y: 15 },
    foot: { x: -30, y: 25 },
  },
  rightArm: {
    hip: { x: 10, y: 5 }, // 팔이 뒤로
    knee: { x: 20, y: 15 },
    foot: { x: 30, y: 25 },
  },
};

/**
 * 왼쪽 방향 점프 준비 자세 (왼쪽으로 향하면서 다리 굽힘)
 */
const JUMP_PREPARE_LEFT_KEYFRAME: CharacterKeyframe = {
  time: 0.0,
  leftLeg: {
    hip: { x: -12, y: 15 },
    knee: { x: -18, y: 18 }, // 왼쪽 다리 더 많이 굽힘
    foot: { x: -15, y: 35 },
  },
  rightLeg: {
    hip: { x: 8, y: 15 },
    knee: { x: 12, y: 18 }, // 오른쪽 다리도 굽힘
    foot: { x: 10, y: 35 },
  },
  leftArm: {
    hip: { x: -12, y: 5 }, // 왼쪽 팔 더 뒤로
    knee: { x: -25, y: 12 },
    foot: { x: -35, y: 20 },
  },
  rightArm: {
    hip: { x: 8, y: 5 }, // 오른쪽 팔도 뒤로
    knee: { x: 15, y: 12 },
    foot: { x: 25, y: 20 },
  },
};

/**
 * 오른쪽 방향 점프 준비 자세 (오른쪽으로 향하면서 다리 굽힘)
 */
const JUMP_PREPARE_RIGHT_KEYFRAME: CharacterKeyframe = {
  time: 0.0,
  leftLeg: {
    hip: { x: -8, y: 15 },
    knee: { x: -12, y: 18 }, // 왼쪽 다리 굽힘
    foot: { x: -10, y: 35 },
  },
  rightLeg: {
    hip: { x: 12, y: 15 },
    knee: { x: 18, y: 18 }, // 오른쪽 다리 더 많이 굽힘
    foot: { x: 15, y: 35 },
  },
  leftArm: {
    hip: { x: -8, y: 5 }, // 왼쪽 팔 뒤로
    knee: { x: -15, y: 12 },
    foot: { x: -25, y: 20 },
  },
  rightArm: {
    hip: { x: 12, y: 5 }, // 오른쪽 팔 더 뒤로
    knee: { x: 25, y: 12 },
    foot: { x: 35, y: 20 },
  },
};

/**
 * 점프 발사 자세 (다리가 펴지면서 뛰는 순간)
 */
const JUMP_LAUNCH_KEYFRAME: CharacterKeyframe = {
  time: 0.3,
  leftLeg: {
    hip: { x: -10, y: 10 },
    knee: { x: -8, y: 35 }, // 다리가 쭉 펴짐
    foot: { x: -5, y: 45 },
  },
  rightLeg: {
    hip: { x: 10, y: 10 },
    knee: { x: 8, y: 35 }, // 다리가 쭉 펴짐
    foot: { x: 5, y: 45 },
  },
  leftArm: {
    hip: { x: -10, y: 0 }, // 팔이 위로
    knee: { x: -15, y: -10 },
    foot: { x: -20, y: -15 },
  },
  rightArm: {
    hip: { x: 10, y: 0 }, // 팔이 위로
    knee: { x: 15, y: -10 },
    foot: { x: 20, y: -15 },
  },
};

/**
 * 왼쪽 방향 점프 발사 자세 (왼쪽으로 향하면서 발사)
 */
const JUMP_LAUNCH_LEFT_KEYFRAME: CharacterKeyframe = {
  time: 0.3,
  leftLeg: {
    hip: { x: -12, y: 10 },
    knee: { x: -10, y: 35 }, // 왼쪽 다리 더 많이 펴짐
    foot: { x: -8, y: 45 },
  },
  rightLeg: {
    hip: { x: 8, y: 10 },
    knee: { x: 6, y: 35 }, // 오른쪽 다리도 펴짐
    foot: { x: 3, y: 45 },
  },
  leftArm: {
    hip: { x: -12, y: 0 }, // 왼쪽 팔 더 위로
    knee: { x: -18, y: -12 },
    foot: { x: -25, y: -18 },
  },
  rightArm: {
    hip: { x: 8, y: 0 }, // 오른쪽 팔도 위로
    knee: { x: 12, y: -8 },
    foot: { x: 15, y: -12 },
  },
};

/**
 * 오른쪽 방향 점프 발사 자세 (오른쪽으로 향하면서 발사)
 */
const JUMP_LAUNCH_RIGHT_KEYFRAME: CharacterKeyframe = {
  time: 0.3,
  leftLeg: {
    hip: { x: -8, y: 10 },
    knee: { x: -6, y: 35 }, // 왼쪽 다리 펴짐
    foot: { x: -3, y: 45 },
  },
  rightLeg: {
    hip: { x: 12, y: 10 },
    knee: { x: 10, y: 35 }, // 오른쪽 다리 더 많이 펴짐
    foot: { x: 8, y: 45 },
  },
  leftArm: {
    hip: { x: -8, y: 0 }, // 왼쪽 팔 위로
    knee: { x: -12, y: -8 },
    foot: { x: -15, y: -12 },
  },
  rightArm: {
    hip: { x: 12, y: 0 }, // 오른쪽 팔 더 위로
    knee: { x: 18, y: -12 },
    foot: { x: 25, y: -18 },
  },
};

/**
 * 공중 자세 (점프 최고점)
 */
const JUMP_AIRBORNE_KEYFRAME: CharacterKeyframe = {
  time: 0.6,
  leftLeg: {
    hip: { x: -10, y: 10 },
    knee: { x: -8, y: 15 }, // 무릎이 약간 올라감
    foot: { x: -5, y: 25 },
  },
  rightLeg: {
    hip: { x: 10, y: 10 },
    knee: { x: 8, y: 15 }, // 무릎이 약간 올라감
    foot: { x: 5, y: 25 },
  },
  leftArm: {
    hip: { x: -10, y: 0 },
    knee: { x: -12, y: 5 }, // 팔이 자연스럽게
    foot: { x: -15, y: 10 },
  },
  rightArm: {
    hip: { x: 10, y: 0 },
    knee: { x: 12, y: 5 }, // 팔이 자연스럽게
    foot: { x: 15, y: 10 },
  },
};

/**
 * 낙하 자세
 */
const FALL_KEYFRAME: CharacterKeyframe = {
  time: 0.0,
  leftLeg: {
    hip: { x: -10, y: 10 },
    knee: { x: -8, y: 30 }, // 다리가 약간 펴짐
    foot: { x: -5, y: 35 },
  },
  rightLeg: {
    hip: { x: 10, y: 10 },
    knee: { x: 8, y: 30 }, // 다리가 약간 펴짐
    foot: { x: 5, y: 35 },
  },
  leftArm: {
    hip: { x: -10, y: 0 },
    knee: { x: -15, y: 8 }, // 팔이 균형잡기 위해 벌어짐
    foot: { x: -25, y: 15 },
  },
  rightArm: {
    hip: { x: 10, y: 0 },
    knee: { x: 15, y: 8 }, // 팔이 균형잡기 위해 벌어짐
    foot: { x: 25, y: 15 },
  },
};

/**
 * 착지 준비 자세
 */
const LAND_PREPARE_KEYFRAME: CharacterKeyframe = {
  time: 0.0,
  leftLeg: {
    hip: { x: -10, y: 10 },
    knee: { x: -12, y: 25 }, // 무릎이 구부러져서 충격 흡수 준비
    foot: { x: -10, y: 38 },
  },
  rightLeg: {
    hip: { x: 10, y: 10 },
    knee: { x: 12, y: 25 }, // 무릎이 구부러져서 충격 흡수 준비
    foot: { x: 10, y: 38 },
  },
  leftArm: {
    hip: { x: -10, y: 0 },
    knee: { x: -18, y: 12 }, // 팔이 균형잡기 위해
    foot: { x: -30, y: 20 },
  },
  rightArm: {
    hip: { x: 10, y: 0 },
    knee: { x: 18, y: 12 }, // 팔이 균형잡기 위해
    foot: { x: 30, y: 20 },
  },
};

/**
 * 착지 순간 자세 (충격 흡수)
 */
const LAND_IMPACT_KEYFRAME: CharacterKeyframe = {
  time: 0.3,
  leftLeg: {
    hip: { x: -10, y: 15 },
    knee: { x: -15, y: 20 }, // 무릎이 많이 구부러져서 충격 흡수
    foot: { x: -12, y: 40 },
  },
  rightLeg: {
    hip: { x: 10, y: 15 },
    knee: { x: 15, y: 20 }, // 무릎이 많이 구부러져서 충격 흡수
    foot: { x: 12, y: 40 },
  },
  leftArm: {
    hip: { x: -10, y: 5 },
    knee: { x: -20, y: 15 }, // 팔이 아래로
    foot: { x: -25, y: 25 },
  },
  rightArm: {
    hip: { x: 10, y: 5 },
    knee: { x: 20, y: 15 }, // 팔이 아래로
    foot: { x: 25, y: 25 },
  },
};

/**
 * 착지 후 회복 자세 (천천히 일어나는 자세)
 */
const LAND_RECOVERY_KEYFRAME: CharacterKeyframe = {
  time: 2.0, // 더 오래 지속되도록 시간 증가
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
 * 점프 애니메이션 (땅에서 뛰어오르는 전체 과정)
 */
export const jumpAnimation: Animation = {
  name: "jump",
  duration: 0.6,
  loop: false,
  keyframes: [
    JUMP_PREPARE_KEYFRAME,
    JUMP_LAUNCH_KEYFRAME,
    JUMP_AIRBORNE_KEYFRAME,
  ],
  priority: 40,
};

/**
 * 왼쪽 방향 점프 애니메이션 (왼쪽으로 향하면서 점프)
 */
export const jumpLeftAnimation: Animation = {
  name: "jump-left",
  duration: 0.6,
  loop: false,
  keyframes: [
    JUMP_PREPARE_LEFT_KEYFRAME,
    JUMP_LAUNCH_LEFT_KEYFRAME,
    JUMP_AIRBORNE_KEYFRAME,
  ],
  priority: 40,
};

/**
 * 오른쪽 방향 점프 애니메이션 (오른쪽으로 향하면서 점프)
 */
export const jumpRightAnimation: Animation = {
  name: "jump-right",
  duration: 0.6,
  loop: false,
  keyframes: [
    JUMP_PREPARE_RIGHT_KEYFRAME,
    JUMP_LAUNCH_RIGHT_KEYFRAME,
    JUMP_AIRBORNE_KEYFRAME,
  ],
  priority: 40,
};

/**
 * 낙하 애니메이션 (공중에서 떨어지는 상태)
 */
export const fallAnimation: Animation = {
  name: "fall",
  duration: 1.0,
  loop: true,
  keyframes: [
    FALL_KEYFRAME,
    {
      ...FALL_KEYFRAME,
      time: 0.5,
      // 약간의 흔들림 (바람 저항)
      leftArm: {
        ...FALL_KEYFRAME.leftArm,
        knee: {
          x: FALL_KEYFRAME.leftArm.knee.x - 2,
          y: FALL_KEYFRAME.leftArm.knee.y + 1,
        },
      },
      rightArm: {
        ...FALL_KEYFRAME.rightArm,
        knee: {
          x: FALL_KEYFRAME.rightArm.knee.x + 2,
          y: FALL_KEYFRAME.rightArm.knee.y + 1,
        },
      },
    },
    {
      ...FALL_KEYFRAME,
      time: 1.0,
    },
  ],
  priority: 35,
};

/**
 * 착지 애니메이션 (천천히 회복)
 */
export const landAnimation: Animation = {
  name: "land",
  duration: 1.2, // 더 오래 지속되도록 시간 증가
  loop: false,
  keyframes: [
    LAND_PREPARE_KEYFRAME,
    LAND_IMPACT_KEYFRAME,
    LAND_RECOVERY_KEYFRAME,
  ],
  priority: 45,
};

/**
 * 특정 시간에서의 점프 관련 키프레임 계산
 */
export function getJumpKeyframeAtTime(
  animationType: "jump" | "fall" | "land",
  time: number,
  direction?: "left" | "right" | "center"
): CharacterKeyframe {
  let animation: Animation;

  switch (animationType) {
    case "jump":
      if (direction === "left") {
        animation = jumpLeftAnimation;
      } else if (direction === "right") {
        animation = jumpRightAnimation;
      } else {
        animation = jumpAnimation;
      }
      break;
    case "fall":
      animation = fallAnimation;
      break;
    case "land":
      animation = landAnimation;
      break;
  }

  const cycle = animation.loop
    ? (time % animation.duration) / animation.duration
    : Math.min(time / animation.duration, 1.0);

  // 키프레임 보간
  const keyframes = animation.keyframes;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const current = keyframes[i];
    const next = keyframes[i + 1];

    if (cycle >= current.time && cycle <= next.time) {
      const t = (cycle - current.time) / (next.time - current.time);
      return interpolateKeyframe(current, next, t);
    }
  }

  return keyframes[keyframes.length - 1];
}

/**
 * 키프레임 보간 함수
 */
function interpolateKeyframe(
  start: CharacterKeyframe,
  end: CharacterKeyframe,
  t: number
): CharacterKeyframe {
  return {
    time: start.time + (end.time - start.time) * t,
    leftLeg: interpolateLimb(start.leftLeg, end.leftLeg, t),
    rightLeg: interpolateLimb(start.rightLeg, end.rightLeg, t),
    leftArm: interpolateLimb(start.leftArm, end.leftArm, t),
    rightArm: interpolateLimb(start.rightArm, end.rightArm, t),
  };
}

function interpolateLimb(start: any, end: any, t: number) {
  return {
    hip: {
      x: start.hip.x + (end.hip.x - start.hip.x) * t,
      y: start.hip.y + (end.hip.y - start.hip.y) * t,
    },
    knee: {
      x: start.knee.x + (end.knee.x - start.knee.x) * t,
      y: start.knee.y + (end.knee.y - start.knee.y) * t,
    },
    foot: {
      x: start.foot.x + (end.foot.x - start.foot.x) * t,
      y: start.foot.y + (end.foot.y - start.foot.y) * t,
    },
  };
}

/**
 * 점프 관련 애니메이션 컬렉션
 */
export const JumpAnimations = {
  jump: jumpAnimation,
  "jump-left": jumpLeftAnimation,
  "jump-right": jumpRightAnimation,
  fall: fallAnimation,
  land: landAnimation,
} as const;

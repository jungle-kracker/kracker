// src/game/animations/keyframes/walk.keyframes.ts

import { Animation, CharacterKeyframe } from "../types";

/**
 * 걷기 애니메이션 키프레임들
 * 4단계로 구성된 자연스러운 걸음 사이클
 */
const WALKING_KEYFRAMES: CharacterKeyframe[] = [
  // 0.0: 왼쪽 다리 앞(굽힘), 오른쪽 다리 뒤(같은 방향 꺾임) - 극한 앞뒤 배치
  {
    time: 0.0,
    leftLeg: {
      hip: { x: -10, y: 10 },
      knee: { x: -6, y: 15 }, // 앞다리 무릎 굽힘
      foot: { x: -6, y: 25 }, // 앞다리 발 더 앞으로 (극한)
    },
    rightLeg: {
      hip: { x: 10, y: 10 },
      knee: { x: 4, y: 20 }, // 뒷다리 무릎 같은 방향 꺾임
      foot: { x: 6, y: 35 }, // 뒷다리 발 더 뒤로 (극한)
    },
    leftArm: {
      hip: { x: -10, y: 0 },
      knee: { x: -20, y: 5 }, // 왼쪽 팔 앞으로
      foot: { x: -30, y: 12 },
    },
    rightArm: {
      hip: { x: 10, y: 0 },
      knee: { x: 25, y: 8 }, // 오른쪽 팔 뒤로
      foot: { x: 35, y: 15 },
    },
  },

  // 0.25: 왼쪽 다리 들어올림 (공중) - 극한 앞뒤 배치
  {
    time: 0.25,
    leftLeg: {
      hip: { x: -10, y: 8 }, // 엉덩이가 약간 올라감
      knee: { x: -4, y: 10 }, // 무릎 앞으로 올라옴
      foot: { x: -4, y: 15 }, // 발 더 앞으로 (극한)
    },
    rightLeg: {
      hip: { x: 10, y: 10 },
      knee: { x: 6, y: 25 }, // 지지하는 다리 자연스럽게 꺾임
      foot: { x: 8, y: 35 }, // 지지하는 발 더 뒤로 (극한)
    },
    leftArm: {
      hip: { x: -10, y: 0 },
      knee: { x: -15, y: 3 }, // 팔이 앞으로
      foot: { x: -25, y: 8 },
    },
    rightArm: {
      hip: { x: 10, y: 0 },
      knee: { x: 25, y: 8 }, // 팔이 뒤로
      foot: { x: 40, y: 15 },
    },
  },

  // 0.5: 오른쪽 다리 앞(굽힘), 왼쪽 다리 뒤(같은 방향 꺾임) - 극한 앞뒤 배치
  {
    time: 0.5,
    leftLeg: {
      hip: { x: -10, y: 10 },
      knee: { x: -4, y: 20 }, // 뒷다리 무릎 같은 방향 꺾임
      foot: { x: -6, y: 35 }, // 뒷다리 발 더 뒤로 (극한)
    },
    rightLeg: {
      hip: { x: 10, y: 10 },
      knee: { x: 6, y: 15 }, // 앞다리 무릎 굽힘
      foot: { x: 6, y: 25 }, // 앞다리 발 더 앞으로 (극한)
    },
    leftArm: {
      hip: { x: -10, y: 0 },
      knee: { x: -25, y: 8 }, // 팔이 뒤로
      foot: { x: -35, y: 15 },
    },
    rightArm: {
      hip: { x: 10, y: 0 },
      knee: { x: 20, y: 5 }, // 팔이 앞으로
      foot: { x: 30, y: 12 },
    },
  },

  // 0.75: 오른쪽 다리 들어올림 (공중) - 극한 앞뒤 배치
  {
    time: 0.75,
    leftLeg: {
      hip: { x: -10, y: 10 },
      knee: { x: -6, y: 25 }, // 지지하는 다리 자연스럽게 꺾임
      foot: { x: -8, y: 35 }, // 지지하는 발 더 뒤로 (극한)
    },
    rightLeg: {
      hip: { x: 10, y: 8 }, // 엉덩이가 약간 올라감
      knee: { x: 4, y: 10 }, // 무릎 앞으로 올라옴
      foot: { x: 4, y: 15 }, // 발 더 앞으로 (극한)
    },
    leftArm: {
      hip: { x: -10, y: 0 },
      knee: { x: -25, y: 8 }, // 팔이 뒤로
      foot: { x: -40, y: 15 },
    },
    rightArm: {
      hip: { x: 10, y: 0 },
      knee: { x: 15, y: 3 }, // 팔이 앞으로
      foot: { x: 25, y: 8 },
    },
  },
];

/**
 * 걷기 애니메이션
 */
export const walkingAnimation: Animation = {
  name: "walking",
  duration: 0.8, // 0.8초로 한 걸음 사이클
  loop: true,
  keyframes: WALKING_KEYFRAMES,
  blendable: true,
  priority: 10,
};

/**
 * 역동적인 달리기 애니메이션
 */
export const runningAnimation: Animation = {
  name: "running",
  duration: 0.4, // 더 빠른 사이클
  loop: true,
  keyframes: [
    // 0.0: 왼쪽 다리 앞(굽힘), 오른쪽 다리 뒤(같은 방향 꺾임) - 극한 앞뒤 배치
    {
      time: 0.0,
      leftLeg: {
        hip: { x: -12, y: 8 },
        knee: { x: -8, y: 12 }, // 앞다리 무릎 굽힘
        foot: { x: -8, y: 18 }, // 앞다리 발 더 앞으로 (극한)
      },
      rightLeg: {
        hip: { x: 12, y: 8 },
        knee: { x: 6, y: 15 }, // 뒷다리 무릎 같은 방향 꺾임
        foot: { x: 8, y: 25 }, // 뒷다리 발 더 뒤로 (극한)
      },
      leftArm: {
        hip: { x: -12, y: -2 },
        knee: { x: -25, y: 0 }, // 왼쪽 팔 앞으로
        foot: { x: -35, y: 5 },
      },
      rightArm: {
        hip: { x: 12, y: -2 },
        knee: { x: 28, y: 2 }, // 오른쪽 팔 뒤로
        foot: { x: 40, y: 8 },
      },
    },

    // 0.25: 왼쪽 다리 들어올림 (공중) - 극한 앞뒤 배치
    {
      time: 0.25,
      leftLeg: {
        hip: { x: -12, y: 5 }, // 엉덩이 올라감
        knee: { x: -5, y: 8 }, // 무릎 앞으로 올라옴
        foot: { x: -5, y: 12 }, // 발 더 앞으로 (극한)
      },
      rightLeg: {
        hip: { x: 12, y: 8 },
        knee: { x: 8, y: 18 }, // 지지하는 다리 자연스럽게 꺾임
        foot: { x: 10, y: 28 }, // 지지하는 발 더 뒤로 (극한)
      },
      leftArm: {
        hip: { x: -12, y: -2 },
        knee: { x: -20, y: -3 }, // 팔 앞으로
        foot: { x: -28, y: 0 },
      },
      rightArm: {
        hip: { x: 12, y: -2 },
        knee: { x: 32, y: 5 }, // 팔 뒤로
        foot: { x: 45, y: 12 },
      },
    },

    // 0.5: 오른쪽 다리 앞(굽힘), 왼쪽 다리 뒤(같은 방향 꺾임) - 극한 앞뒤 배치
    {
      time: 0.5,
      leftLeg: {
        hip: { x: -12, y: 8 },
        knee: { x: -6, y: 15 }, // 뒷다리 무릎 같은 방향 꺾임
        foot: { x: -8, y: 25 }, // 뒷다리 발 더 뒤로 (극한)
      },
      rightLeg: {
        hip: { x: 12, y: 8 },
        knee: { x: 8, y: 12 }, // 앞다리 무릎 굽힘
        foot: { x: 8, y: 18 }, // 앞다리 발 더 앞으로 (극한)
      },
      leftArm: {
        hip: { x: -12, y: -2 },
        knee: { x: -28, y: 2 }, // 팔 뒤로
        foot: { x: -40, y: 8 },
      },
      rightArm: {
        hip: { x: 12, y: -2 },
        knee: { x: 25, y: 0 }, // 팔 앞으로
        foot: { x: 35, y: 5 },
      },
    },

    // 0.75: 오른쪽 다리 들어올림 (공중) - 극한 앞뒤 배치
    {
      time: 0.75,
      leftLeg: {
        hip: { x: -12, y: 8 },
        knee: { x: -8, y: 18 }, // 지지하는 다리 자연스럽게 꺾임
        foot: { x: -10, y: 28 }, // 지지하는 발 더 뒤로 (극한)
      },
      rightLeg: {
        hip: { x: 12, y: 5 }, // 엉덩이 올라감
        knee: { x: 5, y: 8 }, // 무릎 앞으로 올라옴
        foot: { x: 5, y: 12 }, // 발 더 앞으로 (극한)
      },
      leftArm: {
        hip: { x: -12, y: -2 },
        knee: { x: -32, y: 5 }, // 팔 뒤로
        foot: { x: -45, y: 12 },
      },
      rightArm: {
        hip: { x: 12, y: -2 },
        knee: { x: 20, y: -3 }, // 팔 앞으로
        foot: { x: 28, y: 0 },
      },
    },
  ],
  blendable: true,
  priority: 15,
};

/**
 * 특정 시간에서의 걷기 키프레임 계산 함수
 */
export function getWalkingKeyframeAtTime(
  time: number,
  isRunning: boolean = false
): CharacterKeyframe {
  const animation = isRunning ? runningAnimation : walkingAnimation;
  const cycle = (time % animation.duration) / animation.duration; // 0-1 사이로 정규화

  // 현재 시간에 해당하는 키프레임 찾기
  const keyframes = animation.keyframes;

  for (let i = 0; i < keyframes.length; i++) {
    const current = keyframes[i];
    const next = keyframes[(i + 1) % keyframes.length];
    const nextTime = next.time === 0 ? 1.0 : next.time; // 마지막 키프레임 처리

    if (cycle >= current.time && cycle <= nextTime) {
      const t = (cycle - current.time) / (nextTime - current.time);
      return interpolateKeyframe(current, next, t);
    }
  }

  return keyframes[0];
}

/**
 * 두 키프레임 사이의 보간
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
 * 걷기 애니메이션 컬렉션
 */
export const WalkingAnimations = {
  walk: walkingAnimation,
  run: runningAnimation,
} as const;

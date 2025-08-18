// src/game/config.tsx
export const GAME_CONFIG = {
  // 동적 크기 지원 - 초기값만 설정하고 실시간으로는 window 객체 사용
  get width(): number {
    return window.innerWidth;
  },
  get height(): number {
    return window.innerHeight;
  },
  // GAME_CONFIG 안에 예시
  bullet: {
    speed: 2000, // 기본 총알 속도
    gravityY: 1000, // 총알 개별 중력 (Y)
    gravityX: 100, // 필요하면 X도
    useWorldGravity: false, // true면 world.gravity 사용
    alignToVelocity: true, // 속도 방향으로 회전
    tailEnabled: true, // 불꼬리 on/off
    radius: 20,
  },

  // 고정 게임 설정들
  playerSpeed: 300,
  jumpSpeed: 900,
  gravity: 2000,
  backgroundColor: "#1a4a3a",
  platformColor: "#c0c0c0",

  // 맵 기본 크기 (맵 데이터가 없을 때 사용)
  defaultMapWidth: 1280,
  defaultMapHeight: 640,

  // 카메라 설정
  cameraLerpFactor: 0.08,
  cameraDeadzoneWidth: 100,
  cameraDeadzoneHeight: 60,
} as const;

// ⭐ 캐릭터 색상 프리셋
export const CHARACTER_PRESETS = {
  기본: {
    head: 0xffe680, // 살색
    limbs: 0xffcc66, // 팔다리 살색
    gun: 0x333333, // 기본 검정 총
  },
  빨간색: {
    head: 0xd76a6a, // 빨간 머리
    limbs: 0xee9841, // 어두운 빨강 팔다리
    gun: 0xd76a6a, // 다크 레드 총
  },
  주황색: {
    head: 0xee9841, // 주황 머리
    limbs: 0xe4882c, // 어두운 주황 팔다리
    gun: 0xee9841, // 브라운 총
  },
  초록색: {
    head: 0x5a945b, // 초록 머리
    limbs: 0x478248, // 어두운 초록 팔다리
    gun: 0x5a945b, // 다크 그린 총
  },
  파란색: {
    head: 0x196370, // 파란 머리
    limbs: 0x0e4751, // 어두운 파랑 팔다리
    gun: 0x196370, // 다크 블루 총
  },
  보라색: {
    head: 0x6c3faf, // 보라 머리
    limbs: 0x4c208e, // 어두운 보라 팔다리
    gun: 0x6c3faf, // 다크 퍼플 총
  },
  핑크색: {
    head: 0xdf749d, // 핑크 머리
    limbs: 0xb74772, // 어두운 핑크 팔다리
    gun: 0xdf749d, // 다크 핑크 총
  },
} as const;

export type CharacterPreset = keyof typeof CHARACTER_PRESETS;

export interface PlayerState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  health: number;
  isGrounded: boolean;
  isJumping: boolean;
  isShooting: boolean;
  facingDirection: "left" | "right";
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  damage: number;
}

// 유틸리티 함수들
export const GameUtils = {
  /** 현재 화면 크기 가져오기 */
  getScreenSize(): { width: number; height: number } {
    return {
      width: GAME_CONFIG.width,
      height: GAME_CONFIG.height,
    };
  },

  /** 화면 비율 계산 */
  getAspectRatio(): number {
    return GAME_CONFIG.width / GAME_CONFIG.height;
  },

  /** 맵 크기에 맞는 스케일 계산 */
  calculateMapScale(
    mapWidth: number,
    mapHeight: number
  ): {
    scale: number;
    scaledWidth: number;
    scaledHeight: number;
    offsetX: number;
    offsetY: number;
  } {
    const screenWidth = GAME_CONFIG.width;
    const screenHeight = GAME_CONFIG.height;

    // 맵이 화면에 맞도록 스케일 계산 (aspect ratio 유지)
    const scaleX = screenWidth / mapWidth;
    const scaleY = screenHeight / mapHeight;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = mapWidth * scale;
    const scaledHeight = mapHeight * scale;

    // 중앙 정렬을 위한 오프셋
    const offsetX = (screenWidth - scaledWidth) / 2;
    const offsetY = (screenHeight - scaledHeight) / 2;

    return {
      scale,
      scaledWidth,
      scaledHeight,
      offsetX,
      offsetY,
    };
  },

  getResponsiveFontSize(baseSize: number = 16): number {
    const minSize = 12;
    const maxSize = 24;
    const baseWidth = 1920;

    const scaleFactor = GAME_CONFIG.width / baseWidth;
    const fontSize = baseSize * scaleFactor;

    return Math.max(minSize, Math.min(maxSize, fontSize));
  },

  getResponsiveSize(baseSize: number): number {
    const baseWidth = 1920;
    const scaleFactor = GAME_CONFIG.width / baseWidth;
    return Math.max(baseSize * 0.5, baseSize * scaleFactor);
  },

  getCharacterPreset(preset: CharacterPreset = "기본") {
    return CHARACTER_PRESETS[preset];
  },

  getAllPresets(): CharacterPreset[] {
    return Object.keys(CHARACTER_PRESETS) as CharacterPreset[];
  },

  hexToNumber(hex: string): number {
    return parseInt(hex.replace("#", ""), 16);
  },

  numberToHex(num: number): string {
    return `#${num.toString(16).padStart(6, "0").toUpperCase()}`;
  },
};

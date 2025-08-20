// src/game/GameScene.ts - NetworkManager 통합된 멀티플레이어 GameScene
import { Platform, Bullet } from "./config";
import Player from "./player/Player";
import MapRenderer from "./MapRenderer";
import { MapLoader } from "./maps/MapLoader";
import { ParticleSystem } from "./particle";
import { CollisionSystem } from "./systems/CollisionSystem";
import { NetworkManager } from "./managers/NetworkManager"; // ☆ 네트워크 매니저 추가

// ☆ 캐릭터 렌더링 관련 import 추가
import { createCharacter, destroyCharacter } from "./render/character.core";
import { getIdleKeyframeAtTime } from "./animations/keyframes/idle.keyframes";
import { CharacterColors, GfxRefs, PlayerState } from "./types/player.types";
import { LimbKeyframe } from "./animations/types/animation.types";

// 디버그 시스템
import { Debug, debugManager } from "./debug/DebugManager";
import { LogCategory } from "./debug/Logger";

// 매니저들
import { InputManager } from "./managers/InputManager";
import { UIManager } from "./managers/UIManager";
import { CameraManager } from "./managers/CameraManager";
import { ShadowManager } from "./managers/ShadowManager";
import { ShootingManager } from "./managers/ShootingManager";

// 상수 및 설정
import {
  GAME_SETTINGS,
  UI_CONSTANTS,
  PLAYER_CONSTANTS,
  CAMERA_CONSTANTS,
  PERFORMANCE_CONSTANTS,
  GAME_STATE,
  MapKey,
  ColorPresetKey,
  ShadowPresetKey,
  SceneState,
} from "./config/GameConstants";

// 멀티플레이어 타입 정의
interface GamePlayer {
  id: string;
  name: string;
  team: number;
  color: string;
  isMe: boolean;
}

interface GameData {
  players: GamePlayer[];
  myPlayerId: string;
  room: {
    roomId: string;
    gameMode: string;
    roomName: string;
  };
  startTime: number;
}

// ☆ 원격 플레이어 타입 수정 (그래픽 참조 포함)
interface RemotePlayer {
  id: string;
  name: string;
  team: number;
  color: string;
  gfxRefs: GfxRefs; // ☆ 핵심: 그래픽 참조 저장
  lastPosition: { x: number; y: number };
  lastUpdate: number;
  isVisible: boolean;
  interpolation: {
    targetX: number;
    targetY: number;
    currentX: number;
    currentY: number;
    targetVX: number;
    targetVY: number;
  };
  networkState: {
    isGrounded: boolean;
    isJumping: boolean;
    isCrouching: boolean;
    isWallGrabbing: boolean;
    facing: "left" | "right";
    health: number;
  };
}

export default class GameScene extends Phaser.Scene {
  // 기본 게임 요소들
  private player!: Player;
  private platforms: Platform[] = [];
  private bullets: Bullet[] = [];
  private mapRenderer!: MapRenderer;
  private particleSystem!: ParticleSystem;
  private bulletGroup!: Phaser.Physics.Arcade.Group;
  private platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  private collisionSystem!: CollisionSystem;

  // ☆ 멀티플레이어 관련
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private myPlayerId: string | null = null;
  private gameData: GameData | null = null;
  private isMultiplayer: boolean = false;
  private networkManager!: NetworkManager; // ☆ 네트워크 매니저 추가

  // 매니저들
  private inputManager!: InputManager;
  private uiManager!: UIManager;
  private cameraManager!: CameraManager;
  private shadowManager!: ShadowManager;
  private shootingManager!: ShootingManager;

  // 씬 상태 관리
  private currentMapKey: MapKey = GAME_SETTINGS.DEFAULT_MAP as MapKey;
  private sceneState: SceneState = GAME_STATE.SCENE_STATES.LOADING;
  private isInitialized: boolean = false;

  // 퍼포먼스 모니터링
  private performanceTimer: number = 0;
  private frameCount: number = 0;

  constructor() {
    super({ key: "GameScene" });
  }

  //멀티관련 
  private pendingMultiplayerData: GameData | null = null;

  preload(): void {
    Debug.log.info(LogCategory.SCENE, "에셋 프리로드 시작");
    this.load.svg("jungleBg", "/mapJungle-Bg.svg");
    // 추가 에셋들...
    Debug.log.info(LogCategory.SCENE, "에셋 프리로드 완료");
  }

  async create(data?: {
    mapKey?: MapKey;
    platforms?: Platform[];
    bullets?: Bullet[];
    spawn?: { x: number; y: number };
  }): Promise<void> {
    Debug.log.info(LogCategory.SCENE, "GameScene 생성 시작");
    this.sceneState = GAME_STATE.SCENE_STATES.LOADING;

    try {
      // 디버그 매니저 초기화
      debugManager.initialize(this);

      // 맵 로더 초기화
      await Debug.measureAsync("기본 맵 초기화", async () => {
        await MapLoader.initializeDefaultMaps();
      });

      // 기본 설정
      this.cameras.main.setBackgroundColor(
        GAME_SETTINGS.RENDER.BACKGROUND_COLOR
      );

      // 맵 시스템 초기화
      await this.initializeMapSystem(data?.mapKey);

      // Physics Groups 초기화
      this.initializePhysicsGroups();

      // ☆ 네트워크 매니저 초기화
      this.networkManager = new NetworkManager(this);
      this.setupNetworkCallbacks();

      // 매니저들 초기화 (순서 중요)
      await this.initializeManagers();

      // 플레이어 생성
      this.createPlayer(data?.spawn);
      this.player.setCollisionSystem(this.collisionSystem);
      this.collisionSystem.setPlayer(this.player);

      // 사격 시스템과 플레이어 연결
      this.shootingManager.setPlayer(this.player);

      // 추가 데이터 처리
      this.processAdditionalData(data);

      // 파티클 시스템 초기화
      this.particleSystem = new ParticleSystem(this, true);

      this.sceneState = GAME_STATE.SCENE_STATES.RUNNING;
      this.isInitialized = true;


      // 대기열에 멀티플레이 초기화 데이터가 있으면 지금 처리
      if (this.pendingMultiplayerData) {
        const queued = this.pendingMultiplayerData;
        this.pendingMultiplayerData = null;
        this.initializeMultiplayer(queued);
      }

      Debug.log.info(LogCategory.SCENE, "GameScene 생성 완료");
    } catch (error) {
      this.sceneState = GAME_STATE.SCENE_STATES.ERROR;
      this.handleError(error as Error, "씬 생성");
    }
  }

  // ☆ 네트워크 콜백 설정
  private setupNetworkCallbacks(): void {
    // 플레이어 움직임 수신
    this.networkManager.onPlayerMove((playerId, movement) => {
      this.handleRemotePlayerMovement(playerId, movement);
    });

    // 플레이어 사격 수신
    this.networkManager.onPlayerShoot((playerId, shootData) => {
      this.handleRemotePlayerShoot(playerId, shootData);
    });

    // 이알 충돌 수신
    this.networkManager.onBulletHit((hitData) => {
      this.handleBulletHit(hitData);
    });

    // 게임 이벤트 수신
    this.networkManager.onGameEvent((event) => {
      this.handleGameEvent(event);
    });

    // 플레이어 입장/퇴장
    this.networkManager.onPlayerJoin((playerData) => {
      this.handlePlayerJoin(playerData);
    });

    this.networkManager.onPlayerLeave((playerId) => {
      this.handlePlayerLeave(playerId);
    });

    console.log("🌐 네트워크 콜백 설정 완료");
  }

  // ☆ 원격 플레이어 움직임 처리
  private handleRemotePlayerMovement(playerId: string, movement: any): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (!remotePlayer) return;

    // 네트워크 상태 업데이트
    remotePlayer.networkState = {
      isGrounded: movement.isGrounded,
      isJumping: movement.isJumping,
      isCrouching: movement.isCrouching,
      isWallGrabbing: movement.isWallGrabbing,
      facing: movement.facing,
      health: movement.health,
    };

    // 보간 타겟 설정
    remotePlayer.interpolation.targetX = movement.x;
    remotePlayer.interpolation.targetY = movement.y;
    remotePlayer.interpolation.targetVX = movement.vx;
    remotePlayer.interpolation.targetVY = movement.vy;
    remotePlayer.lastUpdate = Date.now();

    // 위치 즉시 업데이트 (부드러운 보간은 update에서 처리)
    remotePlayer.lastPosition = { x: movement.x, y: movement.y };
  }

  // ☆ 원격 플레이어 사격 처리
  private handleRemotePlayerShoot(playerId: string, shootData: any): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (!remotePlayer) return;

    // 사격 파티클 효과
    this.createParticleEffect(shootData.gunX, shootData.gunY, false);

    // 원격 플레이어가 사격하는 방향으로 향하도록
    const deltaX = shootData.x - remotePlayer.lastPosition.x;
    remotePlayer.networkState.facing = deltaX < 0 ? "left" : "right";

    console.log(
      `🔫 원격 플레이어 ${remotePlayer.name} 사격: (${shootData.x}, ${shootData.y})`
    );
  }

  // ☆ 이알 충돌 처리
  private handleBulletHit(hitData: any): void {
    // 충돌 파티클 효과
    this.createParticleEffect(hitData.x, hitData.y, true);

    // 타겟이 내 플레이어인 경우 데미지 적용
    if (hitData.targetPlayerId === this.myPlayerId) {
      this.player.takeDamage(hitData.damage);

      // 카메라 흔들기
      this.shakeCamera(200, 0.01);

      console.log(`💥 내가 이알에 맞음! 데미지: ${hitData.damage}`);
    }
  }

  // ☆ 게임 이벤트 처리
  private handleGameEvent(event: any): void {
    switch (event.type) {
      case "damage":
        // 다른 플레이어가 데미지를 받음
        break;
      case "heal":
        // 다른 플레이어가 힐을 받음
        break;
      case "respawn":
        // 다른 플레이어가 리스폰
        const remotePlayer = this.remotePlayers.get(event.playerId);
        if (remotePlayer) {
          remotePlayer.lastPosition = { x: event.data.x, y: event.data.y };
          remotePlayer.networkState.health = 100; // 풀피로 리스폰
        }
        break;
    }

    console.log(`🎯 게임 이벤트 수신: ${event.type} from ${event.playerId}`);
  }

  // ☆ 플레이어 입장 처리
  private handlePlayerJoin(playerData: any): void {
    console.log(`👋 새 플레이어 입장: ${playerData.name}`);
    this.createRemotePlayer(playerData);
  }

  // ☆ 플레이어 퇴장 처리
  private handlePlayerLeave(playerId: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      console.log(`👋 플레이어 퇴장: ${remotePlayer.name}`);

      // ☆ 그래픽 오브젝트들 제거
      if (remotePlayer.gfxRefs) {
        destroyCharacter(remotePlayer.gfxRefs);
      }

      this.remotePlayers.delete(playerId);
    }
  }

  // ☆ 멀티플레이어 초기화 메서드 (네트워크 연결 추가)
  public initializeMultiplayer(gameData: GameData): void {

    if (!this.isInitialized || !this.networkManager) {
      this.pendingMultiplayerData = gameData;
      console.log("⏳ Scene not ready. Queued multiplayer init.");
      return;
    }

    console.log("🎮 멀티플레이어 초기화:", gameData);

    this.gameData = gameData;
    this.myPlayerId = gameData.myPlayerId;
    this.isMultiplayer = true;

    // ⭐ 네트워크 매니저 초기화
    this.networkManager.initialize(gameData.room.roomId, gameData.myPlayerId);

    // ⭐ 내 플레이어 데이터 찾기
    const myPlayerData = gameData.players.find((p) => p.id === this.myPlayerId);

    // 다른 플레이어들 생성
    gameData.players.forEach((playerData) => {
      if (playerData.id !== this.myPlayerId) {
        this.createRemotePlayer(playerData);
      }
    });

    // ⭐ 내 플레이어 설정
    if (myPlayerData) {
      this.setupMyPlayer(myPlayerData);
    }

    // UI에 플레이어 정보 표시
    this.updateMultiplayerUI();

    console.log(
      `✅ 멀티플레이어 초기화 완료 - 총 ${gameData.players.length}명`
    );
  }

  // 새로운 메서드
  private setupMyPlayer(playerData: GamePlayer): void {
    const spawns = this.mapRenderer.getSpawns();

    // 스폰 포인트 선택
    let spawnPoint;
    if (this.gameData?.room.gameMode === "팀전") {
      spawnPoint =
        spawns.find((s) => s.name === (playerData.team === 1 ? "A" : "B")) ||
        spawns[0];
    } else {
      spawnPoint = spawns[playerData.team - 1] || spawns[0];
    }

    // ⭐ 플레이어가 없으면 생성
    if (!this.player) {
      // 플레이어 생성 로직 (기존 create 메서드에서 플레이어 생성 부분 참조)
      console.log("🔧 플레이어가 없어서 새로 생성합니다.");
      // this.createPlayer(); // 플레이어 생성 메서드 호출
    }

    // ⭐ 스폰 위치 설정
    if (this.player && spawnPoint) {
      this.player.setPosition(spawnPoint.x, spawnPoint.y);
      console.log(`✅ 내 플레이어 스폰: (${spawnPoint.x}, ${spawnPoint.y})`);
    }

    // 색상 설정
    this.setMyPlayerColor(playerData.color);
  }

  // ☆ 원격 플레이어 생성 (완전히 새로운 구현)
  private createRemotePlayer(playerData: GamePlayer): void {
    const spawns = this.mapRenderer.getSpawns();

    // 팀별 스폰 포인트 선택
    let spawnPoint;
    if (this.gameData?.room.gameMode === "팀전") {
      spawnPoint =
        spawns.find((s) => s.name === (playerData.team === 1 ? "A" : "B")) ||
        spawns[0];
    } else {
      spawnPoint = spawns[playerData.team - 1] || spawns[0];
    }

    // ☆ 핵심: 캐릭터 그래픽 생성
    const characterColors: CharacterColors = {
      head: this.parsePlayerColor(playerData.color),
      limbs: this.parsePlayerColor(playerData.color),
      gun: 0x333333,
    };

    // ☆ createCharacter 함수로 실제 그래픽 오브젝트들 생성
    const gfxRefs = createCharacter(
      this,
      spawnPoint.x,
      spawnPoint.y,
      characterColors
    );

    // 원격 플레이어 객체 생성
    const remotePlayer: RemotePlayer = {
      id: playerData.id,
      name: playerData.name,
      team: playerData.team,
      color: playerData.color,
      gfxRefs: gfxRefs, // ☆ 그래픽 참조 저장
      lastPosition: { x: spawnPoint.x, y: spawnPoint.y },
      lastUpdate: Date.now(),
      isVisible: true,
      interpolation: {
        targetX: spawnPoint.x,
        targetY: spawnPoint.y,
        currentX: spawnPoint.x,
        currentY: spawnPoint.y,
        targetVX: 0,
        targetVY: 0,
      },
      networkState: {
        isGrounded: true,
        isJumping: false,
        isCrouching: false,
        isWallGrabbing: false,
        facing: "right",
        health: 100,
      },
    };

    // Map에 저장
    this.remotePlayers.set(playerData.id, remotePlayer);

    console.log(
      `✅ 원격 플레이어 ${playerData.name} 캐릭터 생성됨 at (${spawnPoint.x}, ${spawnPoint.y})`
    );
  }

  // ☆ 내 플레이어 색상 설정
  private setMyPlayerColor(color: string): void {
    if (color && color !== "#888888") {
      const colorPreset = this.hexToColorPreset(color);
      this.player.setColorPreset(colorPreset);
      console.log(`🎨 내 플레이어 색상 설정: ${color} -> ${colorPreset}`);
    }
  }

  // ☆ 색상 코드를 프리셋으로 변환
  private hexToColorPreset(hexColor: string): ColorPresetKey {
    const colorMap: { [key: string]: ColorPresetKey } = {
      "#D76A6A": "빨간색",
      "#EE9841": "주황색",
      "#5A945B": "초록색",
      "#196370": "파란색",
      "#6C3FAF": "보라색",
      "#DF749D": "핑크색",
    };

    return colorMap[hexColor.toUpperCase()] || "기본";
  }

  // ☆ 멀티플레이어 UI 업데이트
  private updateMultiplayerUI(): void {
    if (!this.gameData || !this.uiManager) return;

    const playerCount = this.gameData.players.length;
    const roomName = this.gameData.room.roomName;

    console.log(
      `📄 멀티플레이어 UI 업데이트: ${playerCount}명, 방: ${roomName}`
    );
  }

  // ☆ 원격 플레이어들 업데이트
  private updateRemotePlayers(deltaTime: number): void {
    this.remotePlayers.forEach((remotePlayer) => {
      // 보간 처리
      this.interpolateRemotePlayer(remotePlayer, deltaTime);

      // 애니메이션 렌더링
      this.renderRemotePlayerAnimation(remotePlayer);
    });
  }

  // ☆ 원격 플레이어 위치 보간
  private interpolateRemotePlayer(
    remotePlayer: RemotePlayer,
    deltaTime: number
  ): void {
    const interpolation = remotePlayer.interpolation;
    const lerpFactor = Math.min(deltaTime * 0.008, 1); // 부드러운 보간

    // 현재 위치를 타겟으로 서서히 이동
    interpolation.currentX +=
      (interpolation.targetX - interpolation.currentX) * lerpFactor;
    interpolation.currentY +=
      (interpolation.targetY - interpolation.currentY) * lerpFactor;

    // 실제 위치 업데이트
    remotePlayer.lastPosition = {
      x: interpolation.currentX,
      y: interpolation.currentY,
    };
  }

  // ☆ 원격 플레이어 애니메이션 렌더링
  private renderRemotePlayerAnimation(remotePlayer: RemotePlayer): void {
    const refs = remotePlayer.gfxRefs;
    if (!refs) {
      console.warn(`⚠️ ${remotePlayer.name}의 gfxRefs가 없습니다`);
      return;
    }

    const { x, y } = remotePlayer.lastPosition;
    const facing = remotePlayer.networkState.facing;

    console.log(
      `🎨 ${remotePlayer.name} 렌더링: (${x}, ${y}), facing: ${facing}`
    );

    // ⭐ 몸통 위치 업데이트
    if (refs.body) {
      refs.body.setPosition(x, y);
      refs.body.setVisible(true); // 확실히 보이게 설정
      console.log(`  - 몸통 업데이트됨: (${x}, ${y})`);
    }

    // 나머지 렌더링...
    this.renderSimpleLimbs(refs, x, y, facing, remotePlayer.color);
    this.renderFace(refs.face, x, y, facing);

    // HP바 처리...
    if (remotePlayer.networkState.health < 100) {
      this.renderHealthBar(refs, x, y, remotePlayer.networkState.health);
    } else {
      if (refs.hpBarBg) refs.hpBarBg.setVisible(false);
      if (refs.hpBarFill) refs.hpBarFill.setVisible(false);
    }
  }

  // ⭐ 간단한 팔다리 렌더링 메서드 추가
  private renderSimpleLimbs(
    refs: GfxRefs,
    x: number,
    y: number,
    facing: "left" | "right",
    color: string
  ): void {
    const limbColor = this.parsePlayerColor(color);
    const direction = facing === "right" ? 1 : -1;

    // 왼팔
    if (refs.leftArm) {
      refs.leftArm.clear();
      refs.leftArm.lineStyle(3, limbColor);
      refs.leftArm.beginPath();
      refs.leftArm.moveTo(x - 10 * direction, y - 5);
      refs.leftArm.lineTo(x - 15 * direction, y + 5);
      refs.leftArm.lineTo(x - 20 * direction, y + 15);
      refs.leftArm.strokePath();
    }

    // 오른팔
    if (refs.rightArm) {
      refs.rightArm.clear();
      refs.rightArm.lineStyle(3, limbColor);
      refs.rightArm.beginPath();
      refs.rightArm.moveTo(x + 10 * direction, y - 5);
      refs.rightArm.lineTo(x + 15 * direction, y + 5);
      refs.rightArm.lineTo(x + 20 * direction, y + 15);
      refs.rightArm.strokePath();
    }

    // 왼다리
    if (refs.leftLeg) {
      refs.leftLeg.clear();
      refs.leftLeg.lineStyle(3, limbColor);
      refs.leftLeg.beginPath();
      refs.leftLeg.moveTo(x - 8, y + 15);
      refs.leftLeg.lineTo(x - 12, y + 25);
      refs.leftLeg.lineTo(x - 10, y + 35);
      refs.leftLeg.strokePath();
    }

    // 오른다리
    if (refs.rightLeg) {
      refs.rightLeg.clear();
      refs.rightLeg.lineStyle(3, limbColor);
      refs.rightLeg.beginPath();
      refs.rightLeg.moveTo(x + 8, y + 15);
      refs.rightLeg.lineTo(x + 12, y + 25);
      refs.rightLeg.lineTo(x + 10, y + 35);
      refs.rightLeg.strokePath();
    }
  }

  // ☆ 신체 부위 렌더링 헬퍼
  private renderLimb(
    limbGfx: any,
    bodyX: number,
    bodyY: number,
    keyframe: LimbKeyframe,
    color: string
  ): void {
    if (!limbGfx) return;

    limbGfx.clear();
    limbGfx.lineStyle(3, this.parsePlayerColor(color));

    // 어깨/엉덩이 → 팔꿈치/무릎 → 손/발 순으로 그리기
    limbGfx.beginPath();
    limbGfx.moveTo(bodyX + keyframe.hip.x, bodyY + keyframe.hip.y);
    limbGfx.lineTo(bodyX + keyframe.knee.x, bodyY + keyframe.knee.y);
    limbGfx.lineTo(bodyX + keyframe.foot.x, bodyY + keyframe.foot.y);
    limbGfx.strokePath();
  }

  // ☆ 얼굴 렌더링
  private renderFace(
    faceGfx: any,
    x: number,
    y: number,
    facing: "left" | "right"
  ): void {
    if (!faceGfx) return;

    faceGfx.clear();
    faceGfx.fillStyle(0x000000);

    // 눈 그리기
    const eyeOffset = facing === "right" ? 5 : -5;
    faceGfx.fillCircle(x - eyeOffset, y - 5, 2); // 왼쪽 눈
    faceGfx.fillCircle(x + eyeOffset, y - 5, 2); // 오른쪽 눈
  }

  // ☆ HP바 렌더링
  private renderHealthBar(
    refs: GfxRefs,
    x: number,
    y: number,
    health: number
  ): void {
    if (!refs.hpBarBg || !refs.hpBarFill) return;

    const barWidth = 40;
    const barHeight = 4;
    const barY = y - 35;

    // 배경
    refs.hpBarBg.clear();
    refs.hpBarBg.fillStyle(0x000000, 0.7);
    refs.hpBarBg.fillRect(x - barWidth / 2, barY, barWidth, barHeight);
    refs.hpBarBg.setVisible(true);

    // 체력바
    refs.hpBarFill.clear();
    const healthColor =
      health > 60 ? 0x00ff00 : health > 30 ? 0xffff00 : 0xff0000;
    refs.hpBarFill.fillStyle(healthColor);
    const fillWidth = (barWidth * health) / 100;
    refs.hpBarFill.fillRect(x - barWidth / 2, barY, fillWidth, barHeight);
    refs.hpBarFill.setVisible(true);
  }

  // ☆ 색상 파싱 헬퍼
  private parsePlayerColor(colorStr: string): number {
    if (typeof colorStr === "string" && colorStr.startsWith("#")) {
      return parseInt(colorStr.slice(1), 16);
    }
    return 0x4a90e2; // 기본 파란색
  }

  // 맵 시스템 초기화
  private async initializeMapSystem(mapKey?: MapKey): Promise<void> {
    this.mapRenderer = new MapRenderer(this);
    this.currentMapKey = mapKey || (GAME_SETTINGS.DEFAULT_MAP as MapKey);

    try {
      await Debug.measureAsync("맵 로드", async () => {
        await this.mapRenderer.loadMapPreset(this.currentMapKey);
      });
      this.platforms = this.mapRenderer.getPlatforms();
    } catch (error) {
      Debug.log.error(
        LogCategory.MAP,
        `Failed to load map ${this.currentMapKey}`,
        error
      );
    }

    Debug.log.info(
      LogCategory.MAP,
      `맵 '${this.currentMapKey}' 로드 완료, 플랫폼 수: ${this.platforms.length}`
    );
  }

  // 매니저들 초기화
  private async initializeManagers(): Promise<void> {
    Debug.log.info(LogCategory.SCENE, "매니저 초기화 시작");

    // 카메라 매니저
    this.cameraManager = new CameraManager(this, {
      follow: {
        enabled: true,
        lerpX: CAMERA_CONSTANTS.FOLLOW.LERP_X,
        lerpY: CAMERA_CONSTANTS.FOLLOW.LERP_Y,
        deadzone: {
          width: CAMERA_CONSTANTS.FOLLOW.DEADZONE_WIDTH,
          height: CAMERA_CONSTANTS.FOLLOW.DEADZONE_HEIGHT,
        },
        offset: {
          x: CAMERA_CONSTANTS.FOLLOW.OFFSET_X,
          y: CAMERA_CONSTANTS.FOLLOW.OFFSET_Y,
        },
      },
      zoom: {
        default: CAMERA_CONSTANTS.ZOOM.DEFAULT,
        min: CAMERA_CONSTANTS.ZOOM.MIN,
        max: CAMERA_CONSTANTS.ZOOM.MAX,
        smooth: true,
        duration: CAMERA_CONSTANTS.ZOOM.SMOOTH_DURATION,
      },
      effects: {
        atmospheric: {
          enabled: false,
          intensity: 0.8,
          speed: 1.0,
        },
      },
    });

    const mapSize = this.mapRenderer.getMapSize();
    this.cameraManager.setBoundsToMap(mapSize);

    // UI 매니저
    this.uiManager = new UIManager(this, {
      position: {
        x: UI_CONSTANTS.POSITION.MARGIN,
        y: UI_CONSTANTS.POSITION.MARGIN,
        margin: UI_CONSTANTS.POSITION.LINE_HEIGHT,
      },
      styles: {
        defaultFont: UI_CONSTANTS.STYLES.DEFAULT_FONT,
        titleFont: UI_CONSTANTS.STYLES.TITLE_FONT,
        backgroundColor: UI_CONSTANTS.STYLES.BACKGROUND_COLOR,
        textColors: {
          title: UI_CONSTANTS.COLORS.WHITE,
          instruction: UI_CONSTANTS.COLORS.YELLOW,
          debug: UI_CONSTANTS.COLORS.ORANGE,
          status: UI_CONSTANTS.COLORS.GREEN,
          shadow: UI_CONSTANTS.COLORS.CYAN,
        },
        padding: {
          x: UI_CONSTANTS.POSITION.PADDING_X,
          y: UI_CONSTANTS.POSITION.PADDING_Y,
        },
      },
    });
    this.uiManager.initialize();

    // 그림자 매니저
    this.shadowManager = new ShadowManager(this, this.mapRenderer);
    this.shadowManager.initialize();

    // ☆ 사격 매니저 초기화 (네트워크 연동)
    this.shootingManager = new ShootingManager(this, {
      fireRate: 300,
      damage: 25,
      accuracy: 0.95,
      recoil: 2.0,
      muzzleVelocity: 1000,
      magazineSize: 6,
      reloadTime: 1000,
      burstCount: 1,
      burstDelay: 100,
    });
    this.shootingManager.initialize();

    (this.shootingManager as any)?.setCollisionSystem?.(this.collisionSystem);

    // 사격 시스템 충돌 설정
    this.shootingManager.setupCollisions(this.platformGroup);

    // ☆ 사격 이벤트 콜백 설정 (네트워크 전송 추가)
    this.setupShootingCallbacks();

    // 입력 매니저 (마지막에 초기화 - 콜백 연결 후)
    this.inputManager = new InputManager(this);
    this.setupInputCallbacks();
    this.inputManager.initialize();

    // UI 상태 업데이트
    this.updateAllUI();

    Debug.log.info(LogCategory.SCENE, "매니저 초기화 완료");
  }

  // ☆ 사격 시스템 콜백 설정 (네트워크 전송 추가)
  private setupShootingCallbacks(): void {
    // ☆ 사격시 네트워크로 전송
    this.shootingManager.onShot((recoil) => {
      if (this.isMultiplayer && this.player) {
        const gunPos = this.player.getGunPosition();
        const shootData = {
          x: gunPos.x,
          y: gunPos.y,
          angle: gunPos.angle,
          gunX: gunPos.x,
          gunY: gunPos.y,
        };

        this.networkManager.sendShoot(shootData);
      }

      Debug.log.debug(LogCategory.GAME, `사격 반동: ${recoil}`);
    });

    // 재장전시 로그
    this.shootingManager.onReload(() => {
      Debug.log.info(LogCategory.GAME, "재장전 시작");
    });

    // ☆ 명중시 네트워크로 충돌 데이터 전송
    this.shootingManager.onHit((x, y) => {
      this.createParticleEffect(x, y, false);

      // 충돌 지점에서 플레이어 검색
      const hitPlayerId = this.findPlayerAtPosition(x, y);
      if (hitPlayerId && this.isMultiplayer) {
        this.networkManager.sendBulletHit({
          bulletId: `bullet_${Date.now()}`,
          targetPlayerId: hitPlayerId,
          x: x,
          y: y,
          damage: 25,
        });
      }

      Debug.log.debug(LogCategory.GAME, `이알 명중: (${x}, ${y})`);
    });
  }

  // ☆ 특정 위치에서 플레이어 찾기
  private findPlayerAtPosition(x: number, y: number): string | null {
    // 내 플레이어 체크
    const myBounds = this.player.getBounds();
    if (
      x >= myBounds.x &&
      x <= myBounds.x + myBounds.width &&
      y >= myBounds.y &&
      y <= myBounds.y + myBounds.height
    ) {
      return this.myPlayerId;
    }

    // 원격 플레이어들 체크 (ES5 호환)
    const playerIds = Array.from(this.remotePlayers.keys());
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      const remotePlayer = this.remotePlayers.get(playerId);
      if (!remotePlayer) continue;

      // 원격 플레이어는 gfxRefs의 body 위치로 판정
      const body = remotePlayer.gfxRefs.body;
      if (body) {
        const bounds = {
          x: body.x - 20, // 몸통 반지름
          y: body.y - 20,
          width: 40,
          height: 40,
        };

        if (
          x >= bounds.x &&
          x <= bounds.x + bounds.width &&
          y >= bounds.y &&
          y <= bounds.y + bounds.height
        ) {
          return playerId;
        }
      }
    }

    return null;
  }

  private initializePhysicsGroups(): void {
    Debug.log.info(LogCategory.SCENE, "Physics Groups 초기화 시작");

    // 이알 그룹 생성
    this.bulletGroup = this.physics.add.group({
      runChildUpdate: true,
      allowGravity: true,
    });

    // 플랫폼 그룹 생성
    this.platformGroup = this.physics.add.staticGroup();

    // 플랫폼들을 Physics Group에 추가
    this.platforms.forEach((platform, index) => {
      const rect = this.add.rectangle(
        platform.x + platform.width / 2,
        platform.y + platform.height / 2,
        platform.width,
        platform.height,
        0x00ff00,
        Debug.isEnabled() ? 0.2 : 0
      );

      this.physics.add.existing(rect, true);
      const body = rect.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(platform.width, platform.height);
      body.setOffset(0, 0);
      body.updateFromGameObject();
      this.platformGroup.add(rect);
    });

    // CollisionSystem 생성
    this.collisionSystem = new CollisionSystem(
      this,
      this.bulletGroup,
      this.platformGroup
    );

    (this as any).__collisionSystem = this.collisionSystem;

    console.log(
      `✅ Physics Groups 초기화 완료: bullets=${this.bulletGroup.children.size}, platforms=${this.platformGroup.children.size}`
    );
  }

  private createPlayer(spawnData?: { x: number; y: number }): void {
    const spawns = this.mapRenderer.getSpawns();
    const defaultSpawn =
      spawns.length > 0 ? spawns[0] : PLAYER_CONSTANTS.DEFAULT_SPAWN;
    const spawnX = spawnData?.x ?? defaultSpawn.x;
    const spawnY = spawnData?.y ?? defaultSpawn.y;

    this.player = new Player(this, spawnX, spawnY, this.platforms, "기본");
    this.cameraManager.setFollowTarget(this.player as any);
  }

  private processAdditionalData(data?: any): void {
    if (!data) return;

    if (data.platforms) {
      this.platforms.push(...data.platforms);
      Debug.log.debug(
        LogCategory.MAP,
        `추가 플랫폼 ${data.platforms.length}개 로드됨`
      );
    }

    if (data.bullets) {
      this.bullets.push(...data.bullets);
      Debug.log.debug(
        LogCategory.GAME,
        `추가 이알 ${data.bullets.length}개 로드됨`
      );
    }
  }

  private setupInputCallbacks(): void {
    // 맵 전환 콜백
    this.inputManager.onMapChange(async (mapKey: string) => {
      await this.switchMap(mapKey as MapKey);
    });

    // 색상 변경 콜백
    this.inputManager.onColorChange((color: string) => {
      const colorKey = this.getColorPresetKey(color);
      (this.player as any)?.setColorPreset?.(colorKey);
      Debug.log.info(LogCategory.PLAYER, "색상 변경", color);
    });

    // 그림자 콜백들
    this.inputManager.onShadowAngleChange((angle: number) => {
      this.shadowManager.setLightAngle(angle);
    });

    this.inputManager.onShadowAnimate(() => {
      this.shadowManager.startDayCycleAnimation();
    });

    this.inputManager.onShadowToggle(() => {
      this.shadowManager.toggleShadows();
    });

    this.inputManager.onShadowPreset((preset: string) => {
      this.shadowManager.applyPreset(preset as ShadowPresetKey);
    });

    this.inputManager.onShadowTest((testType: string) => {
      this.shadowManager.performTest(testType);
    });

    // UI 업데이트 콜백
    this.inputManager.onUIUpdate(() => {
      this.updateAllUI();
    });

    Debug.log.debug(LogCategory.INPUT, "입력 콜백 설정 완료");
  }

  private getColorPresetKey(colorName: string): ColorPresetKey {
    const colorMap: { [key: string]: ColorPresetKey } = {
      빨간색: "빨간색",
      주황색: "주황색",
      초록색: "초록색",
      파란색: "파란색",
      보라색: "보라색",
      핑크색: "핑크색",
      기본: "기본",
    };

    return colorMap[colorName] || "기본";
  }

  update(time: number, deltaTime: number): void {
    if (
      !this.isInitialized ||
      this.sceneState !== GAME_STATE.SCENE_STATES.RUNNING
    ) {
      return;
    }

    const dt = deltaTime / 1000;

    // 플레이어 업데이트
    if (this.player && this.player.update) {
      this.player.update(deltaTime);

      // ☆ 멀티플레이어 모드에서 내 플레이어 움직임 전송
      if (this.isMultiplayer) {
        this.sendMyPlayerMovement();
      }
    }

    // ☆ 원격 플레이어들 업데이트 및 보간
    this.updateRemotePlayers(deltaTime);

    // 그림자 시스템 업데이트
    if (this.mapRenderer) {
      this.mapRenderer.updateShadows();
    }

    // 사격 시스템 업데이트
    if (this.shootingManager) {
      this.shootingManager.update();
    }

    // 게임 로직 업데이트
    this.updateGameLogic();

    // 퍼포먼스 모니터링
    this.updatePerformanceMonitoring(time, deltaTime);

    // 주기적 작업들
    this.updatePeriodicTasks(time, deltaTime);
  }

  // ☆ 내 플레이어 움직임 네트워크 전송
  private sendMyPlayerMovement(): void {
    if (!this.player || !this.networkManager) return;

    const playerState = this.player.getState();
    const movementData = {
      x: playerState.position.x,
      y: playerState.position.y,
      vx: playerState.velocity.x,
      vy: playerState.velocity.y,
      facing: playerState.facingDirection,
      isGrounded: playerState.isGrounded,
      isJumping: playerState.isJumping,
      isCrouching: playerState.isCrouching,
      isWallGrabbing: playerState.isWallGrabbing,
      health: this.player.getHealth(),
    };

    this.networkManager.sendPlayerMovement(movementData);
  }

  private updateGameLogic(): void {
    this.cullBulletsOutsideViewport();
    this.clampPlayerInsideWorld();
  }

  private updatePerformanceMonitoring(time: number, deltaTime: number): void {
    this.frameCount++;

    // 경고 임계값 체크
    if (deltaTime > PERFORMANCE_CONSTANTS.UPDATE_INTERVALS.EVERY_FRAME) {
      const fps = 1000 / deltaTime;

      if (fps < PERFORMANCE_CONSTANTS.MIN_FPS) {
        Debug.log.warn(
          LogCategory.PERFORMANCE,
          `낮은 FPS 감지: ${fps.toFixed(1)}fps (${deltaTime.toFixed(1)}ms)`
        );
      }
    }
  }

  private updatePeriodicTasks(time: number, deltaTime: number): void {
    // 5초마다 게임 상태 로깅
    if (
      Debug.isEnabled() &&
      time % PERFORMANCE_CONSTANTS.UPDATE_INTERVALS.EVERY_5_SECONDS < deltaTime
    ) {
      Debug.logGameState(this.player, this.cameraManager.getCameraInfo(), {
        key: this.currentMapKey,
        size: this.mapRenderer?.getMapSize(),
        platforms: this.platforms,
      });
    }

    // 10초마다 메모리 체크
    if (
      time % PERFORMANCE_CONSTANTS.UPDATE_INTERVALS.EVERY_10_SECONDS <
      deltaTime
    ) {
      debugManager.checkMemoryUsage();
    }
  }

  private updateAllUI(): void {
    if (!this.uiManager) return;

    // 맵 상태 업데이트
    const currentMap = this.mapRenderer?.getCurrentMap();
    if (currentMap) {
      this.uiManager.updateMapStatus(
        this.currentMapKey,
        currentMap.meta.name || currentMap.meta.key
      );
    }

    // 그림자 상태 업데이트
    const shadowStatus = this.shadowManager?.getShadowStatus();
    if (shadowStatus?.config) {
      this.uiManager.updateShadowStatus(shadowStatus.config);
    }

    Debug.log.trace(LogCategory.UI, "모든 UI 업데이트됨");
  }

  // 맵 전환
  private async switchMap(mapKey: MapKey): Promise<void> {
    if (mapKey === this.currentMapKey) return;

    if (!GAME_SETTINGS.AVAILABLE_MAPS.includes(mapKey)) {
      Debug.log.error(LogCategory.MAP, `유효하지 않은 맵: ${mapKey}`);
      return;
    }

    Debug.log.info(
      LogCategory.MAP,
      `맵 전환: ${this.currentMapKey} -> ${mapKey}`
    );
    this.sceneState = GAME_STATE.SCENE_STATES.TRANSITION;

    try {
      // 맵 전환
      this.currentMapKey = mapKey;
      await Debug.measureAsync("맵 전환", async () => {
        await this.mapRenderer?.loadMapPreset(mapKey);
      });
      this.platforms = this.mapRenderer?.getPlatforms() || [];

      // 카메라 바운드 업데이트
      const mapSize = this.mapRenderer.getMapSize();
      this.cameraManager.setBoundsToMap(mapSize);

      // 플레이어 위치 리셋
      this.resetPlayerPosition();

      // 그림자 강제 업데이트
      this.shadowManager.forceUpdate();

      // UI 업데이트
      this.updateAllUI();

      this.sceneState = GAME_STATE.SCENE_STATES.RUNNING;
      Debug.log.info(LogCategory.MAP, `맵 전환 완료: ${mapKey}`);
    } catch (error) {
      this.sceneState = GAME_STATE.SCENE_STATES.ERROR;
      Debug.log.error(LogCategory.MAP, `맵 전환 실패 (${mapKey})`, error);
    }
  }

  private resetPlayerPosition(): void {
    const spawns = this.mapRenderer?.getSpawns() || [];
    const playerSpawn =
      spawns.find((s) => s.name === "A") ||
      spawns[0] ||
      PLAYER_CONSTANTS.DEFAULT_SPAWN;

    if (this.player) {
      (this.player as any).setPosition?.(playerSpawn.x, playerSpawn.y);
      (this.player as any).resetVelocity?.();
      (this.player as any).updatePlatforms?.(this.platforms);
    }
  }

  private cullBulletsOutsideViewport(): void {
    const cameraInfo = this.cameraManager.getCameraInfo();
    const buffer = PERFORMANCE_CONSTANTS.CLEANUP.BULLET_BUFFER;

    const bounds = {
      left: cameraInfo.x - buffer,
      right: cameraInfo.x + cameraInfo.width + buffer,
      top: cameraInfo.y - buffer,
      bottom: cameraInfo.y + cameraInfo.height + buffer,
    };

    const initialCount = this.bullets.length;
    this.bullets = this.bullets.filter((bullet) => {
      const inBounds =
        bullet.x >= bounds.left &&
        bullet.x <= bounds.right &&
        bullet.y >= bounds.top &&
        bullet.y <= bounds.bottom;

      if (!inBounds && "gameObject" in bullet && bullet.gameObject) {
        (bullet.gameObject as any).destroy();
      }

      return inBounds;
    });

    if (this.bullets.length !== initialCount) {
      Debug.log.trace(
        LogCategory.PERFORMANCE,
        `이알 정리: ${initialCount - this.bullets.length}개 제거`
      );
    }

    // 최대 이알 수 제한
    if (this.bullets.length > PERFORMANCE_CONSTANTS.CLEANUP.MAX_BULLETS) {
      const excess =
        this.bullets.length - PERFORMANCE_CONSTANTS.CLEANUP.MAX_BULLETS;
      this.bullets.splice(0, excess).forEach((bullet) => {
        if ("gameObject" in bullet && bullet.gameObject) {
          (bullet.gameObject as any).destroy();
        }
      });
      Debug.log.warn(
        LogCategory.PERFORMANCE,
        `최대 이알 수 초과로 ${excess}개 강제 제거`
      );
    }
  }

  private clampPlayerInsideWorld(): void {
    if (!this.player) return;

    const mapSize = this.mapRenderer.getMapSize();

    let px = this.getPlayerX();
    let py = this.getPlayerY();
    let clamped = false;

    // X축 경계 체크
    if (px - PLAYER_CONSTANTS.SIZE.HALF_WIDTH < 0) {
      px = PLAYER_CONSTANTS.SIZE.HALF_WIDTH;
      clamped = true;
    } else if (px + PLAYER_CONSTANTS.SIZE.HALF_WIDTH > mapSize.width) {
      px = mapSize.width - PLAYER_CONSTANTS.SIZE.HALF_WIDTH;
      clamped = true;
    }

    // Y축 경계 체크
    if (py - PLAYER_CONSTANTS.SIZE.HALF_HEIGHT < 0) {
      py = PLAYER_CONSTANTS.SIZE.HALF_HEIGHT;
      clamped = true;
    } else if (py + PLAYER_CONSTANTS.SIZE.HALF_HEIGHT > mapSize.height) {
      py = mapSize.height - PLAYER_CONSTANTS.SIZE.HALF_HEIGHT;
      clamped = true;
    }

    if (clamped) {
      this.setPlayerPosition(px, py);
      this.stopPlayerVelocityAtBounds(px, py, mapSize);
    }
  }

  private stopPlayerVelocityAtBounds(
    px: number,
    py: number,
    mapSize: { width: number; height: number }
  ): void {
    const p: any = this.player;

    // 바닥 경계 Y
    const bottomY = mapSize.height - PLAYER_CONSTANTS.SIZE.HALF_HEIGHT;

    // 바닥에 닿은 순간: 데미지 + 위로 튕김, 그리고 경계선 바로 안쪽으로 위치 조정
    if (py >= bottomY) {
      (this.player as any).applyBottomBoundaryHit?.(0.3, 600); // 30%, 600px/s 튕김
      this.setPlayerPosition(px, bottomY - 1); // 경계선 살짝 위로
      return; // 아래 '속도 0' 로직 건너뜀
    }

    if (p.body) {
      // Phaser Physics Body
      if (px <= PLAYER_CONSTANTS.SIZE.HALF_WIDTH && p.body.velocity.x < 0) {
        p.body.setVelocityX(0);
      }
      if (
        px >= mapSize.width - PLAYER_CONSTANTS.SIZE.HALF_WIDTH &&
        p.body.velocity.x > 0
      ) {
        p.body.setVelocityX(0);
      }
      if (py <= PLAYER_CONSTANTS.SIZE.HALF_HEIGHT && p.body.velocity.y < 0) {
        p.body.setVelocityY(0);
      }
      if (
        py >= mapSize.height - PLAYER_CONSTANTS.SIZE.HALF_HEIGHT &&
        p.body.velocity.y > 0
      ) {
        p.body.setVelocityY(0);
      }
    } else {
      // 커스텀 속도 시스템
      if (p.vx !== undefined) {
        if (px <= PLAYER_CONSTANTS.SIZE.HALF_WIDTH && p.vx < 0) p.vx = 0;
        if (px >= mapSize.width - PLAYER_CONSTANTS.SIZE.HALF_WIDTH && p.vx > 0)
          p.vx = 0;
      }
      if (p.vy !== undefined) {
        if (py <= PLAYER_CONSTANTS.SIZE.HALF_HEIGHT && p.vy < 0) p.vy = 0;
        if (
          py >= mapSize.height - PLAYER_CONSTANTS.SIZE.HALF_HEIGHT &&
          p.vy > 0
        )
          p.vy = 0;
      }
      if (p.velocity) {
        if (px <= PLAYER_CONSTANTS.SIZE.HALF_WIDTH && p.velocity.x < 0)
          p.velocity.x = 0;
        if (
          px >= mapSize.width - PLAYER_CONSTANTS.SIZE.HALF_WIDTH &&
          p.velocity.x > 0
        )
          p.velocity.x = 0;
        if (py <= PLAYER_CONSTANTS.SIZE.HALF_HEIGHT && p.velocity.y < 0)
          p.velocity.y = 0;
        if (
          py >= mapSize.height - PLAYER_CONSTANTS.SIZE.HALF_HEIGHT &&
          p.velocity.y > 0
        )
          p.velocity.y = 0;
      }
    }
  }

  // 플레이어 위치 접근 헬퍼
  private getPlayerX(): number {
    if (!this.player) return PLAYER_CONSTANTS.DEFAULT_SPAWN.x;
    if (typeof this.player.getX === "function") return this.player.getX();
    if ((this.player as any).x !== undefined) return (this.player as any).x;
    return PLAYER_CONSTANTS.DEFAULT_SPAWN.x;
  }

  private getPlayerY(): number {
    if (!this.player) return PLAYER_CONSTANTS.DEFAULT_SPAWN.y;
    if (typeof this.player.getY === "function") return this.player.getY();
    if ((this.player as any).y !== undefined) return (this.player as any).y;
    return PLAYER_CONSTANTS.DEFAULT_SPAWN.y;
  }

  private setPlayerPosition(x: number, y: number): void {
    if (!this.player) return;
    if (typeof this.player.setPosition === "function") {
      this.player.setPosition(x, y);
    } else {
      const p = this.player as any;
      if (p.x !== undefined) p.x = x;
      if (p.y !== undefined) p.y = y;
    }
  }

  // ===== 공개 API 메서드들 =====
  public addPlatform(platform: Platform): void {
    this.platforms.push(platform);
    Debug.log.debug(LogCategory.MAP, "플랫폼 추가됨", platform);
  }

  public addBullet(bullet: Bullet): void {
    this.bullets.push(bullet);
    Debug.log.debug(LogCategory.GAME, "이알 추가됨", bullet);
  }

  public removeBullet(id: string): void {
    const bullet = this.bullets.find((b) => b.id === id);
    if (bullet && "gameObject" in bullet && bullet.gameObject) {
      (bullet.gameObject as any).destroy();
    }
    this.bullets = this.bullets.filter((b) => b.id !== id);
    Debug.log.debug(LogCategory.GAME, "이알 제거됨", { id });
  }

  // Getter 메서드들
  public getCamera() {
    return this.cameraManager.getCameraInfo();
  }
  public getPlayer(): Player {
    return this.player;
  }
  public getPlatforms(): Platform[] {
    return this.platforms;
  }
  public getBullets(): Bullet[] {
    return this.bullets;
  }
  public getMapRenderer(): MapRenderer {
    return this.mapRenderer;
  }
  public getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }
  public getCurrentMapKey(): MapKey {
    return this.currentMapKey;
  }
  public getSceneState(): SceneState {
    return this.sceneState;
  }

  // ☆ 멀티플레이어 관련 Getter들
  public getRemotePlayers(): Map<string, RemotePlayer> {
    return this.remotePlayers;
  }
  public getMyPlayerId(): string | null {
    return this.myPlayerId;
  }
  public getGameData(): GameData | null {
    return this.gameData;
  }
  public isMultiplayerMode(): boolean {
    return this.isMultiplayer;
  }
  public getNetworkManager(): NetworkManager {
    return this.networkManager;
  }

  // 매니저 접근자들
  public getInputManager(): InputManager {
    return this.inputManager;
  }
  public getUIManager(): UIManager {
    return this.uiManager;
  }
  public getCameraManager(): CameraManager {
    return this.cameraManager;
  }
  public getShadowManager(): ShadowManager {
    return this.shadowManager;
  }
  public getShootingManager(): ShootingManager {
    return this.shootingManager;
  }

  // 파티클 효과
  public createParticleEffect(
    x: number,
    y: number,
    fancy: boolean = false
  ): void {
    if (fancy) {
      this.particleSystem.createFancyParticleExplosion(x, y);
    } else {
      this.particleSystem.createParticleExplosion(x, y);
    }
    Debug.log.debug(LogCategory.PARTICLE, "파티클 효과 생성", { x, y, fancy });
  }

  // 맵 전환
  public async changeMap(mapKey: MapKey): Promise<void> {
    await this.switchMap(mapKey);
  }

  // UI 제어
  public toggleUI(): boolean {
    return this.uiManager.toggle();
  }
  public setUIVisible(visible: boolean): void {
    this.uiManager.setVisible(visible);
  }

  // 카메라 제어
  public panCameraTo(x: number, y: number, duration?: number): void {
    this.cameraManager.panTo(
      x,
      y,
      duration || CAMERA_CONSTANTS.PAN.DEFAULT_DURATION
    );
  }
  public shakeCamera(duration?: number, intensity?: number): void {
    this.cameraManager.shake(
      duration || CAMERA_CONSTANTS.SHAKE.DEFAULT_DURATION,
      intensity || CAMERA_CONSTANTS.SHAKE.DEFAULT_INTENSITY
    );
  }

  // 그림자 제어
  public setShadowPreset(preset: ShadowPresetKey): boolean {
    return this.shadowManager.applyPreset(preset);
  }
  public startShadowAnimation(): void {
    this.shadowManager.startDayCycleAnimation();
  }
  public stopShadowAnimation(): void {
    this.shadowManager.stopAnimation();
  }

  // 사격 시스템 제어
  public forceReload(): void {
    this.shootingManager?.forceReload();
  }

  public getAmmoStatus(): {
    current: number;
    max: number;
    isReloading: boolean;
  } {
    return (
      this.shootingManager?.getAmmoStatus() || {
        current: 0,
        max: 0,
        isReloading: false,
      }
    );
  }

  // 입력 제어
  public setInputEnabled(enabled: boolean): void {
    this.inputManager.setEnabled(enabled);
  }

  // 화면 크기 변경 처리
  public resize(width: number, height: number): void {
    Debug.log.info(LogCategory.SCENE, `씬 리사이즈: ${width}x${height}`);

    this.mapRenderer?.handleResize?.(width, height);
    this.cameraManager?.handleResize(width, height);
    this.uiManager?.handleResize(width, height);
    this.shadowManager?.handleResize(width, height);
    this.shootingManager?.handleResize(width, height);
  }

  // 게임 상태 관리
  public pauseGame(): void {
    this.scene.pause();
    this.setInputEnabled(false);
    this.sceneState = GAME_STATE.SCENE_STATES.PAUSED;
    Debug.log.info(LogCategory.SCENE, "게임 일시정지");
  }

  public resumeGame(): void {
    this.scene.resume();
    this.setInputEnabled(true);
    this.sceneState = GAME_STATE.SCENE_STATES.RUNNING;
    Debug.log.info(LogCategory.SCENE, "게임 재개");
  }

  public resetScene(): void {
    Debug.log.info(LogCategory.SCENE, "씬 리셋 시작");
    this.sceneState = GAME_STATE.SCENE_STATES.TRANSITION;

    // 현재 맵 다시 로드
    this.changeMap(this.currentMapKey);

    Debug.log.info(LogCategory.SCENE, "씬 리셋 완료");
  }

  // 디버그 정보
  public getDebugInfo() {
    return {
      scene: {
        currentMap: this.currentMapKey,
        state: this.sceneState,
        isInitialized: this.isInitialized,
        frameCount: this.frameCount,
        playerPosition: {
          x: this.getPlayerX(),
          y: this.getPlayerY(),
        },
        platformCount: this.platforms.length,
        bulletCount: this.bullets.length,
        mapSize: this.mapRenderer?.getMapSize(),
        shooting: this.shootingManager?.getAmmoStatus(),
        // ☆ 멀티플레이어 정보 추가
        multiplayer: {
          isEnabled: this.isMultiplayer,
          myPlayerId: this.myPlayerId,
          remotePlayerCount: this.remotePlayers.size,
          gameData: this.gameData,
          networkStatus: this.networkManager?.getNetworkStatus(),
        },
      },
      constants: {
        gameSettings: GAME_SETTINGS,
        availableMaps: GAME_SETTINGS.AVAILABLE_MAPS,
        playerConstants: PLAYER_CONSTANTS,
        performanceThresholds: PERFORMANCE_CONSTANTS,
      },
    };
  }

  // 개발자 도구
  public getDevTools() {
    if (!Debug.isEnabled()) {
      Debug.log.warn(
        LogCategory.SCENE,
        "개발자 도구는 디버그 모드에서만 사용 가능"
      );
      return null;
    }

    const shootingTools = this.shootingManager?.getDebugTools();
    const networkTools = this.networkManager?.getDevTools();

    return {
      // 기존 도구들
      teleportPlayer: (x: number, y: number) => {
        this.setPlayerPosition(x, y);
        Debug.log.debug(LogCategory.PLAYER, `플레이어 순간이동: (${x}, ${y})`);
      },

      spawnTestObjects: () => {
        for (let i = 0; i < 5; i++) {
          const x = Math.random() * 800 + 100;
          const y = Math.random() * 400 + 100;
          this.createParticleEffect(x, y, true);
        }
        Debug.log.debug(LogCategory.SCENE, "테스트 오브젝트들 생성됨");
      },

      stressTest: () => {
        for (let i = 0; i < 100; i++) {
          setTimeout(() => {
            const x = Math.random() * 1000;
            const y = Math.random() * 600;
            this.createParticleEffect(x, y, false);
          }, i * 50);
        }
        Debug.log.warn(
          LogCategory.PERFORMANCE,
          "스트레스 테스트 시작 - 성능 모니터링 필요"
        );
      },

      logFullState: () => {
        this.logAllDebugInfo();
        Debug.log.info(LogCategory.SCENE, "전체 상태 로깅 완료");
      },

      // ☆ 멀티플레이어 디버그 도구들
      listRemotePlayers: () => {
        console.log("=== 원격 플레이어 목록 ===");
        const playerIds = Array.from(this.remotePlayers.keys());
        for (let i = 0; i < playerIds.length; i++) {
          const playerId = playerIds[i];
          const remote = this.remotePlayers.get(playerId);
          if (!remote) continue;

          const pos = remote.lastPosition;
          console.log(
            `${remote.name} (${playerId}): 팀 ${remote.team
            }, 위치 (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), HP ${remote.networkState.health
            }`
          );
        }
        console.log(`총 ${this.remotePlayers.size}명의 원격 플레이어`);
      },

      simulateRemotePlayer: (x: number, y: number) => {
        const testId = "test_remote_" + Date.now();
        this.createRemotePlayer({
          id: testId,
          name: "테스트 플레이어",
          team: 1,
          color: "#FF0000",
          isMe: false,
        });
        if (x !== undefined && y !== undefined) {
          this.handleRemotePlayerMovement(testId, {
            x,
            y,
            vx: 0,
            vy: 0,
            facing: "right",
            isGrounded: true,
            isJumping: false,
            isCrouching: false,
            isWallGrabbing: false,
            health: 100,
          });
        }
        Debug.log.debug(
          LogCategory.SCENE,
          `테스트 원격 플레이어 생성: (${x}, ${y})`
        );
      },

      removeAllRemotePlayers: () => {
        const count = this.remotePlayers.size;
        const playerIds = Array.from(this.remotePlayers.keys());
        for (let i = 0; i < playerIds.length; i++) {
          this.handlePlayerLeave(playerIds[i]);
        }
        Debug.log.debug(LogCategory.SCENE, `${count}명의 원격 플레이어 제거됨`);
      },

      simulateBulletHit: (targetPlayerId?: string) => {
        const target = targetPlayerId || this.myPlayerId;
        if (target) {
          this.handleBulletHit({
            bulletId: "test_bullet_" + Date.now(),
            targetPlayerId: target,
            x: this.getPlayerX(),
            y: this.getPlayerY(),
            damage: 25,
          });
          Debug.log.debug(LogCategory.SCENE, `시뮬레이션 이알 충돌: ${target}`);
        }
      },

      forceNetworkSync: () => {
        if (this.isMultiplayer) {
          this.networkManager.forceSyncMovement({
            x: this.getPlayerX(),
            y: this.getPlayerY(),
            vx: 0,
            vy: 0,
            facing: "right",
            isGrounded: true,
            isJumping: false,
            isCrouching: false,
            isWallGrabbing: false,
            health: this.player.getHealth(),
          });
          Debug.log.debug(LogCategory.SCENE, "강제 네트워크 동기화 실행");
        }
      },

      // 사격 시스템 도구들 통합
      ...shootingTools,

      // ☆ 네트워크 도구들 통합
      ...networkTools,
    };
  }

  // 모든 매니저의 디버그 정보 출력
  public logAllDebugInfo(): void {
    Debug.log.info(LogCategory.SCENE, "=== COMPLETE GAME SCENE DEBUG INFO ===");

    const debugInfo = this.getDebugInfo();
    Debug.log.info(LogCategory.SCENE, "씬 정보", debugInfo.scene);
    Debug.log.info(LogCategory.SCENE, "상수 정보", debugInfo.constants);

    // 각 매니저의 디버그 정보
    this.cameraManager?.logDebugInfo();
    this.uiManager?.logDebugInfo();
    this.shadowManager?.logDebugInfo();
    this.inputManager?.logDebugInfo();
    this.shootingManager?.debugInfo();

    // ☆ 네트워크 매니저 디버그 정보
    this.networkManager?.logDebugInfo();

    // 키 바인딩 정보
    const keyBindings = this.inputManager?.getCurrentKeyBindings();
    Debug.log.info(LogCategory.INPUT, "현재 키 바인딩", keyBindings);

    Debug.log.info(LogCategory.SCENE, "=====================================");
  }

  // 에러 처리
  private handleError(error: Error, context: string): void {
    Debug.log.error(LogCategory.SCENE, `${context}에서 에러 발생`, error);

    this.sceneState = GAME_STATE.SCENE_STATES.ERROR;

    // 에러 발생 시 기본 상태로 복구 시도
    try {
      Debug.log.info(LogCategory.SCENE, "에러 복구 시도 중...");

      // 안전한 상태로 되돌리기
      this.setInputEnabled(false);

      // 기본 맵으로 리셋 시도
      setTimeout(() => {
        this.resetScene();
      }, 1000);
    } catch (resetError) {
      Debug.log.error(LogCategory.SCENE, "에러 복구 실패", resetError);

      // 최후의 수단: 씬 재시작
      this.scene.restart();
    }
  }

  // Phaser Scene 생명주기 - shutdown
  shutdown(): void {
    Debug.log.info(LogCategory.SCENE, "GameScene shutdown 시작");

    // 상태 변경
    this.sceneState = GAME_STATE.SCENE_STATES.LOADING;

    // ☆ 네트워크 매니저 정리
    try {
      this.networkManager?.destroy();
      Debug.log.debug(LogCategory.SCENE, "네트워크 매니저 정리 완료");
    } catch (error) {
      Debug.log.error(LogCategory.SCENE, "네트워크 매니저 정리 중 에러", error);
    }

    // ☆ 원격 플레이어들 정리
    try {
      const playerIds = Array.from(this.remotePlayers.keys());
      for (let i = 0; i < playerIds.length; i++) {
        const remotePlayer = this.remotePlayers.get(playerIds[i]);
        if (remotePlayer && remotePlayer.gfxRefs) {
          destroyCharacter(remotePlayer.gfxRefs);
        }
      }
      this.remotePlayers.clear();
      Debug.log.debug(LogCategory.SCENE, "원격 플레이어들 정리 완료");
    } catch (error) {
      Debug.log.error(LogCategory.SCENE, "원격 플레이어 정리 중 에러", error);
    }

    // 매니저들 정리 (순서 중요)
    try {
      this.shootingManager?.destroy();
      this.inputManager?.destroy();
      this.shadowManager?.destroy();
      this.uiManager?.destroy();
    } catch (error) {
      Debug.log.error(LogCategory.SCENE, "매니저 정리 중 에러", error);
    }

    // 게임 오브젝트들 정리
    try {
      if (this.mapRenderer) {
        this.mapRenderer.destroy();
      }

      // 이알들 정리
      this.bullets.forEach((bullet) => {
        if ("gameObject" in bullet && bullet.gameObject) {
          (bullet.gameObject as any).destroy();
        }
      });
      this.bullets = [];
    } catch (error) {
      Debug.log.error(LogCategory.SCENE, "게임 오브젝트 정리 중 에러", error);
    }

    // 디버그 매니저 정리
    try {
      debugManager.destroy();
    } catch (error) {
      Debug.log.error(LogCategory.SCENE, "디버그 매니저 정리 중 에러", error);
    }

    // 상태 초기화
    this.isInitialized = false;
    this.frameCount = 0;
    this.performanceTimer = 0;
    this.isMultiplayer = false;
    this.myPlayerId = null;
    this.gameData = null;

    Debug.log.info(LogCategory.SCENE, "GameScene shutdown 완료");
  }
}

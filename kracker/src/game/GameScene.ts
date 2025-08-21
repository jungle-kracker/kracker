// src/game/GameScene.ts - NetworkManager 통합된 멀티플레이어 GameScene
import { Platform, Bullet, CHARACTER_PRESETS } from "./config";
import Player from "./player/Player";
import MapRenderer from "./MapRenderer";
import { MapLoader } from "./maps/MapLoader";
import { ParticleSystem } from "./particle";

import { NetworkManager } from "./managers/NetworkManager"; // ☆ 네트워크 매니저 추가
import { DebugRenderer } from "./debug/DebugRenderer"; // ☆ 디버그 렌더러 추가

// ☆ 캐릭터 렌더링 관련 import 추가
import { createCharacter, destroyCharacter } from "./render/character.core";
import { getIdleKeyframeAtTime } from "./animations/keyframes/idle.keyframes";
import { CharacterColors, GfxRefs, PlayerState } from "./types/player.types";
import { LimbKeyframe } from "./animations/types/animation.types";
import { drawLimbs } from "./render/limbs";
import { drawGun } from "./render/gun";
import { updatePose, drawHealthBar } from "./render/character.pose";

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
} from "./config/GameConstants";

// 매니저들
import { InputManager } from "./managers/InputManager";
import { UIManager } from "./managers/UIManager";
import { CameraManager } from "./managers/CameraManager";
import { ShadowManager } from "./managers/ShadowManager";
import { ShootingManager } from "./managers/ShootingManager";
import CollisionSystem from "./systems/CollisionSystem";

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
    mouseX: number; // 마우스 X 위치 추가
    mouseY: number; // 마우스 Y 위치 추가
  };
  // 파티클 상태 추적
  particleState: {
    hasDied: boolean; // 사망 파티클이 이미 생성되었는지
  };
  // 애니메이션 상태 (로컬 플레이어와 동일)
  animationState: {
    armSwing: number;
    legSwing: number;
    wobble: number;
    shootRecoil: number;
    lastShotTime: number;
    isShooting: boolean;
  };
  // 체력바 관련 속성
  hpBarGraphics?: any;
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

  // ☆ 멀티플레이어 관련
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private myPlayerId: string | null = null;
  private gameData: GameData | null = null;
  private isMultiplayer: boolean = false;
  private networkManager!: NetworkManager; // ☆ 네트워크 매니저 추가

  // 로딩 모달 관련
  private isLoadingModalOpen: boolean = false;
  private expectedPlayerCount: number = 2; // 기본값

  // 매니저들
  private inputManager!: InputManager;
  private uiManager!: UIManager;
  private cameraManager!: CameraManager;
  private shadowManager!: ShadowManager;
  private shootingManager!: ShootingManager;
  private debugRenderer!: DebugRenderer; // ☆ 디버그 렌더러 추가
  private collisionSystem!: CollisionSystem;

  // 씬 상태 관리
  private currentMapKey: MapKey = GAME_SETTINGS.DEFAULT_MAP as MapKey;
  private sceneState: any = GAME_STATE.SCENE_STATES.LOADING;
  private isInitialized: boolean = false;

  // 증강 스냅샷: playerId -> Record<augmentId, { id, startedAt }>
  private augmentByPlayer: Map<
    string,
    Record<string, { id: string; startedAt: number }>
  > = new Map();
  // 퍼포먼스 모니터링
  private performanceTimer: number = 0;
  private frameCount: number = 0;

  constructor() {
    super({ key: "GameScene" });
  }

  //멀티관련
  private pendingMultiplayerData: GameData | null = null;

  preload(): void {
    this.load.svg("jungleBg", "/mapJungle-Bg.svg");
    // 추가 에셋들...
  }

  async create(data?: {
    mapKey?: MapKey;
    platforms?: Platform[];
    bullets?: Bullet[];
    spawn?: { x: number; y: number };
  }): Promise<void> {
    this.sceneState = GAME_STATE.SCENE_STATES.LOADING;

    try {
      // GameManager에 자신을 등록 (씬이 완전히 초기화된 후)
      const gameManager = this.game.registry.get("gameManager");
      if (gameManager) {
        gameManager.setGameScene(this);
      }

      // 맵 로더 초기화
      await MapLoader.initializeDefaultMaps();

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

      // 사격 시스템과 플레이어 연결
      this.shootingManager.setPlayer(this.player);

      // 충돌 시스템 초기화 및 주입 (사격 시스템의 총알 그룹 사용)
      this.collisionSystem = new CollisionSystem(
        this,
        this.shootingManager.getBulletGroup(),
        this.platformGroup
      );
      this.collisionSystem.setPlayer(this.player);
      this.collisionSystem.setNetworkManager(this.networkManager);
      this.collisionSystem.setRemotePlayers(this.remotePlayers);

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

    // 포즈(조준각 등) 수신
    this.networkManager.onPose((playerId, pose) => {
      this.applyRemotePose(playerId, pose);
    });

    // 파티클 수신
    this.networkManager.onParticle((particleData) => {
      this.createRemoteParticle(particleData);
    });

    // 게임 이벤트 수신
    this.networkManager.onGameEvent((event) => {
      this.handleGameEvent(event);
    });

    // 체력 업데이트 수신
    this.networkManager.onHealthUpdate((data) => {
      this.handleHealthUpdate(data);
    });
    // 🆕 증강 스냅샷 수신
    (this.networkManager as any).onAugmentSnapshot?.((data: any) => {
      try {
        (data.players || []).forEach((p: any) => {
          this.augmentByPlayer.set(p.id, p.augments || {});
        });
      } catch {}
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
    if (!remotePlayer) {
      console.warn(`⚠️ 원격 플레이어 ${playerId}를 찾을 수 없습니다`);
      return;
    }

    // 이전 상태 저장 (파티클 생성용)
    const wasGrounded = remotePlayer.networkState.isGrounded;
    const wasWallGrabbing = remotePlayer.networkState.isWallGrabbing;
    const wasWallDirection = remotePlayer.networkState.isWallGrabbing
      ? remotePlayer.networkState.facing === "left"
        ? "left"
        : "right"
      : null;

    // 네트워크 상태 업데이트 (체력은 healthUpdate 이벤트에서만 관리)
    remotePlayer.networkState = {
      isGrounded: movement.isGrounded,
      isJumping: movement.isJumping,
      isCrouching: movement.isCrouching,
      isWallGrabbing: movement.isWallGrabbing,
      facing: movement.facing,
      health: remotePlayer.networkState.health, // 기존 체력 유지
      mouseX:
        movement.mouseX ||
        remotePlayer.lastPosition.x + (movement.facing === "right" ? 50 : -50), // 마우스 위치 또는 방향 기반 추정
      mouseY: movement.mouseY || remotePlayer.lastPosition.y,
    };

    // 보간 타겟 설정
    remotePlayer.interpolation.targetX = movement.x;
    remotePlayer.interpolation.targetY = movement.y;
    remotePlayer.interpolation.targetVX = movement.vx;
    remotePlayer.interpolation.targetVY = movement.vy;
    remotePlayer.lastUpdate = Date.now();

    // 위치 즉시 업데이트 (부드러운 보간은 update에서 처리)
    remotePlayer.lastPosition = { x: movement.x, y: movement.y };

    // 가시성은 체력 상태에 따름 (사망자는 계속 숨김)
    remotePlayer.isVisible = (remotePlayer.networkState.health || 0) > 0;

    // 파티클 생성 로직
    this.handleRemotePlayerParticles(
      remotePlayer,
      wasGrounded,
      wasWallGrabbing,
      wasWallDirection
    );
  }

  // 포즈 적용 메서드
  private applyRemotePose(
    playerId: string,
    pose: {
      angle?: number;
      facing?: "left" | "right";
      mouseX?: number;
      mouseY?: number;
    }
  ) {
    const rp = this.remotePlayers.get(playerId);
    if (!rp) return;
    (rp as any).pose = {
      angle: pose.angle,
      facing: pose.facing ?? rp.networkState.facing,
      mouseX: pose.mouseX,
      mouseY: pose.mouseY,
      t: Date.now(),
    };
  }

  // 원격 파티클 생성 메서드
  private createRemoteParticle(particleData: any): void {
    if (!this.particleSystem) return;

    const { type, x, y, color, playerId } = particleData;
    console.log(
      `🎆 원격 파티클 수신: ${type} from ${playerId} at (${x}, ${y})`
    );

    switch (type) {
      case "jump":
        this.particleSystem.createJumpParticle(x, y, color);
        break;
      case "wallLeftJump":
        this.particleSystem.createWallLeftJumpParticle(x, y, color);
        break;
      case "wallRightJump":
        this.particleSystem.createWallRightJumpParticle(x, y, color);
        break;
      case "death":
        this.particleSystem.createDeathOxidationParticle(x, y);
        break;
      default:
        console.warn(`알 수 없는 파티클 타입: ${type}`);
    }
  }

  // ☆ 원격 플레이어 파티클 처리
  private handleRemotePlayerParticles(
    remotePlayer: RemotePlayer,
    wasGrounded: boolean,
    wasWallGrabbing: boolean,
    wasWallDirection: "left" | "right" | null
  ): void {
    const { x, y } = remotePlayer.lastPosition;
    const playerColor = this.parsePlayerColor(remotePlayer.color);

    // 점프 파티클: 지상에서 공중으로
    if (wasGrounded && !remotePlayer.networkState.isGrounded) {
      this.particleSystem.createJumpParticle(x, y + 25, playerColor);
      // 네트워크로 파티클 이벤트 전송
      if (this.isMultiplayer && this.networkManager) {
        this.networkManager.sendParticle({
          type: "jump",
          x: x,
          y: y + 25,
          color: remotePlayer.color,
          playerId: remotePlayer.id,
        });
      }
    }

    // 벽점프 파티클: 벽잡기에서 벽점프
    if (
      wasWallGrabbing &&
      !remotePlayer.networkState.isWallGrabbing &&
      wasWallDirection
    ) {
      if (wasWallDirection === "left") {
        this.particleSystem.createWallLeftJumpParticle(x, y + 25, playerColor);
        // 네트워크로 파티클 이벤트 전송
        if (this.isMultiplayer && this.networkManager) {
          this.networkManager.sendParticle({
            type: "wallLeftJump",
            x: x,
            y: y + 25,
            color: remotePlayer.color,
            playerId: remotePlayer.id,
          });
        }
      } else if (wasWallDirection === "right") {
        this.particleSystem.createWallRightJumpParticle(x, y + 25, playerColor);
        // 네트워크로 파티클 이벤트 전송
        if (this.isMultiplayer && this.networkManager) {
          this.networkManager.sendParticle({
            type: "wallRightJump",
            x: x,
            y: y + 25,
            color: remotePlayer.color,
            playerId: remotePlayer.id,
          });
        }
      }
    }

    // 사망 파티클: HP가 0이 되었을 때 (한 번만 생성)
    if (
      remotePlayer.networkState.health <= 0 &&
      !remotePlayer.particleState.hasDied
    ) {
      this.particleSystem.createDeathOxidationParticle(x, y);
      remotePlayer.particleState.hasDied = true;
      // 네트워크로 파티클 이벤트 전송
      if (this.isMultiplayer && this.networkManager) {
        this.networkManager.sendParticle({
          type: "death",
          x: x,
          y: y,
          playerId: remotePlayer.id,
        });
      }
    }

    // HP가 다시 올라가면 사망 상태 리셋
    if (remotePlayer.networkState.health > 0) {
      remotePlayer.particleState.hasDied = false;
    }
  }

  // ☆ 원격 플레이어 사격 처리
  // GameScene.ts의 handleRemotePlayerShoot 함수 수정
  private handleRemotePlayerShoot(playerId: string, shootData: any): void {
    if (!this.sys || !this.sys.isActive()) return;
    const remotePlayer = this.remotePlayers.get(playerId);
    if (!remotePlayer) return;

    console.log(`사격 데이터 수신:`, shootData);

    // 1. 씬 상태 확인
    if (!this.scene || !this.scene.add) {
      console.warn("씬이 초기화되지 않아 원격 사격 처리 불가");
      return;
    }

    // 2. 총구 위치 계산 (안전하게)
    const gunX = shootData.gunX || shootData.x;
    const gunY = shootData.gunY || shootData.y;

    // 3. ShootingManager에서 원격 총알 생성 (안전하게)
    try {
      if (this.shootingManager) {
        this.shootingManager.createRemotePlayerBullet({
          gunX: gunX,
          gunY: gunY,
          angle: shootData.angle,
          color: 0xff4444, // 빨간색으로 구분
          shooterId: playerId,
        });
      }
    } catch (error) {
      console.warn("원격 총알 생성 실패:", error);
    }

    // 4. 플레이어 방향 업데이트
    const deltaX = shootData.x - remotePlayer.lastPosition.x;
    remotePlayer.networkState.facing = deltaX < 0 ? "left" : "right";

    // 5. 사격 애니메이션 상태 업데이트
    remotePlayer.animationState.lastShotTime = Date.now();
    remotePlayer.animationState.shootRecoil += 1.0;
    remotePlayer.animationState.wobble += 1.0;
  }
  // ☆ 이알 충돌 처리
  private handleBulletHit(hitData: any): void {
    // 충돌 파티클
    this.createParticleEffect(hitData.x, hitData.y, true);

    if (hitData.targetPlayerId === this.myPlayerId) {
      // 내가 맞은 경우 - 서버에서 체력 업데이트를 기다림
      this.shakeCamera(200, 0.01);
    } else {
      // 원격 플레이어가 맞은 경우 - 서버에서 체력 업데이트를 기다림
      const rp = this.remotePlayers.get(hitData.targetPlayerId);
      if (rp) {
        console.log(
          `💥 원격 플레이어 ${rp.name} 맞음: ${hitData.damage} (서버에서 체력 업데이트 대기)`
        );
      }
    }
  }
  // GameScene.ts 내부 아무 private 메서드 구역에 추가
  private detectBulletHitsAgainstPlayers(): void {
    if (!this.shootingManager) return;

    const bullets: any[] = this.shootingManager.getAllBullets();
    const myId = this.myPlayerId;
    if (!myId) return;

    // 디버깅: 총알 개수와 상태 로그
    if (bullets.length > 0) {
      console.log(`🔍 총알 감지 중: ${bullets.length}개, 내 ID: ${myId}`);
    }

    // 내 원형 히트박스
    const myCircleBounds = this.player.getCircleBounds(); // 원형 히트박스 사용

    // 헬퍼 - 원형 충돌 감지
    const pointInCircle = (
      px: number,
      py: number,
      circle: { x: number; y: number; radius: number }
    ) => {
      const distanceX = px - circle.x;
      const distanceY = py - circle.y;
      const distanceSquared = distanceX * distanceX + distanceY * distanceY;
      return distanceSquared <= circle.radius * circle.radius;
    };

    for (const b of bullets) {
      if (!b || b._hitProcessed) continue;

      // 원격 총알은 충돌 감지에서 제외 (시각적으로만 보임)
      if (b._remote) continue;

      // 총알 위치 가져오기 - 여러 방법 시도
      let bx = b.x ?? b.position?.x ?? b.body?.x;
      let by = b.y ?? b.position?.y ?? b.body?.y;

      // 스프라이트에서 직접 위치 가져오기
      if (bx == null && b.sprite) {
        bx = b.sprite.x;
      }
      if (by == null && b.sprite) {
        by = b.sprite.y;
      }

      if (bx == null || by == null) continue;

      // 디버깅: 총알 정보 로그
      console.log(
        `🔍 총알 체크: ID=${b.id}, 소유자=${b.ownerId}, 위치=(${bx.toFixed(
          1
        )}, ${by.toFixed(1)})`
      );

      let hitDetected = false;

      // 원격 총알이 나를 맞춘 경우
      if (b.ownerId && b.ownerId !== myId) {
        console.log(`🎯 원격 총알 체크: ${b.ownerId} -> ${myId}`);
        if (pointInCircle(bx, by, myCircleBounds)) {
          hitDetected = true;
          b._hitProcessed = true;

          const damage = this.shootingManager?.getDamage() ?? 25;
          console.log(
            `🎯 내가 맞음! 데미지: ${damage}, 총알 소유자: ${b.ownerId}`
          );

          // 서버에 타격 전송 (로컬 데미지 처리 제거)
          this.networkManager?.sendBulletHit({
            bulletId: b.id || `bullet_${Date.now()}`,
            targetPlayerId: myId,
            damage: damage,
            x: bx,
            y: by,
          });

          // 카메라 흔들기만 적용 (체력은 서버에서 처리)
          this.shakeCamera(150, 0.008);
        }
      }

      // 내 총알이 원격 플레이어를 맞춘 경우
      if (!hitDetected && b.ownerId === myId) {
        const playerIds = Array.from(this.remotePlayers.keys());
        console.log(`🎯 내 총알 체크: ${playerIds.length}명의 원격 플레이어`);

        for (let i = 0; i < playerIds.length; i++) {
          const pid = playerIds[i];
          const remote = this.remotePlayers.get(pid);
          const body = remote?.gfxRefs?.body;
          if (!body) {
            console.log(`⚠️ 원격 플레이어 ${pid}의 body가 없음`);
            continue;
          }

          // 원형 히트박스 사용 - 보간된 실제 위치 사용
          const actualPosition = remote.lastPosition || {
            x: body.x,
            y: body.y,
          };
          const circleBounds = {
            x: actualPosition.x,
            y: actualPosition.y,
            radius: 18, // 18px 반지름으로 통일
          };

          console.log(
            `🎯 원격 플레이어 ${pid} 체크: 위치=(${actualPosition.x.toFixed(
              1
            )}, ${actualPosition.y.toFixed(1)})`
          );

          // 거리 계산 디버깅
          const distanceX = bx - circleBounds.x;
          const distanceY = by - circleBounds.y;
          const distanceSquared = distanceX * distanceX + distanceY * distanceY;
          const radiusSquared = circleBounds.radius * circleBounds.radius;

          console.log(
            `🎯 거리 계산: 총알(${bx.toFixed(1)}, ${by.toFixed(
              1
            )}) -> 플레이어(${circleBounds.x.toFixed(
              1
            )}, ${circleBounds.y.toFixed(1)})`
          );
          console.log(
            `🎯 거리: ${Math.sqrt(distanceSquared).toFixed(
              1
            )}px, 히트박스 반지름: ${circleBounds.radius}px`
          );
          console.log(
            `🎯 충돌 판정: ${distanceSquared} <= ${radiusSquared} = ${
              distanceSquared <= radiusSquared
            }`
          );

          if (pointInCircle(bx, by, circleBounds)) {
            hitDetected = true;
            b._hitProcessed = true;

            const damage = this.shootingManager?.getDamage() ?? 25;
            console.log(`🎯 상대 맞춤! 타겟: ${pid}, 데미지: ${damage}`);

            this.networkManager?.sendBulletHit({
              bulletId: b.id || `bullet_${Date.now()}`,
              targetPlayerId: pid,
              damage: damage,
              x: bx,
              y: by,
            });

            break;
          }
        }
      }

      // 충돌이 감지되었으면 총알 제거 (원격 총알은 제거하지 않음)
      if (hitDetected && b && !b._remote) {
        console.log(`🎯 총알 히트! 총알 ID: ${b.id}, 위치: (${bx}, ${by})`);

        // 총알 제거 - 여러 방법 시도
        if (typeof b.hit === "function") {
          b.hit(bx, by);
        }

        // 추가로 총알 비활성화
        if (typeof b.destroy === "function") {
          b.destroy(true);
        }

        // 총알 스프라이트 직접 제거
        if (b.sprite && typeof b.sprite.destroy === "function") {
          b.sprite.destroy(true);
        }

        // 총알 물리 바디 비활성화
        if (b.body && typeof b.body.disable === "function") {
          b.body.disable();
        }

        // 총알을 비활성 상태로 설정
        b._active = false;
        b._hitProcessed = true;

        // 총알 그룹에서 제거
        if (this.shootingManager) {
          const bulletGroup = this.shootingManager.getBulletGroup();
          if (bulletGroup && b.sprite) {
            bulletGroup.remove(b.sprite, true, true);
          }
        }
      }
    }
  }

  // 원격 총알 정리 (수명이 다한 총알 제거)
  private cleanupRemoteBullets(): void {
    if (!this.shootingManager) return;

    const bullets: any[] = this.shootingManager.getAllBullets();
    const currentTime = Date.now();

    for (const b of bullets) {
      if (!b || !b._remote) continue;

      // 원격 총알의 수명 체크 (3초)
      const bulletAge = currentTime - (b.createdTime || currentTime);
      if (bulletAge > 3000) {
        // 수명이 다한 원격 총알 제거
        if (typeof b.destroy === "function") {
          b.destroy(true);
        }
        if (b.sprite && typeof b.sprite.destroy === "function") {
          b.sprite.destroy(true);
        }
        b._active = false;
        b._hitProcessed = true;
      }
    }
  }

  // ☆ 게임 이벤트 처리
  private handleGameEvent(event: any): void {
    switch (event.type) {
      case "status":
        // 상태이상(예: slow) 적용: 간단히 이동 속도 스케일을 일정 시간 낮춤
        try {
          const pid = event.playerId;
          const data = event.data || {};
          if (data.status === "slow") {
            if (pid === this.myPlayerId && this.player) {
              // 로컬 플레이어: 이동 속도 스케일 적용
              const mult = data.multiplier ?? 0.7;
              const ms = data.ms ?? 1500;
              (this.player as any).__speedMul = mult;
              setTimeout(() => {
                (this.player as any).__speedMul = 1.0;
              }, ms);
            }
          }
        } catch {}
        break;
      case "showHealthBar":
        // 체력바 표시 이벤트 처리
        const playerId = event.data?.playerId || event.playerId;
        const remotePlayer = this.remotePlayers.get(playerId);
        if (remotePlayer) {
          // 체력바 상시 표시로 변경
          // 체력 업데이트
          if (event.data?.health !== undefined) {
            remotePlayer.networkState.health = event.data.health;
          }
        } else {
          console.warn(`⚠️ 체력바 표시할 플레이어를 찾을 수 없음: ${playerId}`);
        }
        break;

      case "damage":
        // 데미지 이벤트 처리
        console.log(`💥 데미지 이벤트: ${event.playerId}`);
        break;

      case "heal":
        // 힐 이벤트 처리
        console.log(`💚 힐 이벤트: ${event.playerId}`);
        break;

      case "respawn":
        // 리스폰 이벤트 처리
        console.log(`ㅊ 리스폰 이벤트: ${event.playerId}`);
        break;

      case "powerup":
        // 파워업 이벤트 처리
        console.log(`⚡ 파워업 이벤트: ${event.playerId}`);
        break;

      case "respawnAll":
        // 모든 플레이어를 스폰 위치로 이동
        try {
          const spawns = this.mapRenderer?.getSpawns?.() || [];
          // 내 플레이어
          if (this.player && this.myPlayerId) {
            const myData = this.gameData?.players.find(
              (p) => p.id === this.myPlayerId
            );
            let spawn = spawns[0];
            if (this.gameData?.room.gameMode === "팀전") {
              if (myData?.team === 1)
                spawn = spawns.find((s: any) => s.name === "A") || spawns[0];
              else if (myData?.team === 2)
                spawn = spawns.find((s: any) => s.name === "B") || spawns[0];
            }
            if (spawn) {
              this.setPlayerPosition(spawn.x, spawn.y);
            }
            // 이름표 복구
            if (myData) this.tryCreateNameTag(myData.id, myData.name);
          }
          // 원격 플레이어
          const playerIds = Array.from(this.remotePlayers.keys());
          for (let i = 0; i < playerIds.length; i++) {
            const pid = playerIds[i];
            const rp = this.remotePlayers.get(pid);
            if (!rp) continue;
            const rpData = this.gameData?.players.find((p) => p.id === pid);
            let spawn = spawns[0];
            if (this.gameData?.room.gameMode === "팀전") {
              if (rpData?.team === 1)
                spawn = spawns.find((s: any) => s.name === "A") || spawns[0];
              else if (rpData?.team === 2)
                spawn = spawns.find((s: any) => s.name === "B") || spawns[0];
            }
            if (spawn) {
              rp.lastPosition = { x: spawn.x, y: spawn.y };
              rp.gfxRefs?.body?.setPosition?.(spawn.x, spawn.y);
            }
            if (rpData) this.tryCreateNameTag(pid, rpData.name);
          }
        } catch (e) {}
        break;

      case "dead":
        // 특정 플레이어 사망 방송 수신 시 해당 위치에서만 이펙트 생성 및 숨김
        try {
          const pid = event.playerId;
          const pos = event.data || {};
          if (pid === this.myPlayerId) {
            this.playerHide();
            // 내 사망 이펙트
            this.createParticleEffect(
              pos.x ?? this.getPlayerX(),
              pos.y ?? this.getPlayerY(),
              true
            );
          } else {
            const rp = this.remotePlayers.get(pid);
            if (rp) {
              // 체력바는 계속 표시되도록 isVisible은 true로 유지
              // 대신 체력을 0으로 설정하여 렌더링에서 처리
              rp.networkState.health = 0;
              rp.isVisible = false; // 가시성 상태도 false로 설정
              const refs = rp.gfxRefs;
              refs?.body?.setVisible?.(false);
              refs?.face?.setVisible?.(false);
              refs?.leftArm?.setVisible?.(false);
              refs?.rightArm?.setVisible?.(false);
              refs?.leftLeg?.setVisible?.(false);
              refs?.rightLeg?.setVisible?.(false);
              refs?.gun?.setVisible?.(false);
              try {
                this.uiManager.destroyNameTag(pid);
              } catch {}
              // 사망 시에도 체력바는 계속 표시

              // 원격 사망 이펙트: 해당 좌표에서만 생성
              this.createParticleEffect(
                pos.x ?? rp.lastPosition.x,
                pos.y ?? rp.lastPosition.y,
                true
              );
            }
          }
        } catch (e) {}
        break;

      case "alive":
        try {
          const pid = event.playerId;
          if (pid === this.myPlayerId) {
            this.playerShow();
            this.setInputEnabled(true);
          } else {
            const rp = this.remotePlayers.get(pid);
            if (rp) {
              rp.isVisible = true;
              rp.networkState.health = 100; // 부활 시 체력 복구
              const refs = rp.gfxRefs;
              refs?.body?.setVisible?.(true);
              refs?.face?.setVisible?.(true);
              refs?.leftArm?.setVisible?.(true);
              refs?.rightArm?.setVisible?.(true);
              refs?.leftLeg?.setVisible?.(true);
              refs?.rightLeg?.setVisible?.(true);
              refs?.gun?.setVisible?.(true);
            }
          }
        } catch (e) {}
        break;

      default:
        console.warn(`알 수 없는 게임 이벤트 타입: ${event.type}`);
    }
  }

  // ☆ 체력 업데이트 처리 (서버에서 받은 체력 동기화)
  private handleHealthUpdate(data: any): void {
    console.log(`💚 체력 업데이트 수신:`, data);
    console.log(`💚 현재 내 플레이어 ID: ${this.myPlayerId}`);

    const { playerId, health, damage } = data;

    if (playerId === this.myPlayerId) {
      const currentHealth = this.player.getHealth();
      const expectedHealth = health;

      // 서버 권위 체력 동기화 (서버 판정이 최우선)
      console.log(`💚 체력 동기화: ${currentHealth} -> ${expectedHealth}`);
      
      // 체력을 직접 설정 (서버 값으로)
      this.player.setHealth(expectedHealth);

      // 서버에서 0 이하로 판정되면 강제 사망 처리
      if (expectedHealth <= 0) {
        console.log(`💀 서버 판정: 내 플레이어 사망 (체력 ${expectedHealth})`);
        this.setInputEnabled(false);
        this.playerHide();
      } else if (currentHealth <= 0 && expectedHealth > 0) {
        // 회복(리스폰) 시: 입력 활성화 + 캐릭터 표시
        console.log(`🔄 서버 판정: 내 플레이어 부활 (체력 ${expectedHealth})`);
        this.playerShow();
        this.setInputEnabled(true);
      }

      // 데미지 효과 (살아있을 때만)
      if (damage > 0 && expectedHealth > 0) {
        this.player.addWobble();
        this.player.setInvulnerable(1000);
      }

      console.log(`💚 내 체력 업데이트: ${expectedHealth}`);
    } else {
      // 원격 플레이어 체력 업데이트
      const remotePlayer = this.remotePlayers.get(playerId);
      if (remotePlayer) {
        const oldHealth = remotePlayer.networkState.health;
        remotePlayer.networkState.health = health;

        // 사망/부활 시 가시성 토글
        const shouldBeVisible = health > 0;
        remotePlayer.isVisible = shouldBeVisible;
        const refs = remotePlayer.gfxRefs;
        if (refs) {
          const vis = (v: boolean) => {
            refs.body?.setVisible?.(v);
            refs.face?.setVisible?.(v);
            refs.leftArm?.setVisible?.(v);
            refs.rightArm?.setVisible?.(v);
            refs.leftLeg?.setVisible?.(v);
            refs.rightLeg?.setVisible?.(v);
            refs.gun?.setVisible?.(v);
          };
          vis(shouldBeVisible);

          // 사망/부활 로그
          if (health <= 0 && oldHealth > 0) {
            console.log(
              `💀 원격 플레이어 ${remotePlayer.name} 사망: 체력 ${health}`
            );
          } else if (health > 0 && oldHealth <= 0) {
            console.log(
              `🔄 원격 플레이어 ${remotePlayer.name} 부활: 체력 ${health}`
            );
          }
        }

        if (oldHealth !== health || damage > 0) {
          console.log(
            `💚 ${remotePlayer.name} 체력 업데이트: ${oldHealth} -> ${health}`
          );

          // 체력이 감소했으면 로그만 출력 (체력바는 상시 표시)
          if (health < oldHealth) {
            console.log(
              `💚 ${remotePlayer.name} 체력 감소: ${oldHealth} -> ${health}`
            );
          }
        }

        // 디버깅: 원격 플레이어 체력 업데이트 확인
        console.log(
          `🔍 원격 플레이어 ${remotePlayer.name} 체력 업데이트 완료: ${health}/100`
        );
      } else {
        console.warn(`⚠️ 체력 업데이트할 플레이어를 찾을 수 없음: ${playerId}`);
      }
    }
  }

  // ☆ 플레이어 입장 처리
  private handlePlayerJoin(playerData: any): void {
    console.log(`👋 새 플레이어 입장: ${playerData.name}`);
    this.createRemotePlayer(playerData);

    // 로딩 모달 상태 업데이트
    this.updateLoadingModalState();
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

      // 체력바 그래픽 객체 제거
      if (remotePlayer.hpBarGraphics) {
        remotePlayer.hpBarGraphics.destroy();
      }

      //퇴장 시 태그 제거
      this.uiManager.destroyNameTag(playerId);

      this.remotePlayers.delete(playerId);

      // 로딩 모달 상태 업데이트
      this.updateLoadingModalState();
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
    this.expectedPlayerCount = gameData.players.length;

    // 로딩 모달 열기
    this.isLoadingModalOpen = true;

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

    // ⭐ 플레이어 ID 설정 (중요!)
    if (this.player && this.myPlayerId) {
      this.player.setId(this.myPlayerId);
      console.log(`💚 플레이어 ID 설정: ${this.myPlayerId}`);
    }

    // ⭐ ShootingManager에 플레이어 ID 설정 (총알 소유자 식별용)
    if (this.shootingManager && this.myPlayerId) {
      this.shootingManager.setOwnerId(this.myPlayerId);
      console.log(`🔫 ShootingManager ownerId 설정: ${this.myPlayerId}`);
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
      this.player.setMultiplayerMode(true); // 멀티플레이어 모드 설정
      console.log(`✅ 내 플레이어 스폰: (${spawnPoint.x}, ${spawnPoint.y})`);
    }

    // 색상 설정
    this.setMyPlayerColor(playerData.color);

    //내 플레이어 세팅 시 태그 만들기
    this.uiManager.createNameTag(playerData.id, playerData.name);
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
        health: (playerData as any).health || 100, // 서버에서 받은 체력 정보 사용
        mouseX: spawnPoint.x + 50, // 기본 마우스 위치
        mouseY: spawnPoint.y,
      },
      particleState: {
        hasDied: false,
      },
      animationState: {
        armSwing: 0,
        legSwing: 0,
        wobble: 0,
        shootRecoil: 0,
        lastShotTime: 0,
        isShooting: false,
      },
      // 체력바 관련 속성 초기화
      hpBarGraphics: undefined,
    };

    // 그래픽 요소들의 가시성 확실히 설정 (로컬 플레이어와 동일한 depth)
    if (gfxRefs.body) {
      gfxRefs.body.setVisible(true);
      gfxRefs.body.setDepth(-3); // 로컬과 동일
    }
    if (gfxRefs.face) {
      gfxRefs.face.setVisible(true);
      gfxRefs.face.setDepth(-3); // 로컬과 동일
    }
    if (gfxRefs.leftArm) {
      gfxRefs.leftArm.setVisible(true);
      gfxRefs.leftArm.setDepth(-5); // 로컬과 동일
    }
    if (gfxRefs.rightArm) {
      gfxRefs.rightArm.setVisible(true);
      gfxRefs.rightArm.setDepth(-5); // 로컬과 동일
    }
    if (gfxRefs.leftLeg) {
      gfxRefs.leftLeg.setVisible(true);
      gfxRefs.leftLeg.setDepth(-5); // 로컬과 동일
    }
    if (gfxRefs.rightLeg) {
      gfxRefs.rightLeg.setVisible(true);
      gfxRefs.rightLeg.setDepth(-5); // 로컬과 동일
    }
    if (gfxRefs.gun) {
      gfxRefs.gun.setVisible(true);
      gfxRefs.gun.setDepth(-5); // 로컬과 동일
    }

    // 체력바 그래픽 객체 생성
    remotePlayer.hpBarGraphics = this.add.graphics();
    remotePlayer.hpBarGraphics.setDepth(10); // UI 레이어

    // Map에 저장
    this.remotePlayers.set(playerData.id, remotePlayer);

    //원격 플레이어 생성 시 태그 만들기
    this.uiManager.createNameTag(playerData.id, playerData.name);
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
  }

  // ☆ 로딩 모달 상태 업데이트
  private updateLoadingModalState(): void {
    if (!this.isLoadingModalOpen || !this.gameData) return;

    const currentPlayerCount = this.remotePlayers.size + 1; // 원격 플레이어 + 내 플레이어
    const expectedPlayerCount = this.expectedPlayerCount;

    console.log(`📊 로딩 상태: ${currentPlayerCount}/${expectedPlayerCount}`);

    // 모든 플레이어가 연결되면 로딩 모달 닫기
    if (currentPlayerCount >= expectedPlayerCount) {
      setTimeout(() => {
        this.isLoadingModalOpen = false;
        console.log("✅ 모든 플레이어 연결 완료 - 로딩 모달 닫힘");
      }, 2000); // 2초 후 닫기
    }
  }

  // ☆ 원격 플레이어들 업데이트
  private updateRemotePlayers(deltaTime: number): void {
    this.remotePlayers.forEach((remotePlayer) => {
      // 보간 처리
      this.interpolateRemotePlayer(remotePlayer, deltaTime);

      // 애니메이션 상태 업데이트 (로컬 플레이어와 동일한 로직)
      this.updateRemotePlayerAnimationState(remotePlayer, deltaTime);

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

    // 속도는 targetVX를 직접 사용 (다리 애니메이션용)

    // 실제 위치 업데이트
    remotePlayer.lastPosition = {
      x: interpolation.currentX,
      y: interpolation.currentY,
    };
  }

  // ☆ 원격 플레이어 애니메이션 상태 업데이트 (로컬 플레이어와 동일한 로직)
  private updateRemotePlayerAnimationState(
    remotePlayer: RemotePlayer,
    deltaTime: number
  ): void {
    const anim = remotePlayer.animationState;
    const network = remotePlayer.networkState;
    const dt = deltaTime / 1000;
    const now = Date.now();
    const time = now * 0.01;

    // 부드러운 애니메이션 파라미터 업데이트
    if (network.isWallGrabbing) {
      // 벽잡기 시 팔을 벽 쪽으로 뻗기
      const wallDirection = network.facing === "right" ? 1 : -1;
      anim.armSwing = wallDirection * 15;
    } else if (network.isCrouching) {
      // 웅크리기 시 팔을 아래로
      anim.armSwing = Math.sin(time * 0.3) * 3;
    } else if (Math.abs(remotePlayer.interpolation.targetVX) > 10) {
      // 걷기/뛰기 시 팔 흔들기
      anim.armSwing = Math.sin(time * 0.5) * 8;
    } else {
      // 가만히 있을 때도 자연스러운 팔 움직임
      anim.armSwing = Math.sin(time * 0.2) * 3 + Math.sin(time * 0.1) * 2;
    }

    // 다리 애니메이션은 drawLimbs에서 자동 처리됨 (로컬과 동일)

    // 부드러운 흔들림
    anim.wobble = Math.sin(time * 0.3) * 0.5;
    anim.shootRecoil *= 0.8;

    // 사격 상태 업데이트
    anim.isShooting = now - anim.lastShotTime < 200;

    // 체력바는 상시 표시이므로 타이머 업데이트 제거

    // 마우스 위치가 없거나 오래된 경우 방향 기반으로 추정 업데이트
    const { x, y } = remotePlayer.lastPosition;
    if (
      !network.mouseX ||
      !network.mouseY ||
      now - remotePlayer.lastUpdate > 1000
    ) {
      // 방향 기반으로 마우스 위치 추정 (더 자연스러운 각도)
      const angle = Math.random() * Math.PI * 2; // 랜덤 각도
      const distance = 30 + Math.random() * 40; // 30-70 픽셀 거리
      network.mouseX = x + Math.cos(angle) * distance;
      network.mouseY = y + Math.sin(angle) * distance;
    }
  }

  // 원격 플레이어 체력바 렌더링
  private renderRemotePlayerHealthBar(remotePlayer: RemotePlayer): void {
    if (!remotePlayer.hpBarGraphics) {
      console.warn(`⚠️ ${remotePlayer.name}의 체력바 그래픽이 없습니다`);
      return;
    }

    // HP바 그래픽 초기화
    remotePlayer.hpBarGraphics.clear();

    // 타이머에 따라 체력바 표시
    console.log(
      `💚 ${remotePlayer.name} 체력바 렌더링: 체력=${remotePlayer.networkState.health}`
    );

    // HP바 그리기 (상시 표시)
    drawHealthBar(
      remotePlayer.hpBarGraphics,
      remotePlayer.lastPosition.x,
      remotePlayer.lastPosition.y,
      remotePlayer.networkState.health,
      100,
      0 // 타이머는 사용하지 않음
    );
  }

  // ☆ 원격 플레이어 애니메이션 렌더링
  private renderRemotePlayerAnimation(remotePlayer: RemotePlayer): void {
    const refs = remotePlayer.gfxRefs;
    if (!refs) {
      console.warn(`⚠️ ${remotePlayer.name}의 gfxRefs가 없습니다`);
      return;
    }

    // 가시성 체크 (사망 상태는 체력바 표시를 위해 제거)
    if (!remotePlayer.isVisible) {
      return;
    }

    const { x, y } = remotePlayer.lastPosition;
    const facing = remotePlayer.networkState.facing;
    const networkState = remotePlayer.networkState;

    // 사망 상태 체크
    const isDead = (remotePlayer.networkState.health || 0) <= 0;

    // ⭐ 몸통 위치 업데이트
    if (refs.body) {
      refs.body.setPosition(x, y);
      refs.body.setVisible(!isDead); // 사망 시 숨김
      refs.body.setDepth(-3); // 로컬과 동일
    }

    // 로컬 플레이어와 동일한 애니메이션 시스템 사용
    const characterColors: CharacterColors = {
      head: this.parsePlayerColor(remotePlayer.color),
      limbs: this.parsePlayerColor(remotePlayer.color),
      gun: 0x333333,
    };

    // 모든 그래픽 요소 가시성 설정 (사망 시 숨김)
    if (refs.leftArm) refs.leftArm.setVisible(!isDead);
    if (refs.rightArm) refs.rightArm.setVisible(!isDead);
    if (refs.leftLeg) refs.leftLeg.setVisible(!isDead);
    if (refs.rightLeg) refs.rightLeg.setVisible(!isDead);
    if (refs.gun) refs.gun.setVisible(!isDead);

    console.log(`💚 ${remotePlayer.name} 체력: ${networkState.health}/100`);

    // 사망하지 않은 경우에만 포즈와 팔다리 렌더링
    if (!isDead) {
      // 로컬 플레이어와 동일한 렌더링 시스템 사용
      // 1. 포즈 업데이트 (몸통, 표정) - 로컬과 동일한 시스템 사용
      updatePose(refs, {
        x: x,
        y: y,
        wobble: remotePlayer.animationState.wobble,
        crouchHeight: networkState.isCrouching ? 0.5 : 0,
        baseCrouchOffset: 3,
        wallLean: networkState.isWallGrabbing
          ? facing === "right"
            ? 5
            : -5
          : 0,
        colors: characterColors,
        health: networkState.health,
        maxHealth: 100,
        isWallGrabbing: networkState.isWallGrabbing,
      });

      // 2. 로컬과 동일한 팔다리 렌더링 시스템 사용
      const pose = (remotePlayer as any).pose;
      const mouseX = pose?.mouseX || x + (facing === "right" ? 50 : -50);
      const mouseY = pose?.mouseY || y;

      drawLimbs(refs, {
        x: x,
        y: y,
        mouseX: mouseX,
        mouseY: mouseY,
        armSwing: 0, // 원격은 애니메이션만 사용
        legSwing: 0,
        crouchHeight: networkState.isCrouching ? 1 : 0,
        baseCrouchOffset: 3,
        isWallGrabbing: networkState.isWallGrabbing,
        wallGrabDirection: networkState.isWallGrabbing ? facing : null,
        isGrounded: networkState.isGrounded,
        velocityX: remotePlayer.interpolation.targetVX, // 실제 속도 사용
        colors: characterColors,
        shootRecoil: 0,
        currentTime: Date.now() / 1000,
        currentFacing: facing,
        isJumping: !networkState.isGrounded, // 점프 상태 추정 (지상에 없으면 점프 중으로 간주)
      });
    }

    // 체력바 렌더링 (사망한 플레이어도 체력바는 표시)
    this.renderRemotePlayerHealthBar(remotePlayer);

    // 디버그: 주기적으로 위치 로그
    if (Date.now() % 5000 < 16) {
      console.log(
        `📍 ${remotePlayer.name} 위치: (${x.toFixed(1)}, ${y.toFixed(
          1
        )}) 상태: ${JSON.stringify(networkState)}`
      );
    }
  }

  // ⭐ 간단한 팔다리 렌더링 메서드 추가 (기존 호환성용)
  private renderSimpleLimbs(
    refs: GfxRefs,
    x: number,
    y: number,
    facing: "left" | "right",
    color: string,
    aimAngle?: number // ★ 추가
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

      if (aimAngle != null && isFinite(aimAngle)) {
        const L = 22; // 팔 길이
        const ex = x + 10 * direction + Math.cos(aimAngle) * L;
        const ey = y - 5 + Math.sin(aimAngle) * L;
        refs.rightArm.lineTo(ex, ey);
      } else {
        // 기존 단순 팔
        refs.rightArm.lineTo(x + 15 * direction, y + 5);
        refs.rightArm.lineTo(x + 20 * direction, y + 15);
      }
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

  // ☆ 애니메이션된 얼굴 렌더링
  private renderAnimatedFace(
    faceGfx: any,
    x: number,
    y: number,
    facing: "left" | "right",
    networkState: any
  ): void {
    if (!faceGfx) return;

    faceGfx.clear();
    faceGfx.fillStyle(0x000000);

    const eyeOffset = facing === "right" ? 5 : -5;
    const time = Date.now() * 0.01;

    // 상태에 따른 표정 변화
    let eyeSize = 2;
    let mouthY = y + 2;
    let mouthWidth = 0;

    if (networkState.isJumping) {
      // 점프 시 놀란 표정
      eyeSize = 3;
      mouthY = y + 1;
      mouthWidth = 4;
    } else if (networkState.isWallGrabbing) {
      // 벽잡기 시 집중한 표정
      eyeSize = 1.5;
      mouthY = y + 3;
      mouthWidth = 2;
    } else if (networkState.isCrouching) {
      // 웅크리기 시 긴장한 표정
      eyeSize = 2.5;
      mouthY = y + 2;
      mouthWidth = 3;
    } else {
      // 일반 상태 - 깜빡임 애니메이션
      const blink = Math.sin(time * 0.1) > 0.8 ? 0 : eyeSize;
      eyeSize = blink;
    }

    // 눈 그리기
    if (eyeSize > 0) {
      faceGfx.fillCircle(x - eyeOffset, y - 5, eyeSize); // 왼쪽 눈
      faceGfx.fillCircle(x + eyeOffset, y - 5, eyeSize); // 오른쪽 눈
    }

    // 입 그리기 (상태에 따라)
    if (mouthWidth > 0) {
      faceGfx.fillRect(x - mouthWidth / 2, mouthY, mouthWidth, 1);
    }
  }

  // ☆ 기본 얼굴 렌더링 (기존 호환성용)
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
      await this.mapRenderer.loadMapPreset(this.currentMapKey);
      this.platforms = this.mapRenderer.getPlatforms();
    } catch (error) {
      // 맵 로드 실패 처리
    }
  }

  // 매니저들 초기화
  private async initializeManagers(): Promise<void> {
    // 카메라 매니저
    this.cameraManager = new CameraManager(this, {
      follow: {
        enabled: true,
        lerpX: CAMERA_CONSTANTS.FOLLOW.LERP_X,
        lerpY: CAMERA_CONSTANTS.FOLLOW.LERP_Y,
        deadzone: {
          width: 50,
          height: 50,
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
    this.cameraManager.setBounds(0, 0, mapSize.width, mapSize.height);

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
    });
    this.shootingManager.initialize();

    // 플레이어 ID 설정 (총알 소유자 식별용)
    if (this.myPlayerId) {
      this.shootingManager.setOwnerId(this.myPlayerId);
    }

    // 사격 시스템 충돌 설정
    this.shootingManager.setupCollisions(this.platformGroup);

    // ☆ 사격 이벤트 콜백 설정 (네트워크 전송 추가)
    this.setupShootingCallbacks();

    // 입력 매니저 (마지막에 초기화 - 콜백 연결 후)
    this.inputManager = new InputManager(this);
    this.setupInputCallbacks();
    this.inputManager.initialize();

    // ☆ 디버그 렌더러 초기화
    this.debugRenderer = new DebugRenderer(this);

    // UI 상태 업데이트
    this.updateAllUI();

    // 🆕 ShootingManager에 증강 조회 연결
    try {
      this.shootingManager.setAugmentResolver((playerId: string) => {
        return this.augmentByPlayer.get(playerId);
      });
    } catch {}
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
    });

    // 재장전시 네트워크로 전송
    this.shootingManager.onReload(() => {
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
    });

    // ☆ 명중시 네트워크로 충돌 데이터 전송 (CollisionSystem에서 처리하므로 비활성화)
    // this.shootingManager.onHit((x, y) => {
    //   // 충돌 지점에서 플레이어 검색
    //   const hitPlayerId = this.findPlayerAtPosition(x, y);
    //   if (hitPlayerId && this.isMultiplayer) {
    //     this.networkManager.sendBulletHit({
    //       bulletId: `bullet_${Date.now()}`,
    //       targetPlayerId: hitPlayerId,
    //       x: x,
    //       y: y,
    //       damage: 25,
    //     });
    //   }

    //   Debug.log.debug(LogCategory.GAME, `이알 명중: (${x}, ${y})`);
    // });
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
        0
      );

      this.physics.add.existing(rect, true);
      const body = rect.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(platform.width, platform.height);
      body.setOffset(0, 0);
      body.updateFromGameObject();
      this.platformGroup.add(rect);
    });

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

    // 낙하 데미지 콜백 설정
    this.player.onFalloutDamage = (damage: number) => {
      if (this.networkManager && this.myPlayerId) {
        console.log(`💥 낙하 데미지 서버 전송: ${damage}`);
        this.networkManager.sendBulletHit({
          bulletId: `fallout_${Date.now()}`,
          targetPlayerId: this.myPlayerId,
          damage: damage,
          x: this.player.getPosition().x,
          y: this.player.getPosition().y,
        });
      }
    };

    // 멀티플레이어 모드 설정
    this.player.setMultiplayerMode(this.isMultiplayer);

    this.cameraManager.setFollowTarget(this.player as any);
  }

  private processAdditionalData(data?: any): void {
    if (!data) return;

    if (data.platforms) {
      this.platforms.push(...data.platforms);
    }

    if (data.bullets) {
      this.bullets.push(...data.bullets);
      // 디버그 총알 로드 로그 비활성화
      // Debug.log.debug(
      //   LogCategory.GAME,
      //   `추가 이알 ${data.bullets.length}개 로드됨`
      // );
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
      // 디버그 색상 변경 로그 비활성화
      // Debug.log.info(LogCategory.PLAYER, "색상 변경", color);
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

    // UI 업데이트 콜백
    // UI 업데이트는 필요시에만

    // 입력 콜백 설정 완료
    // Debug.log.debug(LogCategory.INPUT, "입력 콜백 설정 완료");
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

      // ☆ 멀티플레이어 모드에서 내 포즈 전송(20Hz)
      if (this.isMultiplayer && this.player && this.networkManager) {
        this.networkManager.maybeSendPose(() => {
          const gun = this.player.getGunPosition(); // { x, y, angle }
          const st = this.player.getState();
          const mouseX = this.input?.pointer1?.worldX || gun.x;
          const mouseY = this.input?.pointer1?.worldY || gun.y;
          return {
            id: this.myPlayerId!,
            angle: gun.angle, // 라디안 그대로
            facing: st.facingDirection, // "left" | "right"
            mouseX: mouseX,
            mouseY: mouseY,
            t: Date.now(),
          };
        });
      }

      // ☆ 로컬 플레이어 파티클 전송 (콜백 방식으로 변경)
      if (this.isMultiplayer && this.networkManager) {
        // Player의 파티클 콜백 설정
        this.player.onParticleCreated = (
          type: string,
          x: number,
          y: number,
          color: number
        ) => {
          this.networkManager.sendParticle({
            type: type,
            x: x,
            y: y,
            color: color,
            playerId: this.myPlayerId,
          });
        };
      }
    }

    // ☆ 원격 플레이어들 업데이트 및 보간
    this.updateRemotePlayers(deltaTime);

    // === [닉네임 태그 위치 갱신] =====================================
    // 내 플레이어: Player.getBounds()를 이용해 HP바 상단 근사치 계산
    if (this.player && this.myPlayerId && this.player.getHealth() > 0) {
      const b = this.player.getBounds();
      const x = b.x + b.width / 2;
      const hpBarTopY = b.y - 8;
      this.uiManager.updateNameTagPosition(this.myPlayerId, x, hpBarTopY);
    }

    // 원격 플레이어들: 현재 렌더 기준 좌표 사용 (사망자는 스킵)
    this.remotePlayers.forEach((rp) => {
      if (!rp.networkState || rp.networkState.health <= 0 || !rp.isVisible)
        return;
      const x = rp.lastPosition.x;
      const hpBarTopY = rp.lastPosition.y - 25;
      this.uiManager.updateNameTagPosition(rp.id, x, hpBarTopY);
    });

    // 그림자 시스템 업데이트
    if (this.mapRenderer) {
      this.mapRenderer.updateShadows();

      // 🎨 패럴랙스 배경 효과를 위한 플레이어 위치 업데이트
      if (this.player) {
        const playerState = this.player.getState();
        this.mapRenderer.updatePlayerPosition(
          playerState.position.x,
          playerState.position.y
        );
      }
    }

    // 사격 시스템 업데이트
    if (this.shootingManager) {
      this.shootingManager.update(); // 총알 업데이트 추가
    }

    // ☆ 디버그 렌더러 업데이트
    if (this.debugRenderer) {
      this.debugRenderer.update();
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
      // 체력은 healthUpdate 이벤트에서만 관리
    };

    this.networkManager.sendPlayerMovement(movementData);
  }

  private updateGameLogic(): void {
    this.cullBulletsOutsideViewport();
    this.clampPlayerInsideWorld();
    // 충돌 처리는 CollisionSystem에서 담당하므로 비활성화
    // this.detectBulletHitsAgainstPlayers();
    this.cleanupRemoteBullets();
  }

  private updatePerformanceMonitoring(time: number, deltaTime: number): void {
    this.frameCount++;

    // 경고 임계값 체크
    if (deltaTime > PERFORMANCE_CONSTANTS.UPDATE_INTERVALS.EVERY_FRAME) {
      const fps = 1000 / deltaTime;
    }
  }

  private updatePeriodicTasks(time: number, deltaTime: number): void {
    // 디버그 게임 상태 로깅 비활성화
    // if (
    //   Debug.isEnabled() &&
    //   time % PERFORMANCE_CONSTANTS.UPDATE_INTERVALS.EVERY_5_SECONDS < deltaTime
    // ) {
    //   Debug.logGameState(this.player, this.cameraManager.getCameraInfo(), {
    //     key: this.currentMapKey,
    //     size: this.mapRenderer?.getMapSize(),
    //     platforms: this.platforms,
    //   });
    // }

    // 10초마다 메모리 체크
    if (
      time % PERFORMANCE_CONSTANTS.UPDATE_INTERVALS.EVERY_10_SECONDS <
      deltaTime
    ) {
      // debugManager.checkMemoryUsage();
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

    // 디버그 UI 업데이트 로그 비활성화
    // Debug.log.trace(LogCategory.UI, "모든 UI 업데이트됨");
  }

  // 맵 전환
  private async switchMap(mapKey: MapKey): Promise<void> {
    if (mapKey === this.currentMapKey) return;

    if (!GAME_SETTINGS.AVAILABLE_MAPS.includes(mapKey)) {
      return;
    }
    this.sceneState = GAME_STATE.SCENE_STATES.TRANSITION;

    try {
      // 맵 전환
      this.currentMapKey = mapKey;
      await this.mapRenderer?.loadMapPreset(mapKey);
      this.platforms = this.mapRenderer?.getPlatforms() || [];

      // 카메라 바운드 업데이트
      const mapSize = this.mapRenderer.getMapSize();
      this.cameraManager.setBounds(0, 0, mapSize.width, mapSize.height);

      // 플레이어 위치 리셋
      this.resetPlayerPosition();

      // 그림자 강제 업데이트
      this.shadowManager.forceUpdate();

      // UI 업데이트
      this.updateAllUI();

      this.sceneState = GAME_STATE.SCENE_STATES.RUNNING;
    } catch (error) {
      this.sceneState = GAME_STATE.SCENE_STATES.ERROR;
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

    // 최대 이알 수 제한
    if (this.bullets.length > PERFORMANCE_CONSTANTS.CLEANUP.MAX_BULLETS) {
      const excess =
        this.bullets.length - PERFORMANCE_CONSTANTS.CLEANUP.MAX_BULLETS;
      this.bullets.splice(0, excess).forEach((bullet) => {
        if ("gameObject" in bullet && bullet.gameObject) {
          (bullet.gameObject as any).destroy();
        }
      });
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
    // 디버그 플랫폼 추가 로그 비활성화
    // Debug.log.debug(LogCategory.MAP, "플랫폼 추가됨", platform);
  }

  public addBullet(bullet: Bullet): void {
    this.bullets.push(bullet);
    // 디버그 총알 추가 로그 비활성화
    // Debug.log.debug(LogCategory.GAME, "이알 추가됨", bullet);
  }

  public removeBullet(id: string): void {
    const bullet = this.bullets.find((b) => b.id === id);
    if (bullet && "gameObject" in bullet && bullet.gameObject) {
      (bullet.gameObject as any).destroy();
    }
    this.bullets = this.bullets.filter((b) => b.id !== id);
    // 디버그 총알 제거 로그 비활성화
    // Debug.log.debug(LogCategory.GAME, "이알 제거됨", { id });
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
  public getSceneState(): any {
    return this.sceneState;
  }

  // ☆ 멀티플레이어 관련 Getter들
  public getRemotePlayers(): Map<string, RemotePlayer> {
    return this.remotePlayers;
  }

  // 로딩 모달 상태 getter
  public getLoadingModalState(): {
    isOpen: boolean;
    currentPlayers: number;
    expectedPlayers: number;
    roomName: string;
  } {
    return {
      isOpen: this.isLoadingModalOpen,
      currentPlayers: this.remotePlayers.size + 1,
      expectedPlayers: this.expectedPlayerCount,
      roomName: this.gameData?.room.roomName || "Unknown Room",
    };
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
    // 씬 상태 확
    if (
      !this.scene ||
      !this.scene.add ||
      this.sceneState !== GAME_STATE.SCENE_STATES.RUNNING
    ) {
      console.warn("씬이 준비되지 않아 파티클 효과 생성 건너뜀");
      return;
    }

    try {
      if (fancy) {
        this.particleSystem.createFancyParticleExplosion(x, y);
      } else {
        // 플레이어 색상을 가져와서 파티클에 적용
        const playerColor = this.player?.getCurrentPreset
          ? (CHARACTER_PRESETS as any)[this.player.getCurrentPreset()]?.head ||
            0xee9841
          : 0xee9841;
        this.particleSystem.createParticleExplosion(x, y, playerColor);
      }
    } catch (error) {
      console.warn("파티클 효과 생성 중 오류:", error);
    }
  }

  // 맵 전환
  public async changeMap(mapKey: MapKey): Promise<void> {
    await this.switchMap(mapKey);
  }

  // UI 제어
  public toggleUI(): boolean {
    // UI 토글 기능은 필요시 구현
    return true;
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
    return {
      current: 0,
      max: 0,
      isReloading: false,
    };
  }

  // 입력 제어
  public setInputEnabled(enabled: boolean): void {
    this.inputManager.setEnabled(enabled);
  }

  // 화면 크기 변경 처리
  public resize(width: number, height: number): void {
    this.mapRenderer?.handleResize?.(width, height);
    this.cameraManager?.handleResize(width, height);
    this.uiManager?.handleResize(width, height);
    // this.shadowManager?.handleResize(width, height);
    this.shootingManager?.handleResize(width, height);
  }

  // 게임 상태 관리
  public pauseGame(): void {
    this.scene.pause();
    this.setInputEnabled(false);
    this.sceneState = GAME_STATE.SCENE_STATES.PAUSED;
  }

  public resumeGame(): void {
    this.scene.resume();
    this.setInputEnabled(true);
    this.sceneState = GAME_STATE.SCENE_STATES.RUNNING;
  }

  public resetScene(): void {
    this.sceneState = GAME_STATE.SCENE_STATES.TRANSITION;

    // 현재 맵 다시 로드
    this.changeMap(this.currentMapKey);
  }

  // 디버그 정보 가져오기
  public getDebugInfo() {
    return {
      scene: {
        name: this.scene.key,
        state: this.sceneState,
        isMultiplayer: this.isMultiplayer,
        playerCount: this.remotePlayers.size + 1,
      },
      constants: {
        gravity: this.physics.world.gravity.y,
      },
    };
  }

  // 개발자 도구
  public getDevTools() {
    const shootingTools = this.shootingManager?.getDebugTools();
    const networkTools = this.networkManager?.getDevTools();

    return {
      // 기존 도구들
      teleportPlayer: (x: number, y: number) => {
        this.setPlayerPosition(x, y);
      },

      logFullState: () => {
        this.logAllDebugInfo();
      },

      // 멀티플레이어 디버그 도구들
      listRemotePlayers: () => {
        const playerIds = Array.from(this.remotePlayers.keys());
        for (let i = 0; i < playerIds.length; i++) {
          const playerId = playerIds[i];
          const remote = this.remotePlayers.get(playerId);
          if (!remote) continue;
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
            health: 100, // 기본 체력값 사용
          });
        }
      },
    };
  }

  // 모든 매니저의 디버그 정보 출력
  public logAllDebugInfo(): void {
    // 디버그 로깅 비활성화
    return;
  }

  // 에러 처리
  private handleError(error: Error, context: string): void {
    this.sceneState = GAME_STATE.SCENE_STATES.ERROR;

    // 에러 발생 시 기본 상태로 복구 시도
    try {
      // 안전한 상태로 되돌리기
      this.setInputEnabled(false);

      // 기본 맵으로 리셋 시도
      setTimeout(() => {
        this.resetScene();
      }, 1000);
    } catch (resetError) {
      // 최후의 수단: 씬 재시작
      this.scene.restart();
    }
  }

  // Phaser Scene 생명주기 - shutdown
  shutdown(): void {
    // 상태 변경
    this.sceneState = GAME_STATE.SCENE_STATES.LOADING;

    //모든 이름표 정리
    this.uiManager.destroyAllNameTags();

    // ☆ 네트워크 매니저 정리
    try {
      this.networkManager?.destroy();
    } catch (error) {
      // 네트워크 매니저 정리 중 에러
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
    } catch (error) {
      // 원격 플레이어 정리 중 에러
    }

    // ☆ 충돌 시스템 정리
    try {
      this.collisionSystem?.destroy();
    } catch (error) {
      // 충돌 시스템 정리 중 에러
    }

    // 매니저들 정리 (순서 중요)
    try {
      this.shootingManager?.destroy();
      this.inputManager?.destroy();
      this.shadowManager?.destroy();
      this.uiManager?.destroy();
      this.debugRenderer?.destroy(); // ☆ 디버그 렌더러 정리
    } catch (error) {
      // 매니저 정리 중 에러
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
      // 게임 오브젝트 정리 중 에러
    }

    // 상태 초기화
    this.isInitialized = false;
    this.frameCount = 0;
    this.performanceTimer = 0;
    this.isMultiplayer = false;
    this.myPlayerId = null;
    this.gameData = null;
  }

  // 디버그 도구들
  public getDebugTools() {
    return {
      // 테스트 기능들 제거
      // spawnTestObjects, stressTest, createTestRemotePlayer, simulateTestBullet 제거
    };
  }

  // 🆕 안전한 이름표 생성 헬퍼
  private canCreateText(): boolean {
    const add: any = (this as any)?.add;
    const isActive = (this as any)?.sys?.isActive?.() ?? true;
    return !!(
      add &&
      typeof add.text === "function" &&
      isActive &&
      this.sceneState === GAME_STATE.SCENE_STATES.RUNNING
    );
  }

  private tryCreateNameTag(playerId: string, name: string): void {
    if (!this.uiManager) return;
    if (this.canCreateText()) {
      this.uiManager.createNameTag(playerId, name);
    } else {
      setTimeout(() => {
        if (this.canCreateText()) {
          this.uiManager.createNameTag(playerId, name);
        }
      }, 50);
    }
  }
  private playerHide(): void {
    try {
      (this.player as any)?.setVisible?.(false);
    } catch {}
  }

  private playerShow(): void {
    try {
      (this.player as any)?.setVisible?.(true);
    } catch {}
  }
}

// src/game/GameScene.ts - 중복 마우스 이벤트 제거
import { Platform, Bullet } from "./config";
import Player from "./player/Player";
import MapRenderer from "./MapRenderer";
import { MapLoader } from "./maps/MapLoader";
import { ParticleSystem } from "./particle";
import { CollisionSystem } from "./systems/CollisionSystem";

// 디버그 시스템
import { Debug, debugManager } from "./debug/DebugManager";
import { LogCategory } from "./debug/Logger";

// 매니저들
import { InputManager } from "./managers/InputManager";
import { UIManager } from "./managers/UIManager";
import { CameraManager } from "./managers/CameraManager";
import { ShadowManager } from "./managers/ShadowManager";
import { ShootingManager } from "./managers/ShootingManager"; // 🔥 새로 분리된 매니저

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

  // 매니저들
  private inputManager!: InputManager;
  private uiManager!: UIManager;
  private cameraManager!: CameraManager;
  private shadowManager!: ShadowManager;
  private shootingManager!: ShootingManager; // 🔥 사격 시스템 매니저

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

      // 🔥 매니저들 초기화 (순서 중요)
      await this.initializeManagers();

      // 플레이어 생성
      this.createPlayer(data?.spawn);
      this.player.setCollisionSystem(this.collisionSystem);
      this.collisionSystem.setPlayer(this.player);

      // 🔥 사격 시스템과 플레이어 연결
      this.shootingManager.setPlayer(this.player);

      // 추가 데이터 처리
      this.processAdditionalData(data);

      // 파티클 시스템 초기화
      this.particleSystem = new ParticleSystem(this, true);

      // 🚫 기본 마우스 이벤트 제거 - ShootingManager에서만 처리하도록 함

      this.sceneState = GAME_STATE.SCENE_STATES.RUNNING;
      this.isInitialized = true;

      Debug.log.info(
        LogCategory.SCENE,
        "GameScene 생성 완료 - ShootingManager만 사격 처리"
      );
    } catch (error) {
      this.sceneState = GAME_STATE.SCENE_STATES.ERROR;
      this.handleError(error as Error, "씬 생성");
    }
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

    // 🔥 사격 매니저 초기화
    this.shootingManager = new ShootingManager(this, {
      fireRate: 300, // 분당 300발
      damage: 25,
      accuracy: 0.95,
      recoil: 2.0,
      muzzleVelocity: 1000,
      magazineSize: 6, // 🎯 6발 탄창
      reloadTime: 1000, // 🎯 1초 재장전
      burstCount: 1,
      burstDelay: 100,
    });
    this.shootingManager.initialize();

    // 🔥 사격 시스템 충돌 설정
    this.shootingManager.setupCollisions(this.platformGroup);

    // 🔥 사격 이벤트 콜백 설정
    this.setupShootingCallbacks();

    // 입력 매니저 (마지막에 초기화 - 콜백 연결 후)
    this.inputManager = new InputManager(this);
    this.setupInputCallbacks();
    this.inputManager.initialize();

    // UI 상태 업데이트
    this.updateAllUI();

    Debug.log.info(
      LogCategory.SCENE,
      "매니저 초기화 완료 - ShootingManager 포함"
    );
  }

  // 🔥 사격 시스템 콜백 설정
  private setupShootingCallbacks(): void {
    // 사격시 파티클 효과
    this.shootingManager.onShot((recoil) => {
      Debug.log.debug(LogCategory.GAME, `사격 반동: ${recoil}`);
    });

    // 재장전시 로그
    this.shootingManager.onReload(() => {
      Debug.log.info(LogCategory.GAME, "재장전 시작");
    });

    // 명중시 파티클 효과
    this.shootingManager.onHit((x, y) => {
      this.createParticleEffect(x, y, false);
      Debug.log.debug(LogCategory.GAME, `총알 명중: (${x}, ${y})`);
    });
  }

  private initializePhysicsGroups(): void {
    Debug.log.info(LogCategory.SCENE, "Physics Groups 초기화 시작");

    // 총알 그룹 생성
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

      console.log(
        `🟢 Platform ${index}: (${platform.x}, ${platform.y}) ${platform.width}x${platform.height}`
      );
    });

    // CollisionSystem 생성
    this.collisionSystem = new CollisionSystem(
      this,
      this.bulletGroup,
      this.platformGroup
    );

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
        `추가 총알 ${data.bullets.length}개 로드됨`
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
    }

    // 그림자 시스템 업데이트
    if (this.mapRenderer) {
      this.mapRenderer.updateShadows();
    }

    // 🔥 사격 시스템 업데이트
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
        `총알 정리: ${initialCount - this.bullets.length}개 제거`
      );
    }

    // 최대 총알 수 제한
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
        `최대 총알 수 초과로 ${excess}개 강제 제거`
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
    Debug.log.debug(LogCategory.GAME, "총알 추가됨", bullet);
  }

  public removeBullet(id: string): void {
    const bullet = this.bullets.find((b) => b.id === id);
    if (bullet && "gameObject" in bullet && bullet.gameObject) {
      (bullet.gameObject as any).destroy();
    }
    this.bullets = this.bullets.filter((b) => b.id !== id);
    Debug.log.debug(LogCategory.GAME, "총알 제거됨", { id });
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
  // 🔥 새로운 매니저 접근자
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

  // 🔥 사격 시스템 제어
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
    // 🔥 사격 UI 리사이즈
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
        // 🔥 사격 시스템 정보 추가
        shooting: this.shootingManager?.getAmmoStatus(),
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

      // 🔥 사격 시스템 도구들 통합
      ...shootingTools,
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
    // 🔥 사격 매니저 디버그 정보
    this.shootingManager?.debugInfo();

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

    // 매니저들 정리 (순서 중요)
    try {
      // 🔥 사격 매니저 정리
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

      // 총알들 정리
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

    Debug.log.info(
      LogCategory.SCENE,
      "GameScene shutdown 완료 - 중복 마우스 이벤트 제거됨"
    );
  }
}

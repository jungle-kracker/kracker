// src/game/MapRenderer.ts - 플랫폼을 물리 바디로 변경
import { GAME_CONFIG, Platform } from "./config";
import { MapData, MapLoader } from "./maps/MapLoader";
import { ShadowSystem } from "./shadow/ShadowSystem";

export default class MapRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  private platforms: Platform[] = [];
  private currentMap?: MapData;
  private backgroundImages: Phaser.GameObjects.Image[] = [];

  // ⭐ 물리 바디를 가진 플랫폼 그룹 추가
  private platformGroup: Phaser.Physics.Arcade.StaticGroup;

  // 그림자 시스템
  private shadowSystem: ShadowSystem;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();

    this.backgroundGraphics = scene.add.graphics();

    // ⭐ 플랫폼 물리 그룹 생성
    this.platformGroup = scene.physics.add.staticGroup();

    // 배경이 가장 뒤에 오도록 depth 설정
    this.backgroundGraphics.setDepth(-100);
    this.graphics.setDepth(0);

    // 그림자 시스템 초기화
    this.shadowSystem = new ShadowSystem(scene, {
      light: {
        angle: 90,
        color: 0x000a25,
        maxLength: 2000,
      },
      depth: -50,
      enabled: true,
    });

    console.log("MapRenderer with Physics Platforms created");
  }

  /** 맵 로드 */
  public async loadMapPreset(mapKey: string): Promise<void> {
    try {
      let mapData = MapLoader.getPreset(mapKey);
      if (!mapData) {
        mapData = await MapLoader.loadTiledPreset(mapKey);
      }

      this.currentMap = mapData;
      this.renderMap();

      console.log(`Map loaded: ${mapKey}`);
      this.updateShadows();
    } catch (error) {
      console.error(`Failed to load map ${mapKey}:`, error);
      throw error;
    }
  }

  /** 맵 렌더링 - 배경 + 플랫폼 */
  private renderMap(): void {
    if (!this.currentMap) return;

    // 기존 그래픽 클리어
    this.graphics.clear();
    this.backgroundGraphics.clear();

    // ⭐ 기존 플랫폼 물리 바디들 제거
    this.clearPlatforms();

    // 기존 배경 이미지들 제거
    this.clearBackgroundImages();

    // 배경 렌더링
    this.renderBackground();

    // ⭐ 플랫폼을 물리 바디로 생성
    this.platforms = this.currentMap.platforms;
    this.createPhysicsPlatforms();

    console.log("Rendered platforms:", this.platforms.length);
  }

  /** ⭐ 기존 플랫폼들 제거 */
  private clearPlatforms(): void {
    this.platformGroup.clear(true, true); // removeFromScene=true, destroyChild=true
  }

  /** ⭐ 물리 바디를 가진 플랫폼들 생성 */
  private createPhysicsPlatforms(): void {
    this.platforms.forEach((platform, index) => {
      // 1. 시각적 표현을 위한 그래픽 (기존과 동일)
      this.graphics.fillStyle(0xc0c0c0);
      this.graphics.fillRect(
        platform.x,
        platform.y,
        platform.width,
        platform.height
      );

      // 2. 충돌 감지를 위한 물리 바디 생성
      const platformSprite = this.scene.add.rectangle(
        platform.x + platform.width / 2, // 중심점 기준
        platform.y + platform.height / 2,
        platform.width,
        platform.height,
        0xc0c0c0, // 같은 색상
        0 // 투명하게 (시각적으로는 graphics가 담당)
      );

      // 물리 바디 설정
      platformSprite.setName(`platform_${index}`);

      // StaticGroup에 추가 (자동으로 물리 바디 생성됨)
      this.platformGroup.add(platformSprite);

      // 물리 바디 설정 세부 조정
      const body = platformSprite.body as Phaser.Physics.Arcade.StaticBody;
      if (body) {
        // 바디 크기를 정확히 설정
        body.setSize(platform.width, platform.height);
        body.updateFromGameObject();
      }
    });

    console.log(`Created ${this.platforms.length} physics platforms`);
  }

  /** ⭐ 플랫폼 그룹 반환 (충돌 감지용) */
  public getPlatformGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.platformGroup;
  }

  // ===== 기존 메서드들 (변경 없음) =====

  /** 그림자 업데이트 */
  public updateShadows(): void {
    const camera = this.scene.cameras.main;
    const cameraInfo = {
      x: camera.scrollX,
      y: camera.scrollY,
      width: camera.width,
      height: camera.height,
    };

    this.shadowSystem.update(this.platforms, cameraInfo);
  }

  /** 그림자 강제 업데이트 */
  public forceShadowUpdate(): void {
    const camera = this.scene.cameras.main;
    const cameraInfo = {
      x: camera.scrollX,
      y: camera.scrollY,
      width: camera.width,
      height: camera.height,
    };

    this.shadowSystem.forceUpdate(this.platforms, cameraInfo);
  }

  /** 리사이즈 핸들러 */
  public handleResize(width: number, height: number): void {
    console.log(`MapRenderer resize: ${width}x${height}`);

    if (this.currentMap?.background) {
      this.backgroundGraphics.clear();
      this.clearBackgroundImages();
      this.renderBackground();
    }

    this.forceShadowUpdate();
  }

  // 그림자 시스템 제어 메서드들
  public setLightAngle(angle: number): void {
    this.shadowSystem.setLightAngle(angle);
  }

  public animateLightAngle(targetAngle: number, duration: number = 1000): void {
    this.shadowSystem.animateLightAngle(targetAngle, duration);
  }

  public setShadowColor(color: number): void {
    this.shadowSystem.setShadowColor(color);
  }

  public setShadowEnabled(enabled: boolean): void {
    this.shadowSystem.setEnabled(enabled);
  }

  public applyShadowPreset(
    preset: "morning" | "noon" | "evening" | "night"
  ): void {
    this.shadowSystem.applyPreset(preset);
  }

  public getShadowSystem(): ShadowSystem {
    return this.shadowSystem;
  }

  // ===== 배경 렌더링 메서드들 (기존과 동일) =====

  private clearBackgroundImages(): void {
    this.backgroundImages.forEach((img) => {
      if (img && img.scene) {
        img.destroy();
      }
    });
    this.backgroundImages = [];

    this.scene.children.getAll().forEach((child) => {
      if (
        child instanceof Phaser.GameObjects.Image &&
        (child.texture.key.startsWith("gradient_") ||
          child.texture.key.startsWith("gradient_overlay_"))
      ) {
        child.destroy();
      }
    });

    const textureManager = this.scene.textures;
    const keysToRemove: string[] = [];

    if (textureManager.list && typeof textureManager.list === "object") {
      Object.keys(textureManager.list).forEach((key: string) => {
        if (
          key.startsWith("gradient_") ||
          key.startsWith("gradient_overlay_")
        ) {
          keysToRemove.push(key);
        }
      });
    }

    keysToRemove.forEach((key: string) => {
      if (textureManager.exists(key)) {
        textureManager.remove(key);
      }
    });
  }

  private renderBackground(): void {
    if (!this.currentMap?.background) return;

    const { background } = this.currentMap;
    const width = this.scene.sys.game.canvas.width;
    const height = this.scene.sys.game.canvas.height;

    if (background.type === "solid" && background.color) {
      const color = this.hexToNumber(background.color);
      this.backgroundGraphics.fillStyle(color);
      this.backgroundGraphics.fillRect(0, 0, width, height);
    } else if (background.type === "gradient" && background.gradient) {
      this.backgroundGraphics.clear();
      this.renderGradientBackground(background.gradient, width, height);
    } else if (background.type === "image" && background.image) {
      const parallax =
        typeof background.parallax === "number" ? background.parallax : 0;

      if (this.scene.textures.exists(background.image as string)) {
        const bgImg = this.scene.add.image(0, 0, background.image as string);
        bgImg.setOrigin(0, 0);
        bgImg.setDisplaySize(width, height);
        bgImg.setDepth(-300);
        bgImg.setScrollFactor(parallax);
        this.backgroundImages.push(bgImg);
      }

      if (background.gradient) {
        this.renderGradientBackground(background.gradient, width, height);
      }
    } else if (background.type === "image+gradient") {
      if (background.image) {
        const parallax =
          typeof background.parallax === "number" ? background.parallax : 0;

        if (this.scene.textures.exists(background.image as string)) {
          const bgImg = this.scene.add.image(0, 0, background.image as string);
          bgImg.setOrigin(0, 0);
          bgImg.setDisplaySize(width, height);
          bgImg.setDepth(-300);
          bgImg.setScrollFactor(parallax);
          this.backgroundImages.push(bgImg);
        } else {
          this.backgroundGraphics.fillStyle(0x2d5a2d);
          this.backgroundGraphics.fillRect(0, 0, width, height);
        }
      }

      if (background.gradient) {
        this.renderDirectGradientOverlay(background.gradient, width, height);
      }
    }
  }

  private renderDirectGradientOverlay(
    gradient: { top: string; bottom: string },
    width: number,
    height: number
  ): void {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const linearGradient = ctx.createLinearGradient(0, 0, 0, height);
    linearGradient.addColorStop(0, gradient.top);
    linearGradient.addColorStop(1, gradient.bottom);

    ctx.fillStyle = linearGradient;
    ctx.fillRect(0, 0, width, height);

    const textureKey = `gradient_overlay_${gradient.top}_${gradient.bottom}_${width}_${height}`;

    if (this.scene.textures.exists(textureKey)) {
      this.scene.textures.remove(textureKey);
    }

    this.scene.textures.addCanvas(textureKey, canvas);

    const gradientImage = this.scene.add.image(0, 0, textureKey);
    gradientImage.setOrigin(0, 0);
    gradientImage.setDepth(-200);
    gradientImage.setScrollFactor(0);
    gradientImage.setAlpha(0.6);

    this.backgroundImages.push(gradientImage);
  }

  private renderGradientBackground(
    gradient: { top: string; bottom: string; direction?: string },
    width: number,
    height: number
  ): void {
    const textureKey = `gradient_${gradient.top}_${gradient.bottom}_${width}_${height}`;

    if (!this.scene.textures.exists(textureKey)) {
      this.createGradientTexture(textureKey, gradient, width, height);
    }

    const background = this.scene.add.image(0, 0, textureKey);
    background.setOrigin(0, 0);
    background.setDepth(-200);
    background.setScrollFactor(0);
    background.setBlendMode(Phaser.BlendModes.NORMAL);
    background.setAlpha(0.6);

    this.backgroundImages.push(background);
  }

  private createGradientTexture(
    key: string,
    gradient: { top: string; bottom: string },
    width: number,
    height: number
  ): void {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const linearGradient = ctx.createLinearGradient(0, 0, 0, height);
    linearGradient.addColorStop(0, gradient.top);
    linearGradient.addColorStop(1, gradient.bottom);

    ctx.fillStyle = linearGradient;
    ctx.fillRect(0, 0, width, height);

    this.scene.textures.addCanvas(key, canvas);
  }

  private hexToNumber(hex: string): number {
    const cleaned = hex.replace("#", "");
    return parseInt(cleaned, 16);
  }

  // ===== 기존 접근 메서드들 =====

  public getPlatforms(): Platform[] {
    return this.platforms;
  }

  public getCurrentMap(): MapData | undefined {
    return this.currentMap;
  }

  public getSpawns() {
    return this.currentMap?.spawns || [];
  }

  public getMapSize(): { width: number; height: number } {
    if (!this.currentMap) {
      return { width: GAME_CONFIG.width, height: GAME_CONFIG.height };
    }
    return {
      width: this.currentMap.meta.width,
      height: this.currentMap.meta.height,
    };
  }

  /** 리소스 정리 */
  public destroy(): void {
    this.clearBackgroundImages();
    this.clearPlatforms(); // ⭐ 플랫폼 물리 바디도 정리

    this.graphics?.destroy();
    this.backgroundGraphics?.destroy();
    this.shadowSystem?.destroy();

    console.log("MapRenderer destroyed");
  }
}

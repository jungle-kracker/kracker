// src/game/MapRenderer.ts - 플랫폼을 물리 바디로 변경
import { GAME_CONFIG, Platform } from "./Config";
import { MapData, MapLoader } from "./maps/MapLoader";
import { ShadowSystem } from "./shadow/ShadowSystem";

export default class MapRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  private platforms: Platform[] = [];
  private currentMap?: MapData;
  private backgroundImages: Phaser.GameObjects.Image[] = [];
  private backgroundNoise?: Phaser.GameObjects.TileSprite;
  private crumbledPattern?: Phaser.GameObjects.Graphics;

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
      // 1. 시각적 표현을 위한 그라데이션 그래픽
      this.drawPlatformGradient(platform);

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
      platformSprite.setDepth(20); // 플랫폼 depth 설정

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

  /** ⭐ 플랫폼 그라데이션 그리기 */
  private drawPlatformGradient(platform: Platform): void {
    // 초록-파랑 왔다갔다 그라데이션 색상 조합들
    const colorSchemes = [
      // 1. 민트 → 틸 그린 (초록 → 청록)
      { top: 0xb8e6b8, bottom: 0x20b2aa },
      // 2. 틸 그린 → 스틸 블루 (청록 → 스틸 블루)
      { top: 0x20b2aa, bottom: 0x4682b4 },
      // 3. 스틸 블루 → 포레스트 그린 (파랑 → 초록)
      { top: 0x4682b4, bottom: 0x228b22 },
      // 4. 포레스트 그린 → 틸 그린 (초록 → 청록)
      { top: 0x228b22, bottom: 0x20b2aa },
      // 5. 틸 그린 → 민트 (청록 → 연한 초록)
      { top: 0x20b2aa, bottom: 0xb8e6b8 },
    ];

    // 플랫폼 위치에 따라 다른 색상 스킴 선택 (다채롭게)
    const schemeIndex =
      Math.floor((platform.x + platform.y) / 200) % colorSchemes.length;
    const colorScheme = colorSchemes[schemeIndex];

    const topColor = colorScheme.top;
    const bottomColor = colorScheme.bottom;

    // 더 부드러운 그라데이션을 위해 픽셀 단위로 그리기
    const gradientSteps = Math.max(platform.height, 32); // 최소 32단계 보장
    const stepHeight = 1; // 1픽셀씩

    for (let i = 0; i < gradientSteps; i++) {
      const y = platform.y + i;
      const progress = i / (gradientSteps - 1);

      // 색상 보간
      const r1 = (topColor >> 16) & 0xff;
      const g1 = (topColor >> 8) & 0xff;
      const b1 = topColor & 0xff;

      const r2 = (bottomColor >> 16) & 0xff;
      const g2 = (bottomColor >> 8) & 0xff;
      const b2 = bottomColor & 0xff;

      const r = Math.round(r1 + (r2 - r1) * progress);
      const g = Math.round(g1 + (g2 - g1) * progress);
      const b = Math.round(b1 + (b2 - b1) * progress);

      const color = (r << 16) | (g << 8) | b;

      this.graphics.fillStyle(color);
      this.graphics.fillRect(platform.x, y, platform.width, stepHeight);
    }
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

    // 노이즈 이미지 정리
    if (this.backgroundNoise && this.backgroundNoise.scene) {
      this.backgroundNoise.destroy();
      this.backgroundNoise = undefined;
    }

    // 구겨진 패턴 정리
    if (this.crumbledPattern && this.crumbledPattern.scene) {
      this.crumbledPattern.destroy();
      this.crumbledPattern = undefined;
    }

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

    // 배경에 구겨진 사각형 패턴 추가 (입체감)
    this.addCrumbledSquaresPattern(width, height);

    // 배경에 노이즈 효과 추가
    this.addBackgroundNoise(width, height);
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

  /** 배경에 구겨진 사각형 패턴 추가 (입체감) */
  private addCrumbledSquaresPattern(width: number, height: number): void {
    // 기존 패턴 정리
    if (this.crumbledPattern && this.crumbledPattern.scene) {
      this.crumbledPattern.destroy();
    }

    // 구겨진 사각형 패턴을 위한 그래픽 객체 생성
    this.crumbledPattern = this.scene.add.graphics();
    this.crumbledPattern.setDepth(-280); // 배경보다 뒤, 노이즈보다 뒤

    // 다양한 크기의 구겨진 사각형들 생성
    const squareCount = 15;
    const colors = [
      0x1a4a5a, // 어두운 청록
      0x2d5a6b, // 중간 청록
      0x1e3a4a, // 더 어두운 청록
      0x2a4a5a, // 약간 밝은 청록
    ];

    for (let i = 0; i < squareCount; i++) {
      const size = Math.random() * 80 + 40; // 40-120 크기
      const x = Math.random() * width;
      const y = Math.random() * height;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const alpha = Math.random() * 0.4 + 0.1; // 0.1-0.5 투명도
      const rotation = Math.random() * Math.PI * 2; // 랜덤 회전

      // 구겨진 사각형 그리기
      this.crumbledPattern.fillStyle(color, alpha);

      // 구겨진 모양을 위해 불규칙한 점들로 사각형 그리기
      const points = [];
      const segments = 8;
      for (let j = 0; j < segments; j++) {
        const angle = (j / segments) * Math.PI * 2 + rotation;
        const radius = size / 2 + (Math.random() - 0.5) * 20; // 구겨진 효과
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        points.push({ x: px, y: py });
      }

      // 구겨진 사각형 채우기
      this.crumbledPattern.beginPath();
      this.crumbledPattern.moveTo(points[0].x, points[0].y);
      for (let j = 1; j < points.length; j++) {
        this.crumbledPattern.lineTo(points[j].x, points[j].y);
      }
      this.crumbledPattern.closePath();
      this.crumbledPattern.fill();
    }
  }

  /** 배경에 노이즈 효과 추가 */
  private addBackgroundNoise(width: number, height: number): void {
    // 노이즈 텍스처 생성
    const noiseKey = "background_noise";

    if (this.scene.textures.exists(noiseKey)) {
      this.scene.textures.remove(noiseKey);
    }

    // 노이즈 캔버스 생성
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = 256;
    canvas.height = 256;

    // 노이즈 패턴 생성
    const imageData = ctx.createImageData(256, 256);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 255;
      const alpha = Math.random() * 30 + 10; // 10-40 알파값으로 은은하게

      data[i] = noise; // R
      data[i + 1] = noise; // G
      data[i + 2] = noise; // B
      data[i + 3] = alpha; // A
    }

    ctx.putImageData(imageData, 0, 0);

    // Phaser 텍스처로 변환
    this.scene.textures.addCanvas(noiseKey, canvas);

    // 노이즈 오버레이 이미지 생성
    this.backgroundNoise = this.scene.add.tileSprite(
      0,
      0,
      width,
      height,
      noiseKey
    );
    this.backgroundNoise.setOrigin(0, 0);
    this.backgroundNoise.setDepth(-250); // 배경보다 앞, 다른 요소들보다 뒤
    this.backgroundNoise.setAlpha(0.3); // 투명도 조절
    this.backgroundNoise.setScrollFactor(0.1); // 약간의 패럴랙스 효과
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

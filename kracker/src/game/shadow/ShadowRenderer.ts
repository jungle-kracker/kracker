// src/game/shadow/ShadowRenderer.ts - 블렌드 완전 제거 + 긴 사다리꼴
import { Platform } from "../config";
import { ShadowCalculator } from "./ShadowCalculator";
import {
  ShadowRendererConfig,
  DEFAULT_SHADOW_CONFIG,
  CameraInfo,
  LightConfig,
  ShadowPolygon,
} from "./ShadowTypes";

export class ShadowRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private calculator: ShadowCalculator;
  private config: ShadowRendererConfig;

  // 🎯 블렌드 완전 제거: 단일 통합 패스 렌더링
  private shadowCanvas: HTMLCanvasElement | null = null;
  private shadowCtx: CanvasRenderingContext2D | null = null;
  private shadowTexture: Phaser.Textures.CanvasTexture | null = null;
  private shadowImage: Phaser.GameObjects.Image | null = null;

  // 성능 최적화
  private lastUpdateTime: number = 0;
  private updateThrottle: number = 100;
  private lastCameraHash: string = "";

  constructor(scene: Phaser.Scene, config?: Partial<ShadowRendererConfig>) {
    this.scene = scene;

    this.config = {
      ...DEFAULT_SHADOW_CONFIG,
      ...config,
      light: {
        ...DEFAULT_SHADOW_CONFIG.light,
        angle: 90,
        color: 0x1a1f26,
        maxLength: 1500, // 🔧 더 긴 그림자
        ...config?.light,
      },
    };

    // 기본 Graphics 객체 (호환성)
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(this.config.depth);
    this.graphics.setScrollFactor(1, 1);

    // 🎯 Canvas 기반 통합 그림자 시스템 초기화
    this.initializeCanvasShadowSystem();

    // 계산기 생성
    this.calculator = new ShadowCalculator(this.config.light);

    console.log("🎨 No-Blend Shadow Renderer created");
  }

  /** 🎯 Canvas 기반 블렌드 없는 그림자 시스템 */
  private initializeCanvasShadowSystem(): void {
    const width = this.scene.sys.game.canvas.width;
    const height = this.scene.sys.game.canvas.height;

    // Canvas 생성
    this.shadowCanvas = document.createElement("canvas");
    this.shadowCanvas.width = width;
    this.shadowCanvas.height = height;
    this.shadowCtx = this.shadowCanvas.getContext("2d");

    if (!this.shadowCtx) {
      console.error("❌ Canvas context 생성 실패");
      return;
    }

    // Phaser 텍스처로 등록
    const textureKey = "unified_shadow_texture";
    if (this.scene.textures.exists(textureKey)) {
      this.scene.textures.remove(textureKey);
    }

    this.shadowTexture = this.scene.textures.addCanvas(
      textureKey,
      this.shadowCanvas
    );

    // 그림자 이미지 생성
    this.shadowImage = this.scene.add.image(0, 0, textureKey);
    this.shadowImage.setOrigin(0, 0);
    this.shadowImage.setDepth(this.config.depth);
    this.shadowImage.setScrollFactor(0, 0); // 화면 고정
    this.shadowImage.setAlpha(0.5); // 🔧 적절한 투명도
  }

  /** 그림자 업데이트 */
  public update(platforms: Platform[], camera: CameraInfo): void {
    if (!this.config.enabled || platforms.length === 0) {
      this.clear();
      return;
    }

    const now = Date.now();
    const cameraHash = this.getCameraHash(camera);

    if (
      now - this.lastUpdateTime < this.updateThrottle &&
      cameraHash === this.lastCameraHash
    ) {
      return;
    }

    this.lastUpdateTime = now;
    this.lastCameraHash = cameraHash;

    const norm = platforms.map((p) => this.normalizePlatform(p as any));
    this.renderUnifiedShadows(norm, camera);
  }

  /** 강제 업데이트 */
  public forceUpdate(platforms: Platform[], camera: CameraInfo): void {
    if (!this.config.enabled) {
      this.clear();
      return;
    }

    this.lastUpdateTime = 0;
    this.lastCameraHash = "";

    const norm = platforms.map((p) => this.normalizePlatform(p as any));
    this.renderUnifiedShadows(norm, camera);
  }

  /** 🎯 블렌드 완전 제거 통합 그림자 렌더링 */
  private renderUnifiedShadows(
    platforms: Platform[],
    camera: CameraInfo
  ): void {
    if (!this.shadowCtx || !this.shadowTexture || !this.shadowImage) {
      return;
    }

    // 그림자 계산
    const result = this.calculator.calculateShadows(platforms, camera);
    if (result.polygons.length === 0) {
      this.clear();
      return;
    }

    // 🎯 Step 1: Canvas 클리어
    this.shadowCtx.clearRect(
      0,
      0,
      this.shadowCanvas!.width,
      this.shadowCanvas!.height
    );

    // 🎯 Step 2: 단일 패스로 모든 그림자를 하나의 모양으로 그리기
    this.shadowCtx.fillStyle = "#ffffff"; // 흰색 마스크
    this.shadowCtx.globalCompositeOperation = "source-over"; // 기본 합성

    // 🔧 방법 1: 모든 그림자를 한 번에 그리기 (블렌드 없음)
    this.shadowCtx.beginPath();

    let pathStarted = false;
    let renderedCount = 0;

    for (const polygon of result.polygons) {
      if (polygon.points.length >= 8) {
        // 카메라 오프셋 적용
        const offsetX = -camera.x;
        const offsetY = -camera.y;

        if (!pathStarted) {
          this.shadowCtx.moveTo(
            polygon.points[0] + offsetX,
            polygon.points[1] + offsetY
          );
          pathStarted = true;
        } else {
          // 새로운 서브패스 시작
          this.shadowCtx.moveTo(
            polygon.points[0] + offsetX,
            polygon.points[1] + offsetY
          );
        }

        // 폴리곤 그리기
        for (let j = 2; j < polygon.points.length; j += 2) {
          this.shadowCtx.lineTo(
            polygon.points[j] + offsetX,
            polygon.points[j + 1] + offsetY
          );
        }

        this.shadowCtx.closePath();
        renderedCount++;
      }
    }

    // 한 번에 모든 그림자 채우기
    this.shadowCtx.fill();

    // 🎯 Step 3: 텍스처 업데이트 및 색상 적용
    this.shadowTexture.refresh();

    // 그림자 색상 틴트 적용
    this.shadowImage.setTint(this.config.light.color);
    this.shadowImage.setVisible(true);
  }

  /** 그림자 지우기 */
  public clear(): void {
    this.graphics.clear();

    if (this.shadowCtx && this.shadowCanvas) {
      this.shadowCtx.clearRect(
        0,
        0,
        this.shadowCanvas.width,
        this.shadowCanvas.height
      );
      this.shadowTexture?.refresh();
    }

    if (this.shadowImage) {
      this.shadowImage.setVisible(false);
    }
  }

  /** 빛 각도 변경 */
  public setLightAngle(angle: number): void {
    this.calculator.setLightAngle(angle);
    this.config.light.angle = angle;

    this.lastUpdateTime = 0;
    this.lastCameraHash = "";
  }

  /** 빛 설정 변경 */
  public updateLightConfig(newConfig: Partial<LightConfig>): void {
    this.config.light = { ...this.config.light, ...newConfig };
    this.calculator.updateLightConfig(this.config.light);

    if (newConfig.color !== undefined) {
      this.lastUpdateTime = 0;
      this.lastCameraHash = "";
    }
  }

  /** 그림자 시스템 활성화/비활성화 */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;

    if (!enabled) {
      this.clear();
    } else {
      this.lastUpdateTime = 0;
      this.lastCameraHash = "";
    }

    if (this.shadowImage) {
      this.shadowImage.setVisible(enabled);
    }
  }

  /** 화면 크기 변경 처리 */
  public handleResize(width: number, height: number): void {
    // Canvas 크기 조정
    if (this.shadowCanvas) {
      this.shadowCanvas.width = width;
      this.shadowCanvas.height = height;
    }

    // 그림자 이미지 위치 재조정
    if (this.shadowImage) {
      this.shadowImage.setPosition(0, 0);
    }

    this.lastUpdateTime = 0;
    this.lastCameraHash = "";
  }

  /** 렌더링 depth 변경 */
  public setDepth(depth: number): void {
    this.config.depth = depth;
    this.graphics.setDepth(depth);

    if (this.shadowImage) {
      this.shadowImage.setDepth(depth);
    }
  }

  // ===== 헬퍼 메서드들 =====

  private getCameraHash(camera: CameraInfo): string {
    const x = Math.round(camera.x / 20) * 20;
    const y = Math.round(camera.y / 20) * 20;
    const w = Math.round(camera.width / 20) * 20;
    const h = Math.round(camera.height / 20) * 20;
    return `${x},${y},${w},${h}`;
  }

  private normalizePlatform(p: any): Platform {
    const width = Number(p.width ?? p.w);
    const height = Number(p.height ?? p.h);
    const x = Number(p.x);
    const y = Number(p.y);

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      console.warn("[ShadowRenderer] 잘못된 플랫폼 치수", {
        x,
        y,
        width,
        height,
        raw: p,
      });
    }

    return { ...p, x, y, width, height } as Platform;
  }

  public getConfig(): ShadowRendererConfig {
    return { ...this.config };
  }

  /** 리소스 정리 */
  public destroy(): void {
    if (this.graphics) {
      this.graphics.destroy();
    }

    if (this.shadowImage) {
      this.shadowImage.destroy();
      this.shadowImage = null;
    }

    if (this.shadowTexture) {
      this.scene.textures.remove("unified_shadow_texture");
      this.shadowTexture = null;
    }

    this.shadowCanvas = null;
    this.shadowCtx = null;
  }
}

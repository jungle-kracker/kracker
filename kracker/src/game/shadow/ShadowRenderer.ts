// src/game/shadow/ShadowRenderer.ts - 수정된 렌더링 로직
import { Platform } from "../config";
import { ShadowCalculator } from "./ShadowCalculator";
import {
  ShadowRendererConfig,
  DEFAULT_SHADOW_CONFIG,
  CameraInfo,
  LightConfig,
} from "./ShadowTypes";

export class ShadowRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private calculator: ShadowCalculator;
  private config: ShadowRendererConfig;

  // 성능 최적화
  private lastUpdateTime: number = 0;
  private updateThrottle: number = 33; // ~30fps
  private lastCameraHash: string = "";

  constructor(scene: Phaser.Scene, config?: Partial<ShadowRendererConfig>) {
    this.scene = scene;
    this.config = { ...DEFAULT_SHADOW_CONFIG, ...config };

    // Graphics 객체 생성
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(this.config.depth);

    // 🔧 수정: scrollFactor를 1,1로 설정하여 카메라와 함께 움직이도록
    this.graphics.setScrollFactor(1, 1);

    // 계산기 생성
    this.calculator = new ShadowCalculator(this.config.light);

    console.log("ShadowRenderer created with config:", this.config);
    console.log("Graphics depth:", this.graphics.depth);
  }

  /** 그림자 업데이트 (메인 호출 메서드) */
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
      return; // 스킵
    }

    this.lastUpdateTime = now;
    this.lastCameraHash = cameraHash;

    const norm = platforms.map((p) => this.normalizePlatform(p as any));
    this.renderShadows(norm, camera);
  }

  /** 강제 업데이트 (맵 변경, 리사이즈 등) */
  public forceUpdate(platforms: Platform[], camera: CameraInfo): void {
    if (!this.config.enabled) {
      this.clear();
      return;
    }

    this.lastUpdateTime = 0; // throttle 리셋
    this.lastCameraHash = "";

    const norm = platforms.map((p) => this.normalizePlatform(p as any));
    this.renderShadows(norm, camera);
  }

  /** 실제 그림자 렌더링 */
  private renderShadows(platforms: Platform[], camera: CameraInfo): void {
    // 기존 그림자 지우기
    this.clear();

    // 그림자 계산
    const result = this.calculator.calculateShadows(platforms, camera);

    if (result.polygons.length === 0) {
      console.log("❌ 렌더링할 그림자가 없음");
      return;
    }

    // 🔧 수정: 더 진한 그림자로 변경
    const shadowAlpha = 0.4;
    this.graphics.fillStyle(this.config.light.color, shadowAlpha);

    // 각 그림자 폴리곤 그리기
    let renderedCount = 0;
    for (let i = 0; i < result.polygons.length; i++) {
      const polygon = result.polygons[i];

      try {
        if (polygon.points.length >= 8) {
          // 🔧 수정: fillPath를 사용한 더 안정적인 렌더링
          this.graphics.beginPath();
          this.graphics.moveTo(polygon.points[0], polygon.points[1]);

          for (let j = 2; j < polygon.points.length; j += 2) {
            this.graphics.lineTo(polygon.points[j], polygon.points[j + 1]);
          }

          this.graphics.closePath();
          this.graphics.fillPath();

          renderedCount++;
        } else {
          console.warn(`폴리곤 ${i} 점 수 부족:`, polygon.points.length);
        }
      } catch (error) {
        console.error(`폴리곤 ${i} 렌더링 실패:`, error, polygon);
      }
    }
  }

  /** 그림자 지우기 */
  public clear(): void {
    this.graphics.clear();
  }

  /** 빛 각도 변경 (동적 변경용) */
  public setLightAngle(angle: number): void {
    this.calculator.setLightAngle(angle);
    this.config.light.angle = angle;

    // 즉시 업데이트 트리거
    this.lastUpdateTime = 0;
    this.lastCameraHash = "";

    console.log(`Light angle changed to: ${angle}°`);
  }

  /** 빛 설정 변경 */
  public updateLightConfig(newConfig: Partial<LightConfig>): void {
    this.config.light = { ...this.config.light, ...newConfig };
    this.calculator.updateLightConfig(this.config.light);

    // 색상이 변경된 경우 즉시 반영
    if (newConfig.color !== undefined) {
      this.lastUpdateTime = 0;
      this.lastCameraHash = "";
    }

    console.log("Light config updated:", this.config.light);
  }

  /** 그림자 시스템 활성화/비활성화 */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;

    if (!enabled) {
      this.clear();
    } else {
      // 활성화할 때 즉시 업데이트
      this.lastUpdateTime = 0;
      this.lastCameraHash = "";
    }

    console.log(`Shadow system ${enabled ? "enabled" : "disabled"}`);
  }

  /** 렌더링 depth 변경 */
  public setDepth(depth: number): void {
    this.config.depth = depth;
    this.graphics.setDepth(depth);
    console.log(`Shadow depth changed to: ${depth}`);
  }

  private getCameraHash(camera: CameraInfo): string {
    // 20픽셀 단위로 반올림해서 미세한 움직임 무시
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

  /** 현재 설정 반환 */
  public getConfig(): ShadowRendererConfig {
    return { ...this.config };
  }

  /** 리소스 정리 */
  public destroy(): void {
    if (this.graphics) {
      this.graphics.destroy();
    }
    console.log("ShadowRenderer destroyed");
  }
}

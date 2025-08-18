// src/game/shadow/ShadowCalculator.ts - 수정된 그림자 계산 로직
import { Platform } from "../config";
import {
  LightConfig,
  CameraInfo,
  ShadowPolygon,
  ShadowCalculationResult,
} from "./ShadowTypes";

export class ShadowCalculator {
  private lightConfig: LightConfig;

  constructor(lightConfig: LightConfig) {
    this.lightConfig = { ...lightConfig };
  }

  /** 빛 설정 업데이트 */
  public updateLightConfig(newConfig: Partial<LightConfig>): void {
    this.lightConfig = { ...this.lightConfig, ...newConfig };
  }

  /** 모든 플랫폼의 그림자 계산 */
  public calculateShadows(
    platforms: Platform[],
    camera: CameraInfo
  ): ShadowCalculationResult {
    const polygons: ShadowPolygon[] = [];
    let clippedCount = 0;

    // 🔧 수정: 그림자 투영 대상을 화면 하단 + 여유분으로 확장
    const shadowTargetY = camera.y + camera.height + 500; // 화면 하단에서 500px 더 아래

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      const shadowPolygon = this.calculatePlatformShadow(
        platform,
        shadowTargetY
      );

      if (shadowPolygon) {
        // 화면 영역과 교차하는지 체크 (성능 최적화)
        if (this.isPolygonInView(shadowPolygon, camera)) {
          polygons.push({
            ...shadowPolygon,
            platformId: `platform_${i}`, // 디버깅용
          });
        } else {
          clippedCount++;
        }
      }
    }

    return { polygons, clippedCount };
  }

  /** 단일 플랫폼의 그림자 계산 */
  private calculatePlatformShadow(
    platform: Platform,
    targetY: number
  ): ShadowPolygon | null {
    // 플랫폼 상단 모서리 점들
    const topLeft = { x: platform.x, y: platform.y };
    const topRight = { x: platform.x + platform.width, y: platform.y };
    // 빛 방향 벡터 계산
    const lightDirection = this.getLightDirection();

    // 🔧 수정: 각도별 다른 투영 방식 적용
    let projectedLeft: { x: number; y: number } | null;
    let projectedRight: { x: number; y: number } | null;

    if (Math.abs(this.lightConfig.angle - 90) < 1) {
      // 거의 수직인 경우 (89-91도)
      projectedLeft = { x: topLeft.x, y: targetY };
      projectedRight = { x: topRight.x, y: targetY };
    } else {
      // 일반 각도인 경우
      projectedLeft = this.projectPointImproved(
        topLeft,
        lightDirection,
        targetY
      );
      projectedRight = this.projectPointImproved(
        topRight,
        lightDirection,
        targetY
      );
    }

    // 🔧 수정: 투영이 실패해도 기본 그림자 생성
    if (!projectedLeft || !projectedRight) {
      console.log(`  투영 실패, 기본 그림자 생성`);

      // 기본 수직 그림자 생성
      const defaultShadowLength = 200;
      projectedLeft = { x: topLeft.x, y: topLeft.y + defaultShadowLength };
      projectedRight = { x: topRight.x, y: topRight.y + defaultShadowLength };
    }

    // 사다리꼴 폴리곤 점들 (시계방향)
    const points = [
      topLeft.x,
      topLeft.y, // 왼쪽 상단
      topRight.x,
      topRight.y, // 오른쪽 상단
      projectedRight.x,
      projectedRight.y, // 오른쪽 하단
      projectedLeft.x,
      projectedLeft.y, // 왼쪽 하단
    ];

    return { points };
  }

  /** 빛 방향 벡터 계산 */
  private getLightDirection(): { x: number; y: number } {
    // 🔧 수정: 각도를 라디안으로 변환할 때 Y축 뒤집기 (화면 좌표계)
    const radian = (this.lightConfig.angle * Math.PI) / 180;
    return {
      x: Math.cos(radian),
      y: Math.sin(radian), // Y축이 아래로 향하는 화면 좌표계
    };
  }

  /** 🔧 개선된 점 투영 계산 */
  private projectPointImproved(
    point: { x: number; y: number },
    direction: { x: number; y: number },
    targetY: number
  ): { x: number; y: number } | null {
    // 수직 투영 (각도 90도)인 경우 최적화
    if (Math.abs(direction.x) < 0.001) {
      return {
        x: point.x,
        y: targetY,
      };
    }

    // 수평 방향인 경우 최대 길이로 제한
    if (Math.abs(direction.y) < 0.001) {
      const maxLength = this.lightConfig.maxLength || 1000;
      return {
        x: point.x + (direction.x > 0 ? maxLength : -maxLength),
        y: point.y,
      };
    }

    // 일반적인 각도의 경우
    // point + t * direction 에서 y = targetY가 되는 t 찾기
    const t = (targetY - point.y) / direction.y;

    // 🔧 수정: 역방향 투영도 허용하되, 최대 길이로 제한
    const maxLength = this.lightConfig.maxLength || 1000;
    const projectedX = point.x + t * direction.x;
    const projectedY = targetY;

    // 투영 거리가 너무 크면 제한
    const distance = Math.sqrt(
      Math.pow(projectedX - point.x, 2) + Math.pow(projectedY - point.y, 2)
    );

    if (distance > maxLength) {
      // 최대 길이로 제한
      const ratio = maxLength / distance;
      return {
        x: point.x + (projectedX - point.x) * ratio,
        y: point.y + (projectedY - point.y) * ratio,
      };
    }

    return {
      x: projectedX,
      y: projectedY,
    };
  }

  /** 폴리곤이 화면 영역과 교차하는지 체크 */
  private isPolygonInView(polygon: ShadowPolygon, camera: CameraInfo): boolean {
    const points = polygon.points;

    // 폴리곤의 바운딩 박스 계산
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    // 🔧 수정: 카메라 영역을 확장하여 더 관대하게 체크
    const buffer = 200; // 여유분
    const cameraRight = camera.x + camera.width + buffer;
    const cameraBottom = camera.y + camera.height + buffer;

    const isVisible = !(
      maxX < camera.x - buffer ||
      minX > cameraRight ||
      maxY < camera.y - buffer ||
      minY > cameraBottom
    );
    return isVisible;
  }

  /** 현재 빛 설정 반환 */
  public getLightConfig(): LightConfig {
    return { ...this.lightConfig };
  }

  /** 빛 각도만 변경 (동적 변경용) */
  public setLightAngle(angle: number): void {
    this.lightConfig.angle = angle;
  }
}

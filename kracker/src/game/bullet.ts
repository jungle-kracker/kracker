// src/game/bullet.ts - 삼각형 테일 효과가 있는 총알 시스템
import Phaser from "phaser";

// ===== 총알 관련 인터페이스 =====
export interface BulletConfig {
  speed?: number;
  damage?: number;
  radius?: number;
  color?: number;
  tailColor?: number;
  tailLength?: number;
  gravity?: { x: number; y: number };
  useWorldGravity?: boolean;
  lifetime?: number; // ms
}

export interface BulletEvents {
  onHit?: (x: number, y: number) => void;
  onDestroy?: () => void;
}

// ===== 무기 관련 인터페이스 =====
export interface WeaponConfig {
  fireRate: number;
  damage: number;
  accuracy: number;
  recoil: number;
  muzzleVelocity: number;
  magazineSize?: number;
  reloadTime?: number;
  burstCount?: number;
  burstDelay?: number;
}

export interface ShootingState {
  lastShotTime: number;
  currentAmmo: number;
  isReloading: boolean;
  reloadStartTime: number;
  burstRemaining: number;
  recoilAccumulation: number;
  totalShotsFired: number;
}

export interface MuzzleFlashConfig {
  enabled: boolean;
  color: number;
  intensity: number;
  duration: number;
  size: number;
}

// ===== 총알 클래스 =====
export class Bullet {
  private scene: Phaser.Scene;
  public sprite!: Phaser.Physics.Arcade.Image;
  private tail!: Phaser.GameObjects.Graphics;
  private config: Required<BulletConfig>;
  private events: BulletEvents;
  private _active: boolean = true;
  private _id: string;
  private createdTime: number;

  // 테일 효과를 위한 위치 히스토리
  private positionHistory: Array<{ x: number; y: number; time: number }> = [];
  private maxHistoryLength: number = 12; // 삼각형 테일을 위해 더 많은 포인트

  // 시각적 효과
  private bodyCircle!: Phaser.GameObjects.Arc;
  private glowEffect!: Phaser.GameObjects.Arc;

  constructor(
    scene: Phaser.Scene,
    bulletGroup: Phaser.Physics.Arcade.Group,
    x: number,
    y: number,
    angle: number,
    config: BulletConfig = {},
    events: BulletEvents = {}
  ) {
    this.scene = scene;
    this.events = events;
    this._id = `bullet_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    this.createdTime = Date.now();

    console.log(
      `🚀 총알 생성 시작: ID=${this._id}, 위치=(${x.toFixed(1)}, ${y.toFixed(
        1
      )}), 각도=${((angle * 180) / Math.PI).toFixed(1)}도`
    );

    // 기본 설정 병합
    this.config = {
      speed: 800,
      damage: 25,
      radius: 6,
      color: 0xffaa00,
      tailColor: 0xff6600,
      tailLength: 2000,
      gravity: { x: 0, y: 300 },
      useWorldGravity: false,
      lifetime: 8000,
      ...config,
    };

    console.log(`🎯 총알 설정:`, this.config);

    this.createBulletAssets(x, y, angle, bulletGroup);
    this.setupPhysics(angle);
    this.setupLifetime();

    console.log(`✅ 총알 생성 완료: ${this._id}`);
  }

  /**
   * 총알 에셋 생성 (스프라이트, 테일, 시각 효과)
   */
  private createBulletAssets(
    x: number,
    y: number,
    angle: number,
    bulletGroup: Phaser.Physics.Arcade.Group
  ): void {
    console.log(`🎨 총알 에셋 생성 중... 위치: (${x}, ${y})`);

    // 1) 물리 본체 생성
    const key = this.createBulletTexture();
    this.sprite = this.scene.physics.add.image(x, y, key);

    if (!this.sprite) {
      console.error("❌ 총알 스프라이트 생성 실패!");
      return;
    }

    this.sprite.setRotation(angle);
    this.sprite.setDepth(100);

    // 2) 충돌 시스템 인식용 세팅
    bulletGroup.add(this.sprite);
    this.sprite.setData("__isBullet", true);
    this.sprite.setData("__bulletRef", this); // 🔥 자기 참조 추가

    const radius = this.config.radius;
    const diameter = radius * 2;
    this.sprite.setData("diameter", diameter);

    // 🔥 중요: 물리 바디 설정을 더 명확하게
    this.sprite.setCircle(radius);

    // 3) 비주얼 이펙트들
    this.tail = this.scene.add.graphics().setDepth(99);

    this.bodyCircle = this.scene.add
      .circle(x, y, radius, this.config.color, 1)
      .setDepth(101)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.glowEffect = this.scene.add
      .circle(x, y, radius * 1.5, this.config.color, 0.3)
      .setDepth(100)
      .setBlendMode(Phaser.BlendModes.ADD);

    // 4) 위치 기록
    this.addToHistory(x, y);

    console.log(`✅ 총알 에셋 생성 완료`);
  }

  private createBulletTexture(): string {
    const key = `bullet_texture_${this._id}`;

    // 텍스처가 이미 존재하는지 확인
    if (this.scene.textures.exists(key)) {
      return key;
    }

    try {
      // Canvas 방식으로 안전하게 텍스처 생성
      const size = this.config.radius * 2;
      const canvas = this.scene.textures.createCanvas(key, size, size);

      if (canvas) {
        const ctx = canvas.getContext();
        if (ctx) {
          // 원 그리기
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(
            this.config.radius,
            this.config.radius,
            this.config.radius,
            0,
            Math.PI * 2
          );
          ctx.fill();
          canvas.refresh();
        }
      }
    } catch (error) {
      console.warn("Canvas texture creation failed, using fallback:", error);

      // 폴백: Graphics로 텍스처 생성
      try {
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(
          this.config.radius,
          this.config.radius,
          this.config.radius
        );
        graphics.generateTexture(
          key,
          this.config.radius * 2,
          this.config.radius * 2
        );
        graphics.destroy();
      } catch (fallbackError) {
        console.error("Fallback texture creation failed:", fallbackError);
        return "__DEFAULT";
      }
    }

    return key;
  }

  /**
   * 물리 엔진 설정 - 개선된 버전
   */
  private setupPhysics(angle: number): void {
    if (!this.sprite.body) {
      console.error("❌ 총알 물리 바디가 생성되지 않았습니다!");
      return;
    }

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    console.log(
      `⚡ 물리 설정 중... 각도: ${((angle * 180) / Math.PI).toFixed(1)}도`
    );

    // 초기 속도
    const vx = Math.cos(angle) * this.config.speed;
    const vy = Math.sin(angle) * this.config.speed;
    this.sprite.setVelocity(vx, vy);
    console.log(`🎯 초기 속도 설정: (${vx.toFixed(1)}, ${vy.toFixed(1)})`);

    body.setAllowGravity(true);

    const worldG = this.scene.physics.world.gravity; // Phaser.Math.Vector2

    if (this.config.useWorldGravity) {
      // 월드 중력만 사용 (총알에 별도 중력 추가 없음)
      body.setGravity(0, 0);
      console.log(`🌍 월드 중력 사용: (${worldG.x}, ${worldG.y})`);
    } else {
      // 개별 중력만 사용하고 싶음 → (월드 + 바디) = 원하는 중력 이 되도록 보정
      const gx = this.config.gravity.x - worldG.x;
      const gy = this.config.gravity.y - worldG.y;
      body.setGravity(gx, gy);
      console.log(
        `🎯 개별 중력 사용: 목표=(${this.config.gravity.x}, ${this.config.gravity.y}), 보정값=(${gx}, ${gy})`
      );
    }

    // 기타 물리 속성
    body.setDrag(0, 0);
    body.setBounce(0, 0);
    body.setFriction(0, 0);
    body.setImmovable(false);
    body.setCollideWorldBounds(false);
    (body as any).moves = true;
    body.enable = true;

    // 원형 바디 + 사이즈 정합
    const r = this.config.radius;
    body.setCircle(r);
    body.setSize(r * 2, r * 2); // setCircle이 내부적으로 offset을 조정하므로 유지
    body.updateFromGameObject();

    console.log(`✅ 물리 설정 완료`);
  }

  private setupLifetime(): void {
    this.scene.time.delayedCall(this.config.lifetime, () => {
      if (this._active) {
        console.log(`⏰ 총알 수명 만료: ${this._id}`);
        this.destroy(false);
      }
    });
  }

  /**
   * 총알 업데이트 (매 프레임)
   */
  public update(): void {
    if (!this._active || !this.sprite || !this.sprite.body) return;

    const x = this.sprite.x;
    const y = this.sprite.y;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // 위치 히스토리 업데이트
    this.addToHistory(x, y);

    // 시각적 요소들 위치 동기화
    if (this.bodyCircle && this.bodyCircle.scene) {
      this.bodyCircle.setPosition(x, y);
    }
    if (this.glowEffect && this.glowEffect.scene) {
      this.glowEffect.setPosition(x, y);
    }

    // 속도에 따른 회전
    if (body.velocity.x !== 0 || body.velocity.y !== 0) {
      const angle = Math.atan2(body.velocity.y, body.velocity.x);
      this.sprite.setRotation(angle);
    }

    // 삼각형 테일 그리기
    this.updateTriangularTail();

    // 속도 기반 시각적 효과
    this.updateVisualEffects();

    // 화면 밖으로 나갔는지 체크
    this.checkBounds();
  }

  /**
   * 위치 히스토리에 추가
   */
  private addToHistory(x: number, y: number): void {
    const now = Date.now();
    this.positionHistory.push({ x, y, time: now });

    // 히스토리 길이 제한
    if (this.positionHistory.length > this.maxHistoryLength) {
      this.positionHistory.shift();
    }

    // 오래된 히스토리 제거 (시간 기준)
    const cutoffTime = now - 400; // 0.4초
    this.positionHistory = this.positionHistory.filter(
      (pos) => pos.time > cutoffTime
    );
  }

  /**
   * 🔥 새로운 삼각형 테일 업데이트
   */
  private updateTriangularTail(): void {
    if (!this.tail || !this.tail.scene) return;

    this.tail.clear();

    if (this.positionHistory.length < 3) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const speed = body.velocity.length();

    // 속도가 낮으면 테일 표시 안 함
    if (speed < 100) return;

    const positions = this.positionHistory.slice();
    const currentPos = positions[positions.length - 1];

    // 속도 벡터 계산
    const velocityAngle = Math.atan2(body.velocity.y, body.velocity.x);

    // 테일 길이는 속도에 비례
    const tailLength = Math.min(80, speed * 0.08);
    const tailWidth = Math.min(20, this.config.radius * 2 + speed * 0.01);

    // 삼각형 테일 포인트들 계산
    const trianglePoints: number[] = [];

    // 1. 총알 뒤쪽 중심점 (삼각형의 뾰족한 끝)
    const tailEndX = currentPos.x - Math.cos(velocityAngle) * tailLength;
    const tailEndY = currentPos.y - Math.sin(velocityAngle) * tailLength;

    // 2. 총알 근처의 양쪽 날개 (삼각형의 밑변)
    const wingOffset = tailWidth * 0.5;
    const perpAngle = velocityAngle + Math.PI / 2;

    const wing1X = currentPos.x + Math.cos(perpAngle) * wingOffset;
    const wing1Y = currentPos.y + Math.sin(perpAngle) * wingOffset;

    const wing2X = currentPos.x - Math.cos(perpAngle) * wingOffset;
    const wing2Y = currentPos.y - Math.sin(perpAngle) * wingOffset;

    // 삼각형 정점들
    trianglePoints.push(
      wing1X,
      wing1Y, // 첫 번째 날개
      wing2X,
      wing2Y, // 두 번째 날개
      tailEndX,
      tailEndY // 뒤쪽 끝점
    );

    // 속도에 따른 색상 계산
    const speedFactor = Math.min(1, speed / 1200);

    // 색상을 직접 계산하여 hex 값으로 변환
    const baseR = (this.config.tailColor >> 16) & 0xff;
    const baseG = (this.config.tailColor >> 8) & 0xff;
    const baseB = this.config.tailColor & 0xff;

    const brightR = 255;
    const brightG = 255;
    const brightB = 255;

    const blendFactor = speedFactor * 0.4;
    const finalR = Math.round(baseR + (brightR - baseR) * blendFactor);
    const finalG = Math.round(baseG + (brightG - baseG) * blendFactor);
    const finalB = Math.round(baseB + (brightB - baseB) * blendFactor);

    const blendedColor = (finalR << 16) | (finalG << 8) | finalB;

    // 메인 삼각형 그리기
    this.tail.fillStyle(blendedColor, 0.8);
    this.tail.beginPath();
    this.tail.moveTo(trianglePoints[0], trianglePoints[1]);
    this.tail.lineTo(trianglePoints[2], trianglePoints[3]);
    this.tail.lineTo(trianglePoints[4], trianglePoints[5]);
    this.tail.closePath();
    this.tail.fillPath();

    // 추가 그라데이션 효과를 위한 더 작은 삼각형들
    for (let i = 1; i <= 3; i++) {
      const scale = 1 - i * 0.25;
      const alpha = 0.6 - i * 0.15;

      if (alpha <= 0) break;

      const smallerTailLength = tailLength * scale;
      const smallerTailWidth = tailWidth * scale;
      const smallerWingOffset = smallerTailWidth * 0.5;

      const smallTailEndX =
        currentPos.x - Math.cos(velocityAngle) * smallerTailLength;
      const smallTailEndY =
        currentPos.y - Math.sin(velocityAngle) * smallerTailLength;

      const smallWing1X =
        currentPos.x + Math.cos(perpAngle) * smallerWingOffset;
      const smallWing1Y =
        currentPos.y + Math.sin(perpAngle) * smallerWingOffset;

      const smallWing2X =
        currentPos.x - Math.cos(perpAngle) * smallerWingOffset;
      const smallWing2Y =
        currentPos.y - Math.sin(perpAngle) * smallerWingOffset;

      // 더 밝은 색으로 그라데이션
      const innerBlendFactor = i * 0.2;
      const innerR = Math.round(finalR + (brightR - finalR) * innerBlendFactor);
      const innerG = Math.round(finalG + (brightG - finalG) * innerBlendFactor);
      const innerB = Math.round(finalB + (brightB - finalB) * innerBlendFactor);
      const innerColor = (innerR << 16) | (innerG << 8) | innerB;

      this.tail.fillStyle(innerColor, alpha);
      this.tail.beginPath();
      this.tail.moveTo(smallWing1X, smallWing1Y);
      this.tail.lineTo(smallWing2X, smallWing2Y);
      this.tail.lineTo(smallTailEndX, smallTailEndY);
      this.tail.closePath();
      this.tail.fillPath();
    }

    // 외곽선 추가 (선택적)
    if (speed > 600) {
      this.tail.lineStyle(1, 0xffffff, 0.3);
      this.tail.beginPath();
      this.tail.moveTo(trianglePoints[0], trianglePoints[1]);
      this.tail.lineTo(trianglePoints[2], trianglePoints[3]);
      this.tail.lineTo(trianglePoints[4], trianglePoints[5]);
      this.tail.closePath();
      this.tail.strokePath();
    }
  }

  /**
   * 속도 기반 시각적 효과
   */
  private updateVisualEffects(): void {
    if (!this.bodyCircle || !this.glowEffect) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const speed = body.velocity.length();

    // 속도에 따른 크기 변화
    const scale = Math.max(0.8, Math.min(1.5, 0.8 + (speed / 1000) * 0.7));
    this.bodyCircle.setScale(scale);

    // 글로우 효과 강도
    const glowAlpha = Math.max(0.2, Math.min(0.6, 0.2 + (speed / 1000) * 0.4));
    this.glowEffect.setAlpha(glowAlpha);

    // 색상 변화 (속도가 빠르면 더 밝게)
    if (speed > 500) {
      const intensity = Math.min(1, (speed - 500) / 500);

      // 현재 색상에서 흰색으로 블렌딩
      const r = (this.config.color >> 16) & 0xff;
      const g = (this.config.color >> 8) & 0xff;
      const b = this.config.color & 0xff;

      const brightR = Math.round(r + (255 - r) * intensity * 0.3);
      const brightG = Math.round(g + (255 - g) * intensity * 0.3);
      const brightB = Math.round(b + (255 - b) * intensity * 0.3);

      const brightColor = (brightR << 16) | (brightG << 8) | brightB;
      this.bodyCircle.setFillStyle(brightColor);
    } else {
      this.bodyCircle.setFillStyle(this.config.color);
    }
  }

  /**
   * 화면 경계 체크
   */
  private checkBounds(): void {
    const camera = this.scene.cameras.main;
    const buffer = 300; // 화면 밖 여유 공간

    const x = this.sprite.x;
    const y = this.sprite.y;

    if (
      x < camera.scrollX - buffer ||
      x > camera.scrollX + camera.width + buffer ||
      y < camera.scrollY - buffer ||
      y > camera.scrollY + camera.height + buffer
    ) {
      console.log(
        `🗑️ 총알이 화면 밖으로 나가 제거됨: (${x.toFixed(1)}, ${y.toFixed(1)})`
      );
      this.destroy(false);
    }
  }

  /**
   * 충돌 처리
   */
  public hit(contactX?: number, contactY?: number): void {
    if (!this._active) return;

    const hitX = contactX ?? this.sprite.x;
    const hitY = contactY ?? this.sprite.y;

    console.log(`💥 총알 충돌! 위치: (${hitX.toFixed(1)}, ${hitY.toFixed(1)})`);

    // 충돌 이벤트 호출
    this.events.onHit?.(hitX, hitY);

    // 폭발 효과 생성
    this.createSafeExplosionEffect(hitX, hitY);

    // 총알 제거
    this.destroy(true);
  }

  /**
   * 안전한 폭발 효과 생성
   */
  private createSafeExplosionEffect(x: number, y: number): void {
    try {
      // 간단한 플래시 효과
      const flash = this.scene.add.circle(
        x,
        y,
        this.config.radius * 3,
        0xffffff,
        0.8
      );
      flash.setDepth(150);
      flash.setBlendMode(Phaser.BlendModes.ADD);

      this.scene.tweens.add({
        targets: flash,
        scaleX: 2,
        scaleY: 2,
        alpha: 0,
        duration: 200,
        ease: "Power2",
        onComplete: () => {
          if (flash && flash.scene) {
            flash.destroy();
          }
        },
      });
    } catch (error) {
      console.warn("폭발 효과 생성 실패:", error);
    }
  }

  /**
   * 총알 제거
   */
  public destroy(wasHit: boolean = false): void {
    if (!this._active) return;

    this._active = false;
    console.log(`🗑️ 총알 제거됨 (충돌: ${wasHit}, ID: ${this._id})`);

    // 이벤트 호출
    this.events.onDestroy?.();

    // 시각적 요소들 안전하게 제거
    try {
      if (this.tail && this.tail.scene) {
        this.tail.destroy();
      }
      if (this.bodyCircle && this.bodyCircle.scene) {
        this.bodyCircle.destroy();
      }
      if (this.glowEffect && this.glowEffect.scene) {
        this.glowEffect.destroy();
      }
    } catch (error) {
      console.warn("시각적 요소 제거 중 오류:", error);
    }

    // 메인 스프라이트 제거
    if (this.sprite && this.sprite.scene) {
      // 텍스처 정리
      const textureKey = `bullet_texture_${this._id}`;
      if (this.scene.textures.exists(textureKey)) {
        try {
          this.scene.textures.remove(textureKey);
        } catch (error) {
          console.warn("텍스처 제거 중 오류:", error);
        }
      }

      this.sprite.destroy();
    }

    // 히스토리 정리
    this.positionHistory = [];
  }

  // ===== Getter 메서드들 =====

  public get active(): boolean {
    return this._active;
  }

  public get id(): string {
    return this._id;
  }

  public get x(): number {
    return this.sprite?.x ?? 0;
  }

  public get y(): number {
    return this.sprite?.y ?? 0;
  }

  public get age(): number {
    return Date.now() - this.createdTime;
  }

  public getVelocity(): { x: number; y: number } {
    const body = this.sprite?.body as Phaser.Physics.Arcade.Body;
    return body ? { x: body.velocity.x, y: body.velocity.y } : { x: 0, y: 0 };
  }

  public getSpeed(): number {
    const vel = this.getVelocity();
    return Math.sqrt(vel.x * vel.x + vel.y * vel.y);
  }

  public getConfig(): Readonly<Required<BulletConfig>> {
    return { ...this.config };
  }

  // ===== 정적 메서드들 =====

  /**
   * 프리로드용 메서드
   */
  public static preload(scene: Phaser.Scene): void {
    console.log("💡 Bullet system preloaded");
  }

  /**
   * 기본 설정 반환
   */
  public static getDefaultConfig(): Required<BulletConfig> {
    return {
      speed: 800,
      damage: 25,
      radius: 6,
      color: 0xffaa00,
      tailColor: 0xff6600,
      tailLength: 2000,
      gravity: { x: 0, y: 900 },
      useWorldGravity: false,
      lifetime: 8000,
    };
  }

  /**
   * 디버깅용 물리 상태 출력
   */
  public debugPhysics(): void {
    if (!this.sprite || !this.sprite.body) {
      console.log(`🔍 총알 ${this._id}: 물리 바디 없음`);
      return;
    }

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    console.log(`🔍 총알 ${this._id} 물리 상태:`, {
      position: `(${this.sprite.x.toFixed(1)}, ${this.sprite.y.toFixed(1)})`,
      velocity: `(${body.velocity.x.toFixed(1)}, ${body.velocity.y.toFixed(
        1
      )})`,
      speed: body.velocity.length().toFixed(1),
      allowGravity: body.allowGravity,
      gravity: `(${body.gravity.x}, ${body.gravity.y})`,
      drag: `(${body.drag.x}, ${body.drag.y})`,
      bounce: `(${body.bounce.x}, ${body.bounce.y})`,
      moves: (body as any).moves,
      enable: body.enable,
      immovable: body.immovable,
    });
  }
}

// ===== 단순화된 사격 함수 =====

/**
 * 🔥 완전히 단순화된 사격 함수
 */
export function doShoot(opts: {
  scene: any;
  gunX: number;
  gunY: number;
  targetX: number;
  targetY: number;
  platforms?: any[];
  speed?: number;
  cooldownMs: number;
  lastShotTime: number;
  recoilBase?: number;
  wobbleBase?: number;
  collisionSystem?: any;
}): {
  bullet: Bullet;
  lastShotTime: number;
  recoilAdd: number;
  wobbleAdd: number;
} {
  const {
    scene,
    gunX,
    gunY,
    targetX,
    targetY,
    speed = 3000,
    recoilBase = 1.5,
    wobbleBase = 0.3,
    collisionSystem,
  } = opts;

  console.log(`🔫 단순화된 사격:`);
  console.log(`   총구: (${gunX.toFixed(1)}, ${gunY.toFixed(1)})`);
  console.log(`   목표: (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`);

  // 1. 발사 각도 계산
  const angle = Math.atan2(targetY - gunY, targetX - gunX);
  console.log(`   각도: ${((angle * 180) / Math.PI).toFixed(1)}도`);

  // 2. 총알 스폰 위치 - 총구에서 약간 앞으로
  const spawnDistance = 10;
  const spawnX = gunX + Math.cos(angle) * spawnDistance;
  const spawnY = gunY + Math.sin(angle) * spawnDistance;

  console.log(`   스폰: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)})`);

  // 3. 총알 그룹 가져오기
  let bulletGroup: Phaser.Physics.Arcade.Group;
  if (collisionSystem && typeof collisionSystem.getBulletGroup === "function") {
    bulletGroup = collisionSystem.getBulletGroup();
  } else {
    console.warn("⚠️ CollisionSystem 없음, 임시 그룹 생성");
    bulletGroup = scene.physics.add.group({
      runChildUpdate: true,
      allowGravity: true,
    });
  }

  // 4. 총알 생성
  const bullet = new Bullet(scene, bulletGroup, spawnX, spawnY, angle, {
    speed,
    gravity: { x: 0, y: 1500 },
    useWorldGravity: false,
    radius: 6,
    color: 0xffaa00,
    tailColor: 0xff6600,
    lifetime: 8000,
  });

  console.log(`✅ 총알 생성 완료: ${bullet.id}`);

  return {
    bullet,
    lastShotTime: Date.now(),
    recoilAdd: recoilBase,
    wobbleAdd: wobbleBase,
  };
}

/**
 * 사격 가능 여부 체크
 */
export function canShoot(
  lastShotTime: number,
  cooldownMs: number,
  now: number = Date.now()
): boolean {
  return now - lastShotTime >= cooldownMs;
}

// ===== 고급 사격 시스템 클래스 =====

export class ShootingSystem {
  private scene: Phaser.Scene;
  private bullets: Map<string, Bullet> = new Map();
  private weaponConfig: Required<WeaponConfig>;
  private state: ShootingState;
  private bulletGroup!: Phaser.Physics.Arcade.Group;
  private muzzleFlashConfig: MuzzleFlashConfig;
  private onShotCallback?: (recoil: number) => void;
  private maxBullets: number = 30;

  constructor(
    scene: Phaser.Scene,
    weaponConfig: WeaponConfig,
    muzzleFlashConfig: Partial<MuzzleFlashConfig> = {}
  ) {
    this.scene = scene;

    this.weaponConfig = {
      magazineSize: 30,
      reloadTime: 2000,
      burstCount: 1,
      burstDelay: 100,
      ...weaponConfig,
    };

    this.muzzleFlashConfig = {
      enabled: true,
      color: 0xffaa00,
      intensity: 0.8,
      duration: 100,
      size: 15,
      ...muzzleFlashConfig,
    };

    this.state = {
      lastShotTime: 0,
      currentAmmo: this.weaponConfig.magazineSize,
      isReloading: false,
      reloadStartTime: 0,
      burstRemaining: 0,
      recoilAccumulation: 0,
      totalShotsFired: 0,
    };

    this.setupPhysicsGroups();
    this.setupUpdateLoop();
  }

  private setupPhysicsGroups(): void {
    this.bulletGroup = this.scene.physics.add.group({
      runChildUpdate: false,
      allowGravity: true,
    });
  }

  private setupUpdateLoop(): void {
    this.scene.events.on("update", this.update, this);
  }

  public getBulletGroup(): Phaser.Physics.Arcade.Group {
    return this.bulletGroup;
  }

  public tryShoot(
    gunX: number,
    gunY: number,
    targetX: number,
    targetY: number,
    bulletConfig?: Partial<BulletConfig>
  ): boolean {
    const now = Date.now();

    if (this.state.isReloading) {
      if (now - this.state.reloadStartTime >= this.weaponConfig.reloadTime) {
        this.finishReload();
      } else {
        return false;
      }
    }

    if (this.state.currentAmmo <= 0) {
      this.startReload();
      return false;
    }

    const fireInterval = 60000 / this.weaponConfig.fireRate;
    if (now - this.state.lastShotTime < fireInterval) {
      return false;
    }

    this.fireBullet(gunX, gunY, targetX, targetY, bulletConfig);

    this.state.lastShotTime = now;
    this.state.currentAmmo--;
    this.state.totalShotsFired++;
    this.state.recoilAccumulation += this.weaponConfig.recoil;

    return true;
  }

  private fireBullet(
    gunX: number,
    gunY: number,
    targetX: number,
    targetY: number,
    bulletConfig?: Partial<BulletConfig>
  ): void {
    // doShoot 사용해서 단순화
    const shot = doShoot({
      scene: this.scene,
      gunX,
      gunY,
      targetX,
      targetY,
      speed: this.weaponConfig.muzzleVelocity,
      cooldownMs: 0, // ShootingSystem에서는 별도 관리
      lastShotTime: 0,
      recoilBase: this.weaponConfig.recoil,
      wobbleBase: 0.3,
      collisionSystem: { getBulletGroup: () => this.bulletGroup },
    });

    this.bullets.set(shot.bullet.id, shot.bullet);
    this.limitBulletCount();
    this.createMuzzleFlash(gunX, gunY, shot.bullet.getConfig().speed);

    this.onShotCallback?.(shot.recoilAdd);
  }

  private startReload(): void {
    if (this.state.isReloading) return;
    this.state.isReloading = true;
    this.state.reloadStartTime = Date.now();
  }

  private finishReload(): void {
    this.state.isReloading = false;
    this.state.currentAmmo = this.weaponConfig.magazineSize;
  }

  private createMuzzleFlash(x: number, y: number, angle: number): void {
    if (!this.muzzleFlashConfig.enabled) return;

    const flash = this.scene.add.circle(
      x,
      y,
      this.muzzleFlashConfig.size,
      this.muzzleFlashConfig.color,
      this.muzzleFlashConfig.intensity
    );

    flash.setDepth(100);

    this.scene.tweens.add({
      targets: flash,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: this.muzzleFlashConfig.duration,
      onComplete: () => flash.destroy(),
    });
  }

  private limitBulletCount(): void {
    if (this.bullets.size > this.maxBullets) {
      const bulletIds = Array.from(this.bullets.keys());
      const oldest = bulletIds[0];
      const bullet = this.bullets.get(oldest);
      if (bullet) {
        bullet.destroy();
        this.bullets.delete(oldest);
      }
    }
  }

  private update = (): void => {
    const bulletsToRemove: string[] = [];
    this.bullets.forEach((bullet, id) => {
      if (!bullet || !bullet.active) {
        bulletsToRemove.push(id);
      }
    });

    bulletsToRemove.forEach((id) => {
      this.bullets.delete(id);
    });

    this.state.recoilAccumulation *= 0.95;
    if (this.state.recoilAccumulation < 0.01) {
      this.state.recoilAccumulation = 0;
    }
  };

  // ===== 공개 메서드들 =====

  public canShoot(): boolean {
    const now = Date.now();
    const fireInterval = 60000 / this.weaponConfig.fireRate;
    return (
      !this.state.isReloading &&
      this.state.currentAmmo > 0 &&
      now - this.state.lastShotTime >= fireInterval
    );
  }

  public getCurrentAmmo(): number {
    return this.state.currentAmmo;
  }

  public getMaxAmmo(): number {
    return this.weaponConfig.magazineSize;
  }

  public isReloading(): boolean {
    return this.state.isReloading;
  }

  public getBulletCount(): number {
    return this.bullets.size;
  }

  public getRecoilAccumulation(): number {
    return this.state.recoilAccumulation;
  }

  public getTotalShotsFired(): number {
    return this.state.totalShotsFired;
  }

  public getWeaponConfig(): Readonly<Required<WeaponConfig>> {
    return { ...this.weaponConfig };
  }

  public getState(): Readonly<ShootingState> {
    return { ...this.state };
  }

  public setOnShotCallback(callback: (recoil: number) => void): void {
    this.onShotCallback = callback;
  }

  public forceReload(): void {
    this.startReload();
  }

  public clearAllBullets(): void {
    this.bullets.forEach((bullet) => {
      if (bullet && typeof bullet.destroy === "function") {
        bullet.destroy();
      }
    });
    this.bullets.clear();
    this.bulletGroup.clear(true, false);
  }

  public updateBullets(): void {
    this.bullets.forEach((bullet) => {
      if (bullet && bullet.active) {
        bullet.update();
      }
    });
  }

  public destroy(): void {
    this.scene.events.off("update", this.update, this);
    this.clearAllBullets();
    if (this.bulletGroup) {
      this.bulletGroup.destroy(true);
    }
  }

  // ===== 디버깅 메서드들 =====

  public debugInfo(): void {
    console.log("🔫 ShootingSystem 상태:", {
      ammo: `${this.state.currentAmmo}/${this.weaponConfig.magazineSize}`,
      isReloading: this.state.isReloading,
      bulletCount: this.bullets.size,
      recoilAccumulation: this.state.recoilAccumulation.toFixed(2),
      totalShots: this.state.totalShotsFired,
      canShoot: this.canShoot(),
    });
  }

  public getAllBullets(): Bullet[] {
    return Array.from(this.bullets.values());
  }
}

// src/game/bullet.ts - 완전히 수정된 총알 시스템
import Phaser from "phaser";

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
  private maxHistoryLength: number = 8;

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
      tailLength: 80,
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

    // 속도 설정
    const vx = Math.cos(angle) * this.config.speed;
    const vy = Math.sin(angle) * this.config.speed;
    this.sprite.setVelocity(vx, vy);

    console.log(`🎯 초기 속도 설정: (${vx.toFixed(1)}, ${vy.toFixed(1)})`);

    // 중력 설정 개선
    if (this.config.useWorldGravity) {
      // 월드 중력만 사용
      body.setGravity(0, 0);
      body.setAllowGravity(true);
      console.log(`🌍 월드 중력 사용`);
    } else {
      // 개별 중력만 사용
      body.setAllowGravity(false); // 월드 중력 비활성화
      body.setGravity(this.config.gravity.x, this.config.gravity.y);
      console.log(
        `🎯 개별 중력 설정: (${this.config.gravity.x}, ${this.config.gravity.y})`
      );
    }

    // 물리 속성 명시적 설정
    body.setDrag(0, 0);
    body.setBounce(0, 0);
    body.setFriction(0, 0);
    body.setImmovable(false);
    body.setCollideWorldBounds(false);

    // 바디가 움직일 수 있도록 설정
    (body as any).moves = true;
    body.enable = true;

    // 바디 크기 정확히 설정
    body.setSize(this.config.radius * 2, this.config.radius * 2);
    body.updateFromGameObject();

    console.log(`✅ 물리 설정 완료`);

    // 100ms 후 상태 체크
    this.scene.time.delayedCall(100, () => {
      this.checkPhysicsStatus();
    });
  }

  /**
   * 물리 상태 체크
   */
  private checkPhysicsStatus(): void {
    if (!this.sprite || !this.sprite.body) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const currentSpeed = body.velocity.length();

    console.log(`📊 100ms 후 총알 상태:`);
    console.log(`   - 속도: ${currentSpeed.toFixed(1)}`);
    console.log(
      `   - 위치: (${this.sprite.x.toFixed(1)}, ${this.sprite.y.toFixed(1)})`
    );
    console.log(`   - 중력: (${body.gravity.x}, ${body.gravity.y})`);
    console.log(`   - 월드중력허용: ${body.allowGravity}`);

    if (currentSpeed < 50) {
      console.warn(`⚠️ 총알이 비정상적으로 느려졌습니다!`);
      this.debugPhysics();
    }
  }

  /**
   * 수명 설정
   */
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

    // 테일 그리기
    this.updateTail();

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
    const cutoffTime = now - 300; // 0.3초
    this.positionHistory = this.positionHistory.filter(
      (pos) => pos.time > cutoffTime
    );
  }

  /**
   * 테일 업데이트
   */
  private updateTail(): void {
    if (!this.tail || !this.tail.scene) return;

    this.tail.clear();

    if (this.positionHistory.length < 2) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const speed = body.velocity.length();

    // 속도가 낮으면 테일 표시 안 함
    if (speed < 50) return;

    // 테일 그라디언트 그리기
    const positions = this.positionHistory.slice();

    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];

      // 알파값 계산 (뒤쪽일수록 투명)
      const alpha = (i / positions.length) * 0.8;

      // 두께 계산 (앞쪽일수록 두껍게)
      const thickness = Math.max(
        1,
        (i / positions.length) * this.config.radius * 0.5
      );

      // 색상 계산 (속도에 따라 변화)
      const speedFactor = Math.min(1, speed / 1000);
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(this.config.tailColor),
        Phaser.Display.Color.ValueToColor(0xffffff),
        1,
        speedFactor
      );

      this.tail.lineStyle(thickness, color.color, alpha);
      this.tail.beginPath();
      this.tail.moveTo(prev.x, prev.y);
      this.tail.lineTo(curr.x, curr.y);
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
      const brightColor = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(this.config.color),
        Phaser.Display.Color.ValueToColor(0xffffff),
        1,
        intensity * 0.3
      );
      this.bodyCircle.setFillStyle(brightColor.color);
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
      tailLength: 80,
      gravity: { x: 0, y: 300 },
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

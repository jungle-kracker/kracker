// src/game/bullet.ts - 단순한 테일 색상으로 수정된 버전
import Phaser from "phaser";

// ===== 이알 관련 인터페이스 =====
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

// ===== 이알 클래스 =====
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

  // 시각적 효과 (옵션)
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

    // 기본 설정 병합
    this.config = {
      speed: 800,
      damage: 25,
      radius: 6,
      color: 0xffe96a,
      tailColor: 0xffe96a, // 🔥 총알과 같은 색상으로 기본값 변경
      tailLength: 200,
      gravity: { x: 0, y: 300 },
      useWorldGravity: false,
      lifetime: 8000,
      ...config,
    };

    console.log(`🎯 이알 설정:`, this.config);

    this.createBulletAssets(x, y, angle, bulletGroup);
    this.setupPhysics(angle);
    this.setupLifetime();

    console.log(`✅ 이알 생성 완료: ${this._id}`);
  }

  /**
   * 이알 에셋 생성 (스프라이트, 테일, 시각 효과)
   */
  private createBulletAssets(
    x: number,
    y: number,
    angle: number,
    bulletGroup: Phaser.Physics.Arcade.Group
  ): void {
    // 1) 물리 본체 생성
    const key = this.createBulletTexture();
    this.sprite = this.scene.physics.add.image(x, y, key);
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
    this.tail = this.scene.add.graphics().setDepth(this.sprite.depth - 1);
    // 스크롤/줌 동기화 (테일이 이알과 어긋나지 않도록)
    this.tail.setScrollFactor(
      (this.sprite as any).scrollFactorX ?? 1,
      (this.sprite as any).scrollFactorY ?? 1
    );
    this.tail.setBlendMode(Phaser.BlendModes.ADD);

    // (옵션) 본체/글로우 추가하고 싶다면 주석 해제
    // this.bodyCircle = this.scene.add.circle(x, y, this.config.radius, this.config.color, 1)
    //   .setDepth(this.sprite.depth + 1)
    //   .setBlendMode(Phaser.BlendModes.ADD) as Phaser.GameObjects.Arc;
    // this.glowEffect = this.scene.add.circle(x, y, this.config.radius * 1.8, this.config.color, 0.35)
    //   .setDepth(this.sprite.depth)
    //   .setBlendMode(Phaser.BlendModes.ADD) as Phaser.GameObjects.Arc;

    // 4) 위치 기록
    this.addToHistory(x, y);

    console.log(`✅ 이알 에셋 생성 완료`);
  }

  private createBulletTexture(): string {
    const key = `bullet_texture_${this._id}`;

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
          ctx.fillStyle = "#e6d535ff";
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
        graphics.fillStyle(0xffe96a, 1);
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
      console.error("❌ 이알 물리 바디가 생성되지 않았습니다!");
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

    body.setAllowGravity(true);

    const worldG = this.scene.physics.world.gravity;

    if (this.config.useWorldGravity) {
      // 월드 중력만 사용
      body.setGravity(0, 0);
    } else {
      // (월드 + 바디) = 원하는 중력 이 되도록 보정
      const gx = this.config.gravity.x - worldG.x;
      const gy = this.config.gravity.y - worldG.y;
      body.setGravity(gx, gy);
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
    body.setSize(r * 2, r * 2);
    body.updateFromGameObject();
  }

  private setupLifetime(): void {
    this.scene.time.delayedCall(this.config.lifetime, () => {
      if (this._active) {
        this.destroy(false);
      }
    });
  }

  /**
   * 이알 업데이트 (매 프레임)
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

    // 🔥 단순한 삼각형 테일 그리기
    this.updateSimpleTail();

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

    // 오래된 히스토리 제거 (뒤로 돌리는 인상 완화)
    const cutoffTime = now - 220; // 🔧 기존 400ms -> 220ms
    this.positionHistory = this.positionHistory.filter(
      (pos) => pos.time > cutoffTime
    );
  }

  /**
   * 🔥 단순한 테일 업데이트 (총알과 같은 색상)
   */
  private updateSimpleTail(): void {
    if (!this.tail || !this.tail.scene) return;

    this.tail.clear();

    if (this.positionHistory.length < 3) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const speed = body.velocity.length();

    // 속도가 낮으면 테일 표시 안 함
    if (speed < 100) return;

    // 🔥 현재 총알의 정확한 위치 사용 (히스토리 말고 실시간)
    const currentX = this.sprite.x;
    const currentY = this.sprite.y;

    // 속도 벡터 각도
    const velocityAngle = Math.atan2(body.velocity.y, body.velocity.x);

    // 테일 길이와 너비
    const tailLength = Math.min(80, speed * 0.03);
    const tailWidth = Math.min(20, this.config.radius * 2 + speed * 0.0007);

    // 🔥 테일 시작점을 총알 앞쪽으로 (더 겹치게)
    const overlapDistance = this.config.radius * 1.23; // 총알 반지름의 70% 만큼 앞으로
    const baseX = currentX + Math.cos(velocityAngle) * overlapDistance;
    const baseY = currentY + Math.sin(velocityAngle) * overlapDistance;

    // 테일 끝 (뾰족한 점): 총알 중심에서 뒤로
    const tailEndX = currentX - Math.cos(velocityAngle) * tailLength;
    const tailEndY = currentY - Math.sin(velocityAngle) * tailLength;

    // 날개 두 점 (총알 앞쪽에서)
    const perpAngle = velocityAngle + Math.PI / 2;
    const wingOffset = tailWidth * 0.5;
    const wing1X = baseX + Math.cos(perpAngle) * wingOffset;
    const wing1Y = baseY + Math.sin(perpAngle) * wingOffset;
    const wing2X = baseX - Math.cos(perpAngle) * wingOffset;
    const wing2Y = baseY - Math.sin(perpAngle) * wingOffset;

    // 🔥 총알과 똑같은 색상 사용 (config.color)
    const tailColor = this.config.color;

    // 메인 삼각형 그리기
    this.tail.fillStyle(tailColor, 0.8);
    this.tail.beginPath();
    this.tail.moveTo(wing1X, wing1Y);
    this.tail.lineTo(wing2X, wing2Y);
    this.tail.lineTo(tailEndX, tailEndY);
    this.tail.closePath();
    this.tail.fillPath();
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

    // 색상 변화 (속도가 빠르면 더 밝게)
    if (speed > 500) {
      const intensity = Math.min(1, (speed - 500) / 500);

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

    // 충돌 이벤트 호출
    this.events.onHit?.(hitX, hitY);

    // 폭발 효과 생성
    this.createSafeExplosionEffect(hitX, hitY);

    // 이알 제거
    this.destroy(true);
  }

  /**
   * 안전한 폭발 효과 생성
   */
  private createSafeExplosionEffect(x: number, y: number): void {
    try {
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
   * 이알 제거
   */
  public destroy(wasHit: boolean = false): void {
    if (!this._active) return;

    this._active = false;

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

  public static preload(scene: Phaser.Scene): void {
    console.log("💡 Bullet system preloaded");
  }

  public static getDefaultConfig(): Required<BulletConfig> {
    return {
      speed: 800,
      damage: 25,
      radius: 6,
      color: 0xffaa00,
      tailColor: 0xffaa00, // 🔥 총알과 같은 색상으로 기본값 변경
      tailLength: 2000,
      gravity: { x: 0, y: 900 },
      useWorldGravity: false,
      lifetime: 8000,
    };
  }

  public debugPhysics(): void {
    if (!this.sprite || !this.sprite.body) {
      console.log(`🔍 이알 ${this._id}: 물리 바디 없음`);
      return;
    }

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    console.log(`🔍 이알 ${this._id} 물리 상태:`, {
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
  console.log(`   이구: (${gunX.toFixed(1)}, ${gunY.toFixed(1)})`);
  console.log(`   목표: (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`);

  // 1. 발사 각도 계산
  const angle = Math.atan2(targetY - gunY, targetX - gunX);
  console.log(`   각도: ${((angle * 180) / Math.PI).toFixed(1)}도`);

  // 2. 이알 스폰 위치 - 이구에서 약간 앞으로
  const spawnDistance = 10;
  const spawnX = gunX + Math.cos(angle) * spawnDistance;
  const spawnY = gunY + Math.sin(angle) * spawnDistance;

  console.log(`   스폰: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)})`);

  // 3. 이알 그룹 가져오기
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

  // 4. 이알 생성 (총알과 테일 같은 색상으로)
  const bullet = new Bullet(scene, bulletGroup, spawnX, spawnY, angle, {
    speed,
    gravity: { x: 0, y: 1500 },
    useWorldGravity: false,
    radius: 6,
    color: 0xffaa00,
    tailColor: 0xffaa00, // 🔥 총알과 같은 색상
    lifetime: 8000,
  });

  console.log(`✅ 이알 생성 완료: ${bullet.id}`);

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
      magazineSize: 6, //이알갯수
      reloadTime: 300000,
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
    const shot = doShoot({
      scene: this.scene,
      gunX,
      gunY,
      targetX,
      targetY,
      speed: this.weaponConfig.muzzleVelocity,
      cooldownMs: 0,
      lastShotTime: 0,
      recoilBase: this.weaponConfig.recoil,
      wobbleBase: 0.3,
      collisionSystem: { getBulletGroup: () => this.bulletGroup },
    });

    this.bullets.set(shot.bullet.id, shot.bullet);
    this.limitBulletCount();

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

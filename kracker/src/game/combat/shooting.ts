// src/game/combat/shooting.ts - 기존 구조 유지하며 벽 관통 방지
import { Bullet, BulletConfig, BulletEvents } from "../bullet";

/**
 * 사격 가능 여부 체크 (레거시 호환)
 */
export function canShoot(
  lastShotTime: number,
  cooldownMs: number,
  now: number = Date.now()
): boolean {
  return now - lastShotTime >= cooldownMs;
}

/**
 * 🔥 개선된 단일 사격 - 안전한 총구 위치 계산
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
    speed = 800,
    recoilBase = 1.5,
    wobbleBase = 0.3,
    collisionSystem,
    platforms = [],
  } = opts;

  console.log(
    `🎯 doShoot 호출됨: 총구위치(${gunX.toFixed(1)}, ${gunY.toFixed(
      1
    )}) -> 목표(${targetX.toFixed(1)}, ${targetY.toFixed(1)})`
  );

  const angle = Math.atan2(targetY - gunY, targetX - gunX);
  console.log(`🎯 발사 각도: ${((angle * 180) / Math.PI).toFixed(1)}도`);

  // 🔥 안전한 총구 위치 계산 (벽에서 충분히 떨어진 곳)
  const safeSpawnPos = calculateSafeSpawnPosition(
    gunX,
    gunY,
    angle,
    platforms,
    12 // 12픽셀 안전 거리
  );

  console.log(
    `🛡️ 안전한 스폰 위치: (${safeSpawnPos.x.toFixed(
      1
    )}, ${safeSpawnPos.y.toFixed(1)})`
  );

  // CollisionSystem에서 bulletGroup 가져오기
  let bulletGroup: Phaser.Physics.Arcade.Group;

  if (collisionSystem && typeof collisionSystem.getBulletGroup === "function") {
    bulletGroup = collisionSystem.getBulletGroup();
  } else {
    console.warn(
      "⚠️ CollisionSystem에서 bulletGroup을 찾을 수 없습니다. 임시로 새 그룹을 생성합니다."
    );
    bulletGroup = scene.physics.add.group({
      runChildUpdate: true,
      allowGravity: true,
    });
  }

  // 총알 생성 (안전한 위치에서)
  const bullet = new Bullet(
    scene,
    bulletGroup,
    safeSpawnPos.x,
    safeSpawnPos.y,
    angle,
    {
      speed,
      gravity: { x: 0, y: 300 },
      useWorldGravity: false,
      radius: 6,
      color: 0xffaa00,
      tailColor: 0xff6600,
      lifetime: 8000,
    }
  );

  console.log(
    `🚀 총알 생성됨: ID=${bullet.id}, 속도=${speed}, 각도=${(
      (angle * 180) /
      Math.PI
    ).toFixed(1)}도`
  );

  return {
    bullet,
    lastShotTime: Date.now(),
    recoilAdd: recoilBase,
    wobbleAdd: wobbleBase,
  };
}

/**
 * 🔥 벽에서 안전한 거리에 총알 스폰 위치 계산
 */
function calculateSafeSpawnPosition(
  gunX: number,
  gunY: number,
  angle: number,
  platforms: any[],
  safetyDistance: number = 12
): { x: number; y: number } {
  // 총구 방향 벡터
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  // 🔥 먼저 총구 위치가 벽 내부인지 확인
  if (isPositionInWall(gunX, gunY, platforms, 6)) {
    console.warn(`⚠️ 총구가 벽 내부에 있음! 안전한 위치로 이동`);
    // 총구 방향 반대로 이동해서 벽에서 빠져나옴
    let escapeX = gunX;
    let escapeY = gunY;
    for (let i = 1; i <= 20; i++) {
      escapeX = gunX - dirX * i * 2;
      escapeY = gunY - dirY * i * 2;
      if (!isPositionInWall(escapeX, escapeY, platforms, 6)) {
        console.log(`✅ 벽에서 탈출: ${i * 2}px 뒤로 이동`);
        return { x: escapeX, y: escapeY };
      }
    }
    return { x: escapeX, y: escapeY }; // 최대한 뒤로 이동
  }

  // 🔥 벽까지의 거리 확인
  const wallDistance = getDistanceToWall(gunX, gunY, angle, platforms);

  if (wallDistance < safetyDistance) {
    // 벽이 너무 가까우면 뒤로 이동
    const backwardDistance = safetyDistance - wallDistance + 5;
    console.log(
      `🚧 벽이 ${wallDistance}px 거리에 있어서 ${backwardDistance}px 뒤로 이동`
    );
    return {
      x: gunX - dirX * backwardDistance,
      y: gunY - dirY * backwardDistance,
    };
  } else {
    // 안전하면 약간 앞으로
    return {
      x: gunX + dirX * 3,
      y: gunY + dirY * 3,
    };
  }
}

/**
 * 🔥 벽까지의 거리 계산
 */
function getDistanceToWall(
  x: number,
  y: number,
  angle: number,
  platforms: any[]
): number {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const stepSize = 1;
  const maxDistance = 100;

  for (let distance = 0; distance < maxDistance; distance += stepSize) {
    const testX = x + dirX * distance;
    const testY = y + dirY * distance;

    if (isPositionInWall(testX, testY, platforms, 3)) {
      return distance;
    }
  }

  return maxDistance;
}

/**
 * 🔥 특정 위치가 벽 내부에 있는지 확인
 */
function isPositionInWall(
  x: number,
  y: number,
  platforms: any[],
  radius: number = 6
): boolean {
  for (const platform of platforms) {
    // 플랫폼 경계 계산
    let left, right, top, bottom;

    if (platform.body) {
      // Phaser 물리 바디가 있는 경우
      const body = platform.body;
      left = body.left ?? body.x;
      right = body.right ?? body.x + body.width;
      top = body.top ?? body.y;
      bottom = body.bottom ?? body.y + body.height;
    } else {
      // 일반 Platform 객체인 경우
      left = platform.x;
      right = platform.x + platform.width;
      top = platform.y;
      bottom = platform.y + platform.height;
    }

    // 총알이 플랫폼과 겹치는지 확인 (반지름 고려)
    if (
      x + radius > left &&
      x - radius < right &&
      y + radius > top &&
      y - radius < bottom
    ) {
      return true;
    }
  }
  return false;
}

// 기존 WeaponConfig 등 다른 인터페이스들은 그대로 유지
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

// 기본 ShootingSystem - 더 안정적인 버전
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
    console.log("🎯 ShootingSystem bulletGroup 생성됨");
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
    console.log(
      `🔫 fireBullet 호출: (${gunX}, ${gunY}) -> (${targetX}, ${targetY})`
    );

    const baseAngle = Math.atan2(targetY - gunY, targetX - gunX);

    const accuracy =
      this.weaponConfig.accuracy * (1 - this.state.recoilAccumulation * 0.05);
    const spreadAngle = (1 - accuracy) * Math.PI * 0.05;
    const actualAngle = baseAngle + (Math.random() - 0.5) * spreadAngle;

    const finalBulletConfig: BulletConfig = {
      speed: this.weaponConfig.muzzleVelocity,
      damage: this.weaponConfig.damage,
      radius: 6,
      color: 0xffaa00,
      tailColor: 0xff6600,
      gravity: { x: 0, y: 300 },
      useWorldGravity: false,
      lifetime: 8000,
      ...bulletConfig,
    };

    const bulletEvents: BulletEvents = {
      onHit: (x: number, y: number) => {
        console.log(`💥 총알 명중! 위치: (${x.toFixed(1)}, ${y.toFixed(1)})`);
      },
      onDestroy: () => {
        console.log(`🗑️ 총알 파괴됨`);
      },
    };

    // 🔥 안전한 위치에서 총알 생성
    const safePos = calculateSafeSpawnPosition(gunX, gunY, actualAngle, [], 10);

    const bullet = new Bullet(
      this.scene,
      this.bulletGroup,
      safePos.x,
      safePos.y,
      actualAngle,
      finalBulletConfig,
      bulletEvents
    );

    this.bullets.set(bullet.id, bullet);
    this.limitBulletCount();
    this.createMuzzleFlash(gunX, gunY, actualAngle); // 머즐 플래시는 원래 총구 위치에서

    const recoilStrength =
      this.weaponConfig.recoil * (1 + this.state.recoilAccumulation * 0.1);
    this.onShotCallback?.(recoilStrength);

    console.log(
      `✅ 총알 발사 완료! ID: ${bullet.id}, 각도: ${(
        (actualAngle * 180) /
        Math.PI
      ).toFixed(1)}도`
    );
  }

  private limitBulletCount(): void {
    if (this.bullets.size <= this.maxBullets) return;
    const bulletArray = Array.from(this.bullets.values());
    bulletArray.sort((a, b) => a.age - b.age);
    const bulletsToRemove = bulletArray.slice(
      0,
      this.bullets.size - this.maxBullets
    );
    bulletsToRemove.forEach((bullet) => this.removeBullet(bullet.id));
  }

  private createMuzzleFlash(x: number, y: number, angle: number): void {
    if (!this.muzzleFlashConfig.enabled) return;
    try {
      const flash = this.scene.add.graphics();
      flash.setPosition(x, y);
      flash.setRotation(angle);
      flash.setDepth(120);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      flash.fillStyle(
        this.muzzleFlashConfig.color,
        this.muzzleFlashConfig.intensity
      );
      flash.fillEllipse(
        0,
        0,
        this.muzzleFlashConfig.size,
        this.muzzleFlashConfig.size * 0.3
      );
      this.scene.tweens.add({
        targets: flash,
        scaleX: { from: 1, to: 1.5 },
        scaleY: { from: 1, to: 0.8 },
        alpha: { from: 1, to: 0 },
        duration: this.muzzleFlashConfig.duration,
        ease: "Power2",
        onComplete: () => flash.destroy(),
      });
    } catch (error) {
      console.warn("머즐 플래시 생성 실패:", error);
    }
  }

  public startReload(): boolean {
    if (
      this.state.isReloading ||
      this.state.currentAmmo >= this.weaponConfig.magazineSize
    ) {
      return false;
    }
    this.state.isReloading = true;
    this.state.reloadStartTime = Date.now();
    this.state.burstRemaining = 0;
    console.log(`🔄 재장전 시작 (${this.weaponConfig.reloadTime}ms)`);
    return true;
  }

  private finishReload(): void {
    this.state.isReloading = false;
    this.state.currentAmmo = this.weaponConfig.magazineSize;
    this.state.reloadStartTime = 0;
    console.log(`✅ 재장전 완료`);
  }

  private removeBullet(bulletId: string): void {
    const bullet = this.bullets.get(bulletId);
    if (bullet) {
      bullet.destroy();
      this.bullets.delete(bulletId);
    }
  }

  private update(): void {
    for (const bullet of Array.from(this.bullets.values())) {
      if (bullet.active) {
        bullet.update();
      } else {
        this.removeBullet(bullet.id);
      }
    }
    this.state.recoilAccumulation *= 0.95;
    if (this.state.recoilAccumulation < 0.01) {
      this.state.recoilAccumulation = 0;
    }
  }

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

  public setOnShotCallback(callback: (recoil: number) => void): void {
    this.onShotCallback = callback;
  }

  public clearAllBullets(): void {
    for (const bullet of Array.from(this.bullets.values())) {
      bullet.destroy();
    }
    this.bullets.clear();
    this.bulletGroup.clear(true, false);
  }

  public destroy(): void {
    console.log("🧽 ShootingSystem 정리 중...");
    this.scene.events.off("update", this.update, this);
    this.clearAllBullets();
    if (this.bulletGroup) {
      this.bulletGroup.destroy(true);
    }
    console.log("✅ ShootingSystem 정리 완료");
  }
}

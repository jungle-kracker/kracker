// src/game/combat/shooting.ts - 단순화된 사격 시스템
import { Bullet, BulletConfig, BulletEvents } from "../bullet";

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
    speed = 800,
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
    gravity: { x: 0, y: 300 },
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

// 기존 인터페이스들 유지
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

// 기본 ShootingSystem (기존과 동일)
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

  // 나머지 메서드들은 기존과 동일
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
    this.bullets.forEach((bullet) => {
      if (bullet && typeof bullet.destroy === "function") {
        bullet.destroy();
      }
    });
    this.bullets.clear();
    this.bulletGroup.clear(true, false);
  }

  public destroy(): void {
    this.scene.events.off("update", this.update, this);
    this.clearAllBullets();
    if (this.bulletGroup) {
      this.bulletGroup.destroy(true);
    }
  }
}

// src/game/managers/ShootingManager.ts - 사격 시스템 전담 매니저
import { ShootingSystem } from "../bullet";
// 증강 데이터 로드 (JSON)
// tsconfig에 resolveJsonModule이 켜져 있으므로 직접 import 가능
// 배열 형태: [{ id, name, description, imageFile, effects }]
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import AUGMENT_DEFS from "../../data/augments.json";
import { aggregateAugments as centralAggregate } from "../../data/augments";
import { Debug, debugManager } from "../debug/DebugManager";
import { LogCategory } from "../debug/Logger";
import Player from "../player/Player";

export interface ShootingManagerConfig {
  fireRate: number;
  damage: number;
  accuracy: number;
  recoil: number;
  muzzleVelocity: number;
  magazineSize: number;
  reloadTime: number;
  burstCount?: number;
  burstDelay?: number;
}

export interface ShootingUI {
  ammoText: Phaser.GameObjects.Text;
  reloadText: Phaser.GameObjects.Text;
}

export class ShootingManager {
  private scene: Phaser.Scene;
  private shootingSystem!: ShootingSystem;
  private ui!: ShootingUI;
  private player?: Player;

  // 설정
  private config: Required<ShootingManagerConfig>;

  // 이벤트 콜백들
  private onShotCallback?: (recoil: number) => void;
  private onReloadCallback?: () => void;
  private onHitCallback?: (x: number, y: number) => void;
  private ownerId: string | null = null;
  private augmentResolver?: (
    playerId: string
  ) => Record<string, { id: string; startedAt: number }> | undefined;
  private getAugmentsFor?: (
    playerId: string
  ) => Record<string, { id: string; startedAt: number }> | undefined;

  // 총 위 총알 표시를 위한 그래픽 객체
  private ammoGraphics?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, config: ShootingManagerConfig) {
    this.scene = scene;

    this.config = {
      burstCount: 1,
      burstDelay: 100,
      ...config,
    };

    Debug.log.info(LogCategory.SCENE, "ShootingManager 생성됨", this.config);
  }

  /**
   * 초기화
   */
  public initialize(): void {
    Debug.log.info(LogCategory.SCENE, "ShootingManager 초기화 시작");

    // ShootingSystem 생성
    this.shootingSystem = new ShootingSystem(this.scene, this.config);

    // 반동 효과 콜백 설정
    this.shootingSystem.setOnShotCallback((recoil) => {
      this.handleRecoil(recoil);
      this.onShotCallback?.(recoil);
    });

    // 증강으로 무기 파라미터 보정 (초기 1회)
    try {
      const aug = this.ownerId && this.augmentResolver ? this.augmentResolver(this.ownerId) : undefined;
      const agg = centralAggregate(aug);
      // 재장전/탄창/발사간격 보정
      this.applyWeaponAugments(agg.weapon);
    } catch {}

    // UI 생성
    this.createUI();

    // 입력 이벤트 설정
    this.setupInputEvents();

    Debug.log.info(
      LogCategory.SCENE,
      `ShootingManager 초기화 완료 - ${this.config.magazineSize}발/${this.config.reloadTime}ms재장전`
    );
  }

  /**
   * UI 생성
   */
  private createUI(): void {
    const uiDepth = 1000;
    const baseX = 50;
    const baseY = this.scene.cameras.main.height - 150;

    // 탄약 표시 (비활성화 - 총 위에 원으로 표시)
    this.ui = {
      ammoText: this.scene.add
        .text(baseX, baseY, "", {
          fontSize: "28px",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
          fontFamily: "Arial, sans-serif",
        })
        .setDepth(uiDepth)
        .setScrollFactor(0)
        .setVisible(false), // 비활성화

      reloadText: this.scene.add
        .text(baseX, baseY + 40, "", {
          fontSize: "20px",
          color: "#ffaa00",
          stroke: "#000000",
          strokeThickness: 2,
          fontFamily: "Arial, sans-serif",
        })
        .setDepth(uiDepth)
        .setScrollFactor(0)
        .setVisible(false), // 비활성화
    };

    // 총 위에 총알 원형 표시를 위한 그래픽 객체 생성
    this.ammoGraphics = this.scene.add.graphics();
    this.ammoGraphics.setDepth(uiDepth + 1);
    this.ammoGraphics.setScrollFactor(0);

    Debug.log.info(LogCategory.UI, "사격 UI 생성 완료 (총 위 원형 총알 표시)");
  }

  /**
   * 입력 이벤트 설정
   */
  private setupInputEvents(): void {
    // 마우스 클릭으로 사격
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.tryShoot(pointer.worldX, pointer.worldY);
    });

    // R키로 수동 재장전
    const rKey = this.scene.input.keyboard?.addKey("R");
    rKey?.on("down", () => {
      Debug.log.info(LogCategory.INPUT, "수동 재장전 요청");
      this.forceReload();
    });

    Debug.log.info(LogCategory.INPUT, "사격 이벤트 설정 완료");
  }

  /**
   * 플레이어 설정
   */
  public setPlayer(player: Player): void {
    this.player = player;
    Debug.log.debug(LogCategory.PLAYER, "ShootingManager에 플레이어 설정됨");
  }

  /**
   * 사격 시도
   */
  public tryShoot(targetX: number, targetY: number): boolean {
    if (!this.player) {
      Debug.log.warn(LogCategory.GAME, "플레이어가 설정되지 않아 사격 불가");
      return false;
    }

    // 총의 실제 위치 계산 (동적)
    const playerX = this.player.getX();
    const playerY = this.player.getY();
    const playerState = this.player.getState();
    const gunX = playerX + (playerState.facingDirection === "right" ? 30 : -30);
    const gunY = playerY - 10;

    const before = new Set(this.shootingSystem?.getAllBullets() || []);
    // ShootingSystem으로 사격 시도
    // 증강 파라미터 계산

    const aug =
      this.ownerId && this.augmentResolver
        ? this.augmentResolver(this.ownerId)
        : undefined;
    let speedMul = 1.0;
    if (aug?.["벌이야!"]) speedMul *= 1.2; // 카드: +20% 총알 속도 증가

    const agg = centralAggregate(aug);
    try { console.log("🛠️ 증강 적용(사격):", { weapon: agg.weapon, bullet: agg.bullet }); } catch {}

    // 총알 기본치 기반 파라미터 구성
    const baseSpeed = this.config.muzzleVelocity;
    const baseDamage = this.config.damage;
    const baseRadius = 6;

    // 총알 색상(증강 기반): 독걸려랑=녹색, 벌이야!=노란색
    let bulletColor = 0xffaa00;
    if (aug?.["독걸려랑"]) bulletColor = 0x00ff00;
    else if (aug?.["벌이야!"]) bulletColor = 0xffff00;

    const bulletConfig = {
      speed: baseSpeed * agg.bullet.speedMul,
      damage: Math.max(0, Math.round(baseDamage * agg.bullet.damageMul + agg.bullet.damageAdd)),
      radius: Math.max(2, Math.round(baseRadius * agg.bullet.sizeMul)),
      homingStrength: agg.bullet.homingStrength,
      explodeRadius: agg.bullet.explodeRadius,
    } as const;

    const shotFired = this.shootingSystem.tryShoot(
      gunX,
      gunY,
      targetX,
      targetY,
      {
        // 커스텀 총알 설정
        color: bulletColor,
        tailColor: bulletColor,
        radius: bulletConfig.radius,
        speed: bulletConfig.speed,
        damage: bulletConfig.damage,
        homingStrength: bulletConfig.homingStrength,
        explodeRadius: bulletConfig.explodeRadius,
        gravity: { x: 0, y: 500 },
        useWorldGravity: false,
        lifetime: 8000,
      }
    );

    if (shotFired) {
      const after = this.shootingSystem?.getAllBullets() || [];
      const remaining = this.shootingSystem.getCurrentAmmo();
      Debug.log.debug(
        LogCategory.GAME,
        `🔫 발사! 남은 탄약: ${remaining}/${this.shootingSystem.getMaxAmmo()}`
      );
      after.forEach((b: any) => {
        if (!before.has(b)) {
          b.ownerId = this.ownerId || "local";
          b._remote = false;
          b._hitProcessed = false;
          // 특수 탄 플래그 설정
          try {
            if (aug?.["유령이다"]) {
              b.setData && b.setData("__ghost", true);
            }
            // 총알 소유자 정보 주입 (폭발 등 이벤트용)
            if (b && typeof b.setData === "function") {
              b.setData("__ownerId", this.ownerId || "local");
            }
            (b as any).__ownerId = this.ownerId || "local";

            // 바운스/관통 카운트 반영
            const curBounce = (b.getData && b.getData("__bounce")) || 0;
            const totalBounce = (curBounce || 0) + (agg.bullet.bounceCount || 0);
            if (totalBounce > 0) b.setData && b.setData("__bounce", totalBounce);

            const curPierce = (b.getData && b.getData("__pierce")) || 0;
            const totalPierce = (curPierce || 0) + (agg.bullet.pierceCount || 0);
            if (totalPierce > 0) b.setData && b.setData("__pierce", totalPierce);
          } catch {}
        }
      });

      // 반동 효과
      this.handleRecoil(this.config.recoil);

      // 카메라 흔들림 효과
      this.scene.cameras.main.shake(5000, 0.005);

      // 사격 콜백 호출 (네트워크 전송용)
      this.onShotCallback?.(this.config.recoil);
    } else {
      this.logShootFailureReason();
    }

    return shotFired;
  }

  /**
   * 사격 실패 이유 로깅
   */
  private logShootFailureReason(): void {
    if (this.shootingSystem.isReloading()) {
      Debug.log.debug(LogCategory.GAME, "🔄 재장전 중...");
    } else if (this.shootingSystem.getCurrentAmmo() === 0) {
      Debug.log.debug(LogCategory.GAME, "💥 탄약 부족! R키로 재장전");
    } else {
      Debug.log.debug(LogCategory.GAME, "⏰ 연사 속도 제한");
    }
  }

  /**
   * 반동 효과 처리
   */
  private handleRecoil(recoilAmount: number): void {
    if (!this.player) return;

    const player = this.player as any;
    if (player.body) {
      // 플레이어 뒤로 밀기
      const pushBackForce = recoilAmount * 15;
      const currentVelX = player.body.velocity.x;
      const recoilX = Math.random() * pushBackForce - pushBackForce / 2;
      player.body.setVelocityX(currentVelX + recoilX);
    }

    this.scene.cameras.main.shake(100, 0.00029);
  }

  /**
   * 강제 재장전
   */
  public forceReload(): void {
    this.shootingSystem?.forceReload();
    this.onReloadCallback?.();
    Debug.log.info(LogCategory.GAME, "강제 재장전 실행");
  }

  /**
   * 충돌 시스템 설정
   */
  public setupCollisions(
    platformGroup: Phaser.Physics.Arcade.StaticGroup
  ): void {
    const bulletGroup = this.shootingSystem.getBulletGroup();

    // 총알 vs 플랫폼 충돌
    this.scene.physics.add.collider(
      bulletGroup,
      platformGroup,
      (bulletSprite: any, platform: any) => {
        const bulletRef = bulletSprite.getData("__bulletRef");
        if (bulletRef && typeof bulletRef.hit === "function") {
          bulletRef.hit(bulletSprite.x, bulletSprite.y);
          this.onHitCallback?.(bulletSprite.x, bulletSprite.y);
          Debug.log.debug(LogCategory.GAME, "총알이 플랫폼에 명중");
        }
      }
    );

    Debug.log.info(LogCategory.GAME, "사격 충돌 시스템 설정 완료");
  }

  /**
   * 업데이트 (매 프레임)
   */
  public update(): void {
    if (this.shootingSystem) {
      this.shootingSystem.updateBullets();
    }

    this.updateUI();
  }

  /**
   * UI 업데이트
   */
  private updateUI(): void {
    if (!this.shootingSystem) return;

    const currentAmmo = this.shootingSystem.getCurrentAmmo();
    const maxAmmo = this.shootingSystem.getMaxAmmo();

    // 총 위에 총알 원형 표시 업데이트
    this.updateAmmoGraphics(currentAmmo, maxAmmo);

    // 재장전 상태 표시 (텍스트는 비활성화되어 있음)
    if (this.shootingSystem.isReloading()) {
      // 재장전 중일 때 총알 원형들을 깜빡이게
      this.blinkAmmoGraphics();
    }
  }

  // ===== 증강 효과 집계 =====
  // 로컬 집계 함수 제거 → 중앙 유틸 사용

  // ===== 증강 적용/재적용 API =====
  public applyWeaponAugments(weaponAgg: { reloadTimeDeltaMs: number; magazineDelta: number; fireIntervalAddMs: number }): void {
    try {
      const prevReload = this.config.reloadTime;
      const prevMag = this.config.magazineSize;
      const reload = this.config.reloadTime + (weaponAgg?.reloadTimeDeltaMs || 0);
      const mag = this.config.magazineSize + (weaponAgg?.magazineDelta || 0);
      const addInterval = Math.max(0, weaponAgg?.fireIntervalAddMs || 0);
      this.shootingSystem.setReloadTime(reload);
      this.shootingSystem.setMagazineSize(mag);
      this.shootingSystem.setFireIntervalAddMs(addInterval);
      try {
        if ((weaponAgg?.magazineDelta || 0) !== 0) {
          console.log(`🧩 증강(탄창): 총 탄창 수량 ${prevMag} -> ${mag} (Δ ${weaponAgg.magazineDelta})`);
        }
        if ((weaponAgg?.reloadTimeDeltaMs || 0) !== 0) {
          console.log(`🧩 증강(재장전): 재장전 시간 ${prevReload}ms -> ${reload}ms (Δ ${weaponAgg.reloadTimeDeltaMs}ms)`);
        }
        if ((weaponAgg?.fireIntervalAddMs || 0) !== 0) {
          console.log(`🧩 증강(발사간격): 추가 간격 +${weaponAgg.fireIntervalAddMs}ms`);
        }
      } catch {}
    } catch {}
  }

  public reapplyWeaponAugments(): void {
    const aug = this.ownerId && this.augmentResolver ? this.augmentResolver(this.ownerId) : undefined;
    const agg = centralAggregate(aug);
    try { console.log("🛠️ 증강 재적용(무기):", agg.weapon); } catch {}
    this.applyWeaponAugments(agg.weapon);
  }

  /**
   * 총 위에 총알 원형 표시 업데이트 (3개씩 위아래 그룹화)
   */
  private updateAmmoGraphics(currentAmmo: number, maxAmmo: number): void {
    if (!this.ammoGraphics || !this.player) return;

    this.ammoGraphics.clear();

    // 총 위치 계산 (플레이어 위치 + 총 위치 오프셋)
    const playerX = this.player.getX();
    const playerY = this.player.getY();
    const playerState = this.player.getState();
    const gunX = playerX + (playerState.facingDirection === "right" ? 30 : -30);
    const gunY = playerY - 10;

    // 총알 원형 크기와 간격
    const bulletRadius = 4;
    const bulletSpacing = 8; // 총알 간 간격
    const rowSpacing = 12; // 위아래 행 간격
    const bulletsPerRow = 3; // 행당 총알 수

    // 총알 행 수 계산
    const totalRows = Math.ceil(maxAmmo / bulletsPerRow);
    const currentRow = Math.floor(currentAmmo / bulletsPerRow);
    const bulletsInCurrentRow = currentAmmo % bulletsPerRow;

    // 총알 탄창 위치 (총 위에)
    const magazineY = gunY - 15; // 총에 더 가깝게 위치

    // 각 행별로 총알 그리기
    for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
      const rowY = magazineY + (rowIndex - totalRows / 2) * rowSpacing;

      // 현재 행의 총알 수
      const bulletsInThisRow =
        rowIndex < currentRow
          ? bulletsPerRow
          : rowIndex === currentRow
          ? bulletsInCurrentRow
          : 0;

      // 행 내 총알들 그리기
      for (let bulletIndex = 0; bulletIndex < bulletsPerRow; bulletIndex++) {
        const x =
          gunX +
          (playerState.facingDirection === "right" ? 10 : -10) +
          (bulletIndex - 1) * bulletSpacing; // 총 앞쪽으로 이동
        const y = rowY;

        if (bulletIndex < bulletsInThisRow) {
          // 남은 총알 - 밝은 노란색
          this.ammoGraphics.fillStyle(0xffff00, 0.9);
          this.ammoGraphics.fillCircle(x, y, bulletRadius);
          this.ammoGraphics.lineStyle(1, 0xffffff, 1);
          this.ammoGraphics.strokeCircle(x, y, bulletRadius);
        } else {
          // 사용된 총알 - 어두운 회색
          this.ammoGraphics.fillStyle(0x666666, 0.5);
          this.ammoGraphics.fillCircle(x, y, bulletRadius);
          this.ammoGraphics.lineStyle(1, 0x444444, 0.8);
          this.ammoGraphics.strokeCircle(x, y, bulletRadius);
        }
      }

      // 행 구분선 (선택사항)
      if (rowIndex < totalRows - 1) {
        this.ammoGraphics.lineStyle(1, 0x444444, 0.3);
        this.ammoGraphics.beginPath();
        this.ammoGraphics.moveTo(gunX - 16, rowY + rowSpacing / 2);
        this.ammoGraphics.lineTo(gunX + 16, rowY + rowSpacing / 2);
        this.ammoGraphics.strokePath();
      }
    }
  }

  /**
   * 총알 원형들 깜빡이기 (재장전 중)
   */
  private blinkAmmoGraphics(): void {
    if (!this.ammoGraphics) return;

    const blinkAlpha = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
    this.ammoGraphics.setAlpha(blinkAlpha);
  }

  /**
   * 화면 크기 변경 처리
   */
  public handleResize(width: number, height: number): void {
    if (!this.ui.ammoText || !this.ui.reloadText) return;

    const baseY = height - 150;
    this.ui.ammoText.setPosition(50, baseY);
    this.ui.reloadText.setPosition(50, baseY + 40);

    Debug.log.debug(LogCategory.UI, "사격 UI 리사이즈 완료", { width, height });
  }

  // ===== 콜백 설정 메서드들 =====

  public onShot(callback: (recoil: number) => void): void {
    this.onShotCallback = callback;
  }

  public onReload(callback: () => void): void {
    this.onReloadCallback = callback;
  }

  public onHit(callback: (x: number, y: number) => void): void {
    this.onHitCallback = callback;
  }

  // ===== 상태 조회 메서드들 =====
  public setOwnerId(id: string) {
    this.ownerId = id;
  }

  public getAllBullets(): any[] {
    return this.shootingSystem?.getAllBullets() || [];
  }

  public getAmmoStatus(): {
    current: number;
    max: number;
    isReloading: boolean;
  } {
    if (!this.shootingSystem) {
      return { current: 0, max: 0, isReloading: false };
    }

    return {
      current: this.shootingSystem.getCurrentAmmo(),
      max: this.shootingSystem.getMaxAmmo(),
      isReloading: this.shootingSystem.isReloading(),
    };
  }

  public getBulletGroup(): Phaser.Physics.Arcade.Group {
    return this.shootingSystem.getBulletGroup();
  }

  // 증강 조회 콜백을 등록(씬에서 세팅)
  public setAugmentResolver(
    fn: (playerId: string) => Record<string, { id: string; startedAt: number }> | undefined
  ) {
    this.augmentResolver = fn;
  }

  public getShootingSystem(): ShootingSystem {
    return this.shootingSystem;
  }

  public canShoot(): boolean {
    return this.shootingSystem?.canShoot() || false;
  }

  public getBulletCount(): number {
    return this.shootingSystem?.getBulletCount() || 0;
  }

  // ===== 헬퍼 메서드들 =====

  private getPlayerX(): number {
    if (!this.player) return 0;
    const playerX =
      typeof this.player.getX === "function"
        ? this.player.getX()
        : (this.player as any).x || 0;
    const playerState = this.player.getState ? this.player.getState() : null;
    const facingDirection = playerState?.facingDirection || "right";
    return playerX + (facingDirection === "right" ? 30 : -30);
  }

  private getPlayerY(): number {
    if (!this.player) return 0;
    const playerY =
      typeof this.player.getY === "function"
        ? this.player.getY()
        : (this.player as any).y || 0;
    return playerY - 10;
  }

  // ===== 원격 플레이어용 메서드들 =====

  /**
   * 원격 플레이어의 시각적 총알 생성 (충돌하지 않음)
   */

  public getDamage(): number {
    return this.config?.damage ?? 25; // 내부 private config 사용
  }
  public createRemotePlayerBullet(shootData: {
    gunX: number;
    gunY: number;
    angle: number;
    color?: number;
    shooterId: string;
  }): void {
    // 목표 지점 계산 (각도를 이용해서)
    const range = 1000; // 총알 사정거리
    const targetX = shootData.gunX + Math.cos(shootData.angle) * range;
    const targetY = shootData.gunY + Math.sin(shootData.angle) * range;

    // 원격 총알 생성을 위한 별도 메서드 사용 (탄창 감소 없음)
    const before = new Set(this.shootingSystem?.getAllBullets() || []);

    // 원격 사수의 증강 반영
    const remoteAug = this.augmentResolver ? this.augmentResolver(shootData.shooterId) : undefined;
    const rAgg = centralAggregate(remoteAug);
    try { console.log("🛠️ 증강 적용(원격 총알):", { shooterId: shootData.shooterId, bullet: rAgg.bullet }); } catch {}

    // 원격 총알 색상(증강 기반)
    let bulletColor = 0xffaa00;
    if (remoteAug?.["독걸려랑"]) bulletColor = 0x00ff00; // 녹색
    else if (remoteAug?.["벌이야!"]) bulletColor = 0xffff00; // 노란색
  const shotFired = this.shootingSystem.createRemoteBullet(

      shootData.gunX,
      shootData.gunY,
      targetX,
      targetY,
      {
        color: bulletColor,
        tailColor: bulletColor,

        gravity: { x: 0, y: 1500 }, // 원래 중력

        radius: Math.max(2, Math.round(6 * rAgg.bullet.sizeMul)),
        speed: this.config.muzzleVelocity * rAgg.bullet.speedMul * 0.8,
        damage: Math.max(0, Math.round(this.config.damage * rAgg.bullet.damageMul + rAgg.bullet.damageAdd)),
        homingStrength: rAgg.bullet.homingStrength,
        explodeRadius: rAgg.bullet.explodeRadius,


        useWorldGravity: false,
        lifetime: 8000, // 원래 수명
      }
    );

    if (shotFired) {
      const after = this.shootingSystem?.getAllBullets() || [];
      after.forEach((b: any) => {
        if (!before.has(b)) {
          b.ownerId = shootData.shooterId; // 🔹 발사자(원격 플레이어) id
          b._remote = true;
          b._hitProcessed = false;
          // 시각 효과 및 물리 플래그 반영
          try {
            // 소유자 id를 스프라이트 데이터에도 저장(유도 대상 판정용)
            b.setData && b.setData("__ownerId", shootData.shooterId);
            if (remoteAug?.["유령이다"]) {
              b.setData && b.setData("__ghost", true);
            }
            const curB = (b.getData && b.getData("__bounce")) || 0;
            const totalB = (curB || 0) + (rAgg.bullet.bounceCount || 0);
            if (totalB > 0) b.setData && b.setData("__bounce", totalB);

            const curP = (b.getData && b.getData("__pierce")) || 0;
            const totalP = (curP || 0) + (rAgg.bullet.pierceCount || 0);
            if (totalP > 0) b.setData && b.setData("__pierce", totalP);
          } catch {}
        }
      });
    }
    Debug.log.debug(
      LogCategory.GAME,
      `원격 총알 발사: ${shotFired ? "성공" : "실패"}`
    );
  }

  // ===== 디버그 메서드들 =====

  public debugInfo(): void {
    if (!Debug.isEnabled()) return;

    console.log("🔫 ShootingManager 상태:");
    console.log("  설정:", this.config);
    console.log("  탄약 상태:", this.getAmmoStatus());
    console.log("  총알 수:", this.getBulletCount());
    console.log("  사격 가능:", this.canShoot());

    this.shootingSystem?.debugInfo();
  }

  public getDebugTools() {
    if (!Debug.isEnabled()) return null;

    return {
      infiniteAmmo: () => {
        Debug.log.warn(LogCategory.GAME, "무한 탄약 모드 활성화 (개발용)");
        // 실제 구현시 무한 탄약 로직 추가
      },

      shootingStressTest: () => {
        for (let i = 0; i < 20; i++) {
          setTimeout(() => {
            const targetX = Math.random() * 1000 + 100;
            const targetY = Math.random() * 600 + 100;
            this.tryShoot(targetX, targetY);
          }, i * 100);
        }
        Debug.log.warn(LogCategory.PERFORMANCE, "사격 스트레스 테스트 시작");
      },

      logShootingInfo: () => {
        this.debugInfo();
        const bullets = this.shootingSystem?.getAllBullets() || [];
        Debug.log.info(LogCategory.GAME, `활성 총알 수: ${bullets.length}`);
      },

      setFireRate: (rate: number) => {
        this.config.fireRate = rate;
        Debug.log.info(LogCategory.GAME, `연사속도 변경: ${rate}RPM`);
      },

      setMagazineSize: (size: number) => {
        this.config.magazineSize = size;
        Debug.log.info(LogCategory.GAME, `탄창 크기 변경: ${size}발`);
      },
    };
  }

  // ===== 정리 =====

  public destroy(): void {
    Debug.log.info(LogCategory.SCENE, "ShootingManager 정리 시작");

    // ShootingSystem 정리
    if (this.shootingSystem) {
      this.shootingSystem.destroy();
    }

    // UI 정리
    if (this.ui) {
      this.ui.ammoText?.destroy();
      this.ui.reloadText?.destroy();
    }

    // 총알 그래픽 정리
    this.ammoGraphics?.destroy();

    // 참조 정리
    this.player = undefined;
    this.onShotCallback = undefined;
    this.onReloadCallback = undefined;
    this.onHitCallback = undefined;

    Debug.log.info(LogCategory.SCENE, "ShootingManager 정리 완료");
  }
}

// src/game/player/Player.ts - CollisionSystem 연결 수정
import {
  CharacterPreset,
  CharacterColors,
  GfxRefs,
  KeyState,
  Platform,
  PlayerState,
  WallGrabState,
} from "../types/player.types";

import {
  createCharacter,
  destroyCharacter,
  setBodyColor,
} from "../render/character.core";
import { updatePose } from "../render/character.pose";
import { drawLimbs } from "../render/limbs";
import { getGunPosition as computeGunPos } from "../render/gun";

import { setupKeyboard, getKeyState, KeysHandle } from "../input/keyboard";
import { setupPointer, PointerHandle } from "../input/pointer";

import { applyGravity } from "../physics/gravity";
import { integrate, dampen } from "../physics/kinematics";
import { resolveCollisions, computePlayerBounds } from "../physics/collisions";

import {
  checkWallCollision,
  updateWallGrab,
  performWallJump,
} from "../mechanics/wallgrab";

import { canShoot, doShoot } from "../combat/shooting";

// 기존 config / Bullet 의존성은 유지
import { GAME_CONFIG, CHARACTER_PRESETS, GameUtils } from "../config";
import { Bullet } from "../bullet";

export default class Player {
  // Phaser scene
  private scene: any;

  // 그래픽 참조
  private gfx!: GfxRefs;

  // 위치/속도/상태
  private x: number;
  private y: number;
  private velocityX = 0;
  private velocityY = 0;

  private health = 100;
  private maxHealth = 100;

  private isGrounded = false;
  private isJumping = false;
  private isShooting = false;
  private facingDirection: "left" | "right" = "right";

  // 플랫폼
  private platforms: Platform[];

  // ⭐ CollisionSystem 참조 추가
  private collisionSystem?: any;

  // 벽잡기/벽점프 상태
  private wall: WallGrabState = {
    isWallGrabbing: false,
    wallGrabDirection: null,
    wallGrabTimer: 0,
    maxWallGrabTime: 2000,
    wallSlideSpeed: 50,
    wallJumpCooldown: 0,
  };
  private wallJumpForce = { x: 600, y: -650 };

  // 웅크리기
  private isCrouching = false;
  private crouchHeight = 0;
  private crouchTransitionSpeed = 0.15;
  private baseCrouchOffset = 20;

  // 애니메이션 파라미터
  private lastMovementState: "idle" | "walking" | "crouching" | "wallgrab" =
    "idle";
  private armSwing = 0;
  private legSwing = 0;
  private wobble = 0;
  private shootRecoil = 0;

  // 입력 핸들
  private keysHandle: KeysHandle | null = null;
  private pointerHandle: PointerHandle | null = null;

  // 마우스/총
  private mouseX = 0;
  private mouseY = 0;

  private lastShotTime = 0;
  private shootCooldown = 150;
  private bullets: Bullet[] = [];

  // 프리셋/색상
  private colorPreset: CharacterPreset = "기본";
  private colors: CharacterColors;

  // 무적
  private invulnerable = false;
  private invulnerabilityTimer = 0;

  constructor(
    scene: any,
    x: number,
    y: number,
    platforms: Platform[],
    preset: CharacterPreset = "기본"
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.platforms = platforms;

    this.colorPreset = preset;
    this.colors = (CHARACTER_PRESETS as any)[preset] as CharacterColors;

    // 그래픽 생성
    this.gfx = createCharacter(this.scene, this.x, this.y, this.colors);

    // 입력 초기화
    this.keysHandle = setupKeyboard(this.scene);

    // 포인터 (왼클릭 시 사격)
    this.pointerHandle = setupPointer(this.scene, {
      getCamera: () => this.scene.cameras?.main,
      onShoot: () => this.tryShoot(),
    });

    // 총알 리소스
    Bullet.preload(this.scene);

    // 초기 포즈 반영
    updatePose(this.gfx, {
      x: this.x,
      y: this.y,
      wobble: this.wobble,
      crouchHeight: this.crouchHeight,
      baseCrouchOffset: this.baseCrouchOffset,
      wallLean: 0,
      colors: this.colors,
      health: this.health,
      maxHealth: this.maxHealth,
      isWallGrabbing: this.wall.isWallGrabbing,
    });
  }

  // ⭐ CollisionSystem 설정 메서드 추가
  public setCollisionSystem(collisionSystem: any): void {
    this.collisionSystem = collisionSystem;
    console.log("✅ CollisionSystem이 Player에 연결되었습니다.");
  }

  // ========== 내부 유틸 ==========

  private readInputs(): KeyState {
    const k = getKeyState(this.keysHandle);
    // 포인터 좌표
    const pos = this.pointerHandle?.getPointer() ?? {
      x: this.mouseX,
      y: this.mouseY,
    };
    this.mouseX = pos.x;
    this.mouseY = pos.y;

    // 포인터 각도에 따라 바라보는 방향(벽잡기 중 아닐 때만)
    if (!this.wall.isWallGrabbing) {
      const deltaX = this.mouseX - this.x;
      this.facingDirection = deltaX < 0 ? "left" : "right";
    }

    return k;
  }

  private tryShoot() {
    const now = Date.now();
    if (!canShoot(this.lastShotTime, this.shootCooldown, now)) return;

    // ⭐ CollisionSystem 체크
    if (!this.collisionSystem) {
      console.warn(
        "❌ CollisionSystem이 연결되지 않았습니다. 총알이 플랫폼과 충돌하지 않을 수 있습니다."
      );
    }

    const { x: gunX, y: gunY, angle } = this.getGunPosition();

    const shot = doShoot({
      scene: this.scene,
      gunX,
      gunY,
      targetX: this.mouseX,
      targetY: this.mouseY,
      platforms: this.platforms,
      speed: 900,
      cooldownMs: this.shootCooldown,
      lastShotTime: this.lastShotTime,
      recoilBase: 1.5,
      wobbleBase: 0.3,
      collisionSystem: this.collisionSystem, // ⭐ CollisionSystem 전달
    });

    this.lastShotTime = shot.lastShotTime;
    this.shootRecoil += shot.recoilAdd;
    this.wobble += shot.wobbleAdd;
    this.isShooting = true;
    this.bullets.push(shot.bullet);

    // ⭐ 디버그 로그
    console.log(
      `🔫 총알 발사! 위치: (${gunX.toFixed(1)}, ${gunY.toFixed(
        1
      )}), CollisionSystem: ${this.collisionSystem ? "✅ 연결됨" : "❌ 미연결"}`
    );
  }

  private updateInvulnerability(deltaMs: number) {
    if (!this.invulnerable) {
      // 알파 원복
      this.gfx.body?.setAlpha?.(1);
      return;
    }
    this.invulnerabilityTimer -= deltaMs;
    if (this.invulnerabilityTimer <= 0) {
      this.invulnerable = false;
      this.invulnerabilityTimer = 0;
      this.gfx.body?.setAlpha?.(1);
      return;
    }
    const alpha = Math.sin(this.invulnerabilityTimer * 0.02) > 0 ? 1 : 0.5;
    this.gfx.body?.setAlpha?.(alpha);
  }

  private updateCrouch(key: KeyState) {
    // 벽잡기 중에는 웅크리기 불가
    if (key.crouch && this.isGrounded && !this.wall.isWallGrabbing) {
      this.isCrouching = true;
    } else {
      this.isCrouching = false;
    }

    // 부드러운 전환
    if (this.isCrouching) {
      this.crouchHeight = Math.min(
        1,
        this.crouchHeight + this.crouchTransitionSpeed
      );
    } else {
      this.crouchHeight = Math.max(
        0,
        this.crouchHeight - this.crouchTransitionSpeed
      );
    }
  }

  // ========== 메인 업데이트 루프 ==========

  update(deltaMs: number): PlayerState {
    const dt = deltaMs / 1000;

    // 1) 무적 처리
    this.updateInvulnerability(deltaMs);

    // 2) 입력 스냅샷
    const key = this.readInputs();

    // 3) 벽 상태 판단/갱신 (다른 처리보다 먼저)
    const bounds = computePlayerBounds(this.x, this.y, this.crouchHeight);
    const wallDir = checkWallCollision(bounds, this.platforms, this.velocityX);
    const wallStateIn = {
      ...this.wall,
      velocityX: this.velocityX,
      velocityY: this.velocityY,
      isGrounded: this.isGrounded,
    };
    const wallStateOut = updateWallGrab(wallStateIn, key, wallDir, deltaMs);
    this.wall = {
      isWallGrabbing: wallStateOut.isWallGrabbing,
      wallGrabDirection: wallStateOut.wallGrabDirection,
      wallGrabTimer: wallStateOut.wallGrabTimer,
      maxWallGrabTime: wallStateOut.maxWallGrabTime,
      wallSlideSpeed: wallStateOut.wallSlideSpeed,
      wallJumpCooldown: wallStateOut.wallJumpCooldown,
    };
    this.velocityX = wallStateOut.velocityX;
    this.velocityY = wallStateOut.velocityY;
    this.isGrounded = wallStateOut.isGrounded;

    // 4) 웅크리기
    this.updateCrouch(key);

    // 5) 좌우 이동/점프 (벽잡기 아닐 때만)
    if (!this.wall.isWallGrabbing) {
      const moveMul = this.isCrouching ? 0.5 : 1;

      if (key.left && !key.right) {
        this.velocityX = -GAME_CONFIG.playerSpeed * moveMul;
        this.legSwing += 0.3;
      } else if (key.right && !key.left) {
        this.velocityX = GAME_CONFIG.playerSpeed * moveMul;
        this.legSwing += 0.3;
      } else {
        this.velocityX = dampen(this.velocityX, 0.8, 10);
      }

      // 점프 (지상, not crouch)
      if (key.jump && this.isGrounded && !this.isJumping && !this.isCrouching) {
        this.velocityY = -GAME_CONFIG.jumpSpeed;
        this.isJumping = true;
        this.isGrounded = false;
        this.wobble += 1;
      }
    } else {
      // 벽점프 입력
      if (key.jump && this.wall.isWallGrabbing) {
        const jumped = performWallJump(
          {
            ...this.wall,
            velocityX: this.velocityX,
            velocityY: this.velocityY,
            isGrounded: this.isGrounded,
          },
          this.wallJumpForce,
          200
        );
        this.wall = {
          isWallGrabbing: jumped.isWallGrabbing,
          wallGrabDirection: jumped.wallGrabDirection,
          wallGrabTimer: jumped.wallGrabTimer,
          maxWallGrabTime: jumped.maxWallGrabTime,
          wallSlideSpeed: jumped.wallSlideSpeed,
          wallJumpCooldown: jumped.wallJumpCooldown,
        };
        this.velocityX = jumped.velocityX;
        this.velocityY = jumped.velocityY;
        this.isGrounded = jumped.isGrounded;

        this.isJumping = true;
        this.wobble += 2.0;
        this.shootRecoil += 1.0;

        // 연출(선택): 카메라 흔들기
        this.scene.cameras?.main?.shake?.(90, 0.006);
      }
    }

    // 6) 중력 (벽잡기면 updateWallGrab에서 제한됨)
    const gravityActive = !this.isGrounded && !this.wall.isWallGrabbing;
    this.velocityY = applyGravity(
      this.velocityY,
      dt,
      GAME_CONFIG.gravity,
      600,
      gravityActive
    );

    // 7) 적분
    const next = integrate(this.x, this.y, this.velocityX, this.velocityY, dt);
    this.x = next.x;
    this.y = next.y;

    // 8) 충돌 해결
    const resolver = resolveCollisions(
      this.x,
      this.y,
      this.velocityX,
      this.velocityY,
      this.platforms,
      this.crouchHeight,
      dt
    );
    this.x = resolver.x;
    this.y = resolver.y;
    this.velocityX = resolver.vx;
    this.velocityY = resolver.vy;

    const wasGrounded = this.isGrounded;
    this.isGrounded = resolver.isGrounded;

    if (!wasGrounded && this.isGrounded) {
      // 착지
      this.isJumping = false;
      // 벽잡기 해제
      if (this.wall.isWallGrabbing) {
        this.wall.isWallGrabbing = false;
        this.wall.wallGrabDirection = null;
        this.wall.wallGrabTimer = 0;
      }
      this.wobble += 0.5;
    }

    // 9) 애니메이션 파라미터
    this.armSwing += 0.1;

    if (this.wall.isWallGrabbing) {
      this.legSwing *= 0.9;
    } else if (!this.isCrouching && Math.abs(this.velocityX) > 10) {
      this.legSwing += 0.3;
    } else if (!this.isCrouching) {
      this.legSwing *= 0.9;
      if (Math.abs(this.legSwing) < 0.1) this.legSwing = 0;
    }

    this.wobble *= 0.95;
    this.shootRecoil *= 0.8;

    const now = Date.now();
    this.isShooting = now - this.lastShotTime < 200;

    // 10) 렌더링
    const wallLean = this.wall.isWallGrabbing
      ? this.wall.wallGrabDirection === "left"
        ? -3
        : 3
      : 0;

    updatePose(this.gfx, {
      x: this.x,
      y: this.y,
      wobble: this.wobble,
      crouchHeight: this.crouchHeight,
      baseCrouchOffset: this.baseCrouchOffset,
      wallLean,
      colors: this.colors,
      health: this.health,
      maxHealth: this.maxHealth,
      isWallGrabbing: this.wall.isWallGrabbing,
    });

    drawLimbs(this.gfx, {
      x: this.x,
      y: this.y,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      armSwing: this.armSwing,
      legSwing: this.legSwing,
      crouchHeight: this.crouchHeight,
      baseCrouchOffset: this.baseCrouchOffset,
      isWallGrabbing: this.wall.isWallGrabbing,
      wallGrabDirection: this.wall.wallGrabDirection,
      isGrounded: this.isGrounded,
      velocityX: this.velocityX,
      colors: this.colors,
      shootRecoil: this.shootRecoil,
      // 🆕 새로 추가된 파라미터들
      currentTime: Date.now() / 1000,
      currentFacing: this.facingDirection,
    });

    // 11) 탄환 정리
    this.bullets = this.bullets.filter((b) => b.active);

    // 낙하사망 리스폰
    if (this.y > 1200) this.respawn();

    return this.getState();
  }

  // ========== 공개 API (원래 Player.ts 호환) ==========

  public getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
  public getX(): number {
    return this.x;
  }
  public getY(): number {
    return this.y;
  }
  public getVelocity(): { x: number; y: number } {
    return { x: this.velocityX, y: this.velocityY };
  }

  public getState(): PlayerState & {
    isCrouching: boolean;
    isWallGrabbing: boolean;
    wallGrabDirection: "left" | "right" | null;
  } {
    return {
      position: { x: Math.round(this.x), y: Math.round(this.y) },
      velocity: {
        x: Math.round(this.velocityX),
        y: Math.round(this.velocityY),
      },
      health: this.health,
      isGrounded: this.isGrounded,
      isJumping: this.isJumping,
      isShooting: this.isShooting,
      facingDirection: this.facingDirection,
      // 확장
      isCrouching: this.isCrouching,
      isWallGrabbing: this.wall.isWallGrabbing,
      wallGrabDirection: this.wall.wallGrabDirection,
    } as any;
  }

  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    updatePose(this.gfx, {
      x: this.x,
      y: this.y,
      wobble: this.wobble,
      crouchHeight: this.crouchHeight,
      baseCrouchOffset: this.baseCrouchOffset,
      colors: this.colors,
      health: this.health,
      maxHealth: this.maxHealth,
      isWallGrabbing: this.wall.isWallGrabbing,
    });
  }
  public getBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
  } {
    const radius = 25;
    const heightReduction = this.crouchHeight * 10; // 원본 getBounds 로직과 일치
    const crouchYOffset = this.crouchHeight * 15;

    const width = 50;
    const height = 50 - heightReduction;

    const x = this.x - radius;
    const y = this.y - radius + crouchYOffset;

    return { x, y, width, height, radius };
  }

  public resetVelocity(): void {
    this.velocityX = 0;
    this.velocityY = 0;
    this.isGrounded = false;
    this.isJumping = false;
    // 벽잡기 리셋
    this.wall.isWallGrabbing = false;
    this.wall.wallGrabDirection = null;
    this.wall.wallGrabTimer = 0;
  }

  public updatePlatforms(platforms: Platform[]): void {
    this.platforms = platforms;
  }

  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.wobble += 0.3;
  }
  public setMaxHealth(maxHealth: number): void {
    this.maxHealth = maxHealth;
    this.health = Math.min(this.health, maxHealth);
  }
  public takeDamage(damage: number): void {
    if (this.invulnerable) return;
    this.health = Math.max(0, this.health - damage);
    this.wobble += 1;
    this.setInvulnerable(1000);
  }
  public getHealth(): number {
    return this.health;
  }
  public isAlive(): boolean {
    return this.health > 0;
  }
  public isInvulnerable(): boolean {
    return this.invulnerable;
  }
  public setInvulnerable(duration: number): void {
    this.invulnerable = true;
    this.invulnerabilityTimer = duration;
  }

  public setMapBounds(width: number, height: number): void {
    this.x = Math.max(25, Math.min(width - 25, this.x));
    if (this.y > height + 100) this.respawn();
  }

  public getBody(): any {
    return this.gfx.body;
  }

  public setColorPreset(preset: CharacterPreset): void {
    this.colorPreset = preset;
    this.colors = (CHARACTER_PRESETS as any)[preset] as CharacterColors;
    setBodyColor(this.gfx, this.colors.head);
    console.log(`캐릭터 색상이 '${preset}'으로 변경되었습니다.`);
  }
  public getCurrentPreset(): CharacterPreset {
    return this.colorPreset;
  }
  public getAvailablePresets(): CharacterPreset[] {
    return GameUtils.getAllPresets();
  }

  public getBullets(): Bullet[] {
    return this.bullets;
  }
  public clearBullets(): void {
    this.bullets.forEach((b) => b.destroy());
    this.bullets = [];
  }

  public setShootCooldown(cooldown: number): void {
    this.shootCooldown = cooldown;
  }
  public getShootCooldown(): number {
    return this.shootCooldown;
  }
  public canShoot(): boolean {
    return Date.now() - this.lastShotTime >= this.shootCooldown;
  }

  public isCrouchingState(): boolean {
    return this.isCrouching;
  }
  public getCrouchHeight(): number {
    return this.crouchHeight;
  }
  public setCrouchTransitionSpeed(speed: number): void {
    this.crouchTransitionSpeed = Math.max(0.01, Math.min(1, speed));
  }
  public forceCrouch(c: boolean): void {
    this.isCrouching = c;
  }

  public isWallGrabbingState(): boolean {
    return this.wall.isWallGrabbing;
  }
  public getWallGrabDirection(): "left" | "right" | null {
    return this.wall.wallGrabDirection;
  }
  public getWallGrabTimer(): number {
    return this.wall.wallGrabTimer;
  }
  public setWallGrabTime(time: number): void {
    this.wall.maxWallGrabTime = Math.max(500, time);
  }
  public setWallSlideSpeed(speed: number): void {
    this.wall.wallSlideSpeed = Math.max(10, Math.min(200, speed));
  }
  public setWallJumpForce(x: number, y: number): void {
    this.wallJumpForce.x = Math.max(200, Math.abs(x));
    this.wallJumpForce.y = -Math.max(200, Math.abs(y));
  }
  public getWallJumpForce(): { x: number; y: number } {
    return { ...this.wallJumpForce };
  }
  public setWallJumpCooldown(cooldown: number): void {
    this.wall.wallJumpCooldown = Math.max(0, cooldown);
  }
  public getWallJumpCooldown(): number {
    return this.wall.wallJumpCooldown;
  }
  public forceReleaseWall(): void {
    this.wall.isWallGrabbing = false;
    this.wall.wallGrabDirection = null;
    this.wall.wallGrabTimer = 0;
  }

  public getGunPosition(): { x: number; y: number; angle: number } {
    // render/gun 의 동일 로직 사용
    return computeGunPos({
      x: this.x,
      y: this.y,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      crouchHeight: this.crouchHeight,
      baseCrouchOffset: this.baseCrouchOffset,
    });
  }

  private respawn(): void {
    this.x = 150;
    this.y = 800;
    this.velocityX = 0;
    this.velocityY = 0;
    this.health = this.maxHealth;
    this.isGrounded = false;
    this.isJumping = false;
    this.isCrouching = false;
    this.crouchHeight = 0;
    this.wobble = 2;

    // 벽 상태 초기화
    this.wall.isWallGrabbing = false;
    this.wall.wallGrabDirection = null;
    this.wall.wallGrabTimer = 0;
    this.wall.wallJumpCooldown = 0;

    this.bullets.forEach((b) => b.destroy());
    this.bullets = [];
  }

  destroy(): void {
    // 포인터 핸들러 해제
    this.pointerHandle?.destroy?.();
    // 총알 정리
    this.bullets.forEach((b) => b.destroy());
    this.bullets = [];
    // 그래픽 제거
    destroyCharacter(this.gfx);
  }
}

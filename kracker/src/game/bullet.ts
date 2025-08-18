// src/game/bullet.ts - 총알 멈춤 문제 해결
import Phaser from "phaser";
import { GAME_CONFIG } from "./config";

// --------- 유틸: 로컬 오프셋 -> 월드 좌표 ----------
function toWorldPoint(
  go: Phaser.GameObjects.GameObject & {
    getWorldTransformMatrix?: any;
    displayOriginX?: number;
    displayOriginY?: number;
  },
  localX: number,
  localY: number,
  out: Phaser.Math.Vector2 = new Phaser.Math.Vector2()
) {
  const m = (go as any).getWorldTransformMatrix?.();
  if (!m) {
    const rot = (go as any).rotation ?? 0;
    const cos = Math.cos(rot),
      sin = Math.sin(rot);
    const ox = (go as any).x ?? 0,
      oy = (go as any).y ?? 0;
    out.x = ox + (localX * cos - localY * sin);
    out.y = oy + (localX * sin + localY * cos);
    return out;
  }
  const displayOriginX = (go as any).displayOriginX ?? 0;
  const displayOriginY = (go as any).displayOriginY ?? 0;
  return m.transformPoint(
    displayOriginX + localX,
    displayOriginY + localY,
    out
  );
}

// --------- config에서 총알 기본값 읽기 ----------
type BulletGlobalCfg = {
  speed?: number;
  gravityX?: number;
  gravityY?: number;
  useWorldGravity?: boolean;
  alignToVelocity?: boolean;
  tailEnabled?: boolean;
  radius?: number;
  diameter?: number;
};

function readBulletCfg(): BulletGlobalCfg {
  const cfg: any = GAME_CONFIG as any;
  return {
    speed: cfg?.bullet?.speed ?? cfg?.bulletSpeed ?? 1200,
    gravityX: cfg?.bullet?.gravityX ?? cfg?.bulletGravityX ?? 0,
    gravityY: cfg?.bullet?.gravityY ?? cfg?.bulletGravityY ?? 0,
    useWorldGravity:
      cfg?.bullet?.useWorldGravity ?? cfg?.bulletUseWorldGravity ?? false,
    alignToVelocity:
      cfg?.bullet?.alignToVelocity ?? cfg?.bulletAlignToVelocity ?? true,
    tailEnabled: cfg?.bullet?.tailEnabled ?? cfg?.bulletTailEnabled ?? true,
    radius: cfg?.bullet?.radius ?? cfg?.bulletRadius,
    diameter: cfg?.bullet?.diameter ?? cfg?.bulletDiameter,
  };
}

export type BulletOptions = {
  speed?: number;
  textureKey?: string;
  explosionTextureKey?: string;
  ttl?: number;

  // 물리/중력/정렬
  bodyRadius?: number;
  useWorldGravity?: boolean;
  gravityX?: number;
  gravityY?: number;
  alignToVelocity?: boolean;

  // 꼬리(테일) - 그라디언트 이미지
  tailEnabled?: boolean;
  visualScale?: number;

  // 몸통(원)
  bodyEnabled?: boolean;
  bodyVisualScale?: number;
  bodyColor?: number;
};

export class Bullet {
  readonly scene: Phaser.Scene;
  readonly sprite: Phaser.Physics.Arcade.Image;
  private alive = true;

  // 보이는 총알 요소들
  private tail?: Phaser.GameObjects.Image;
  private bodyCircle?: Phaser.GameObjects.Arc;
  private tailScaleX = 0.5;
  private tailAlpha = 0.95;
  private tailVisualScale = 1;
  private bodyVisualScale = 1;
  private bodyColor = 0xffffff;

  private explosionTex: string;
  private _alignToVelocity = true;

  // 사이즈 캐시
  private baseRadius = 10;
  // 그룹 참조
  private bulletGroup?: Phaser.Physics.Arcade.Group;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    angleOrLegacy?: any,
    opts: BulletOptions = {},
    bulletGroup?: Phaser.Physics.Arcade.Group
  ) {
    this.scene = scene;
    this.bulletGroup = bulletGroup;

    const gcfg = readBulletCfg();
    const speed = opts.speed ?? gcfg.speed ?? 1200;
    const bulletTex = opts.textureKey ?? "bullet";
    this.explosionTex = opts.explosionTextureKey ?? "particle";
    const ttl = opts.ttl ?? 2000;

    // 반지름 설정
    const radius =
      opts.bodyRadius ??
      gcfg.radius ??
      (gcfg.diameter ? gcfg.diameter / 2 : 10);
    this.baseRadius = radius;

    // 시각 배율/색상
    this.tailVisualScale = opts.visualScale ?? 1;
    this.bodyVisualScale = opts.bodyVisualScale ?? 1;
    this.bodyColor = opts.bodyColor ?? 0xffffff;

    const initialAngle = typeof angleOrLegacy === "number" ? angleOrLegacy : 0;

    // 1) 총알 본체(물리/충돌 전용) — 화면에선 숨김
    this.sprite = scene.physics.add.image(x, y, bulletTex);
    this.sprite.setOrigin(0.1, 0.1).setDepth(20).setRotation(initialAngle);
    this.sprite.setCircle(
      radius,
      this.sprite.width * 0.1 - radius,
      this.sprite.height * 0.1 - radius
    );
    this.sprite.setCollideWorldBounds(false);
    this.sprite.setVelocity(
      Math.cos(initialAngle) * speed,
      Math.sin(initialAngle) * speed
    );
    this.sprite.setVisible(false);

    // 그룹에 추가
    if (this.bulletGroup) {
      this.bulletGroup.add(this.sprite);
    }

    // 🔥 중력 설정 수정 - 기본적으로 월드 중력을 사용하지 않음
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const useWorld = opts.useWorldGravity ?? gcfg.useWorldGravity ?? false;
    const gx = opts.gravityX ?? gcfg.gravityX ?? 0;
    const gy = opts.gravityY ?? gcfg.gravityY ?? 300; // 🔥 기본 중력값 추가

    // 🔥 드래그와 바운스를 명확히 제거
    body.setDrag(0, 0);
    body.setBounce(0, 0);
    body.setImmovable(false); // 🔥 움직일 수 있도록 설정

    // 🔥 중력 설정 로직 개선
    if (useWorld) {
      body.setAllowGravity(true);
      console.log(`🌍 총알이 월드 중력 사용: ${scene.physics.world.gravity.y}`);
    } else if (gx !== 0 || gy !== 0) {
      body.setAllowGravity(true);
      body.setGravity(gx, gy);
      console.log(`🎯 총알 개별 중력 설정: (${gx}, ${gy})`);
    } else {
      // 🔥 기본적으로는 약간의 중력을 적용하여 자연스러운 포물선 궤적
      body.setAllowGravity(true);
      body.setGravity(0, 300); // 기본 중력
      console.log(`📉 총알 기본 중력 적용: (0, 300)`);
    }

    // 🔥 물리 바디가 올바르게 움직이는지 확인
    (body as any).moves = true;
    body.setSize(radius * 2, radius * 2);

    this._alignToVelocity =
      opts.alignToVelocity ?? gcfg.alignToVelocity ?? true;

    // 2) 꼬리(그라디언트 이미지)
    const tailEnabled = opts.tailEnabled ?? gcfg.tailEnabled ?? true;
    if (tailEnabled) {
      Bullet.ensureTailTexture(scene);
      this.tail = scene.add.image(x, y, "__bullet_tail");
      this.tail.setOrigin(0.5, 0.5);
      this.tail.setBlendMode(Phaser.BlendModes.ADD);
      this.tail.setDepth(this.sprite.depth - 1);
      this.tail.setAlpha(this.tailAlpha);
      this.tail.setScrollFactor(
        (this.sprite as any).scrollFactorX ?? 1,
        (this.sprite as any).scrollFactorY ?? 1
      );
    }

    // 3) 몸통(원형)
    const bodyEnabled = opts.bodyEnabled ?? true;
    if (bodyEnabled) {
      const circleR = Math.max(
        2,
        Math.floor(this.baseRadius * this.bodyVisualScale)
      );
      this.bodyCircle = scene.add.circle(x, y, circleR, this.bodyColor, 1);
      this.bodyCircle.setBlendMode(Phaser.BlendModes.ADD);
      this.bodyCircle.setDepth(this.sprite.depth);
      this.bodyCircle.setScrollFactor(
        (this.sprite as any).scrollFactorX ?? 1,
        (this.sprite as any).scrollFactorY ?? 1
      );
    }

    // 업데이트 루프 등록
    if (this.tail) {
      this.scene.events.on("update", this.syncTailAndBody, this);
    } else if (this.bodyCircle) {
      this.scene.events.on("update", this.syncBodyOnly, this);
    } else {
      this.scene.events.on("update", this.syncRotationOnly, this);
    }

    // TTL
    if (ttl > 0) {
      scene.time.delayedCall(ttl, () => this.destroy(false));
    }

    // 🔥 디버그 로그 추가
    console.log(
      `🚀 총알 생성: 위치(${x.toFixed(1)}, ${y.toFixed(
        1
      )}), 속도: ${speed}, 중력: (${gx}, ${gy}), 월드중력: ${useWorld}`
    );
  }

  // ----- 호환 API -----
  get active() {
    return this.alive;
  }

  fire(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2, speed = 1200) {
    const ang = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
    this.sprite.setPosition(from.x, from.y);
    this.sprite.setRotation(ang);

    // 🔥 속도 설정 시 디버그 로그 추가
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;

    console.log(
      `🎯 총알 발사: 각도 ${((ang * 180) / Math.PI).toFixed(
        1
      )}°, 속도벡터 (${vx.toFixed(1)}, ${vy.toFixed(1)})`
    );

    // 🔥 물리 바디 상태 확인
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    console.log(
      `⚙️ 물리 바디 상태: moves=${(body as any).moves}, allowGravity=${
        body.allowGravity
      }, gravity=(${body.gravity.x}, ${body.gravity.y})`
    );

    return this;
  }

  // ⭐ 충돌 시 호출되는 메서드
  hitAndExplode(contactX?: number, contactY?: number) {
    if (!this.alive) return;
    const ex = contactX ?? this.sprite.x;
    const ey = contactY ?? this.sprite.y;
    this.makeExplosion(ex, ey);
    this.destroy(true);
  }

  private makeExplosion(x: number, y: number) {
    const emitter: any = this.scene.add.particles(x, y, this.explosionTex, {
      speed: { min: 150, max: 380 },
      quantity: 28,
      lifespan: { min: 220, max: 420 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    emitter.explode(28, x, y);
    this.scene.time.delayedCall(350, () => emitter.destroy());
  }

  // ----- 동기화 루프 -----
  /** 꼬리 + 몸통 동시 동기화 */
  private syncTailAndBody() {
    if (!this.alive) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;

    // 🔥 바디가 없거나 속도가 0이면 디버그 로그
    if (!body) {
      console.warn("⚠️ 총알 바디가 없습니다!");
      return;
    }

    const speed = body.velocity.length();

    // 🔥 속도가 비정상적으로 낮으면 경고
    if (speed < 10) {
      console.warn(
        `⚠️ 총알 속도가 너무 낮습니다: ${speed.toFixed(
          2
        )}, 위치: (${this.sprite.x.toFixed(1)}, ${this.sprite.y.toFixed(1)})`
      );
      console.log(
        `   - 속도벡터: (${body.velocity.x.toFixed(
          2
        )}, ${body.velocity.y.toFixed(2)})`
      );
      console.log(
        `   - 중력설정: allowGravity=${body.allowGravity}, gravity=(${body.gravity.x}, ${body.gravity.y})`
      );
      console.log(`   - 드래그: (${body.drag.x}, ${body.drag.y})`);
    }

    // 진행 방향으로 회전
    if (this._alignToVelocity && body && (body.velocity.x || body.velocity.y)) {
      const ang = Math.atan2(body.velocity.y, body.velocity.x);
      this.sprite.setRotation(ang);
      if (this.tail) this.tail.setRotation(ang);
    } else if (this.tail) {
      this.tail.rotation = this.sprite.rotation;
    }

    // 위치 동기화
    if (this.tail) {
      this.tail.x = this.sprite.x;
      this.tail.y = this.sprite.y;
    }
    if (this.bodyCircle) {
      this.bodyCircle.x = this.sprite.x;
      this.bodyCircle.y = this.sprite.y;
    }

    // 꼬리 길이/두께 (속도 기반)
    if (this.tail) {
      const targetLen = Phaser.Math.Clamp((speed / 700) * 0.2, 0.1, 0.3);
      this.tailScaleX = Phaser.Math.Linear(this.tailScaleX, targetLen, 0.22);
      const scaleY = Phaser.Math.Clamp(0.38 + (speed / 1600) * 0.5, 0.38, 1.5);
      this.tail.setScale(this.tailScaleX, scaleY * this.tailVisualScale);
      this.tail.setAlpha(this.tailAlpha);
    }
  }

  /** 꼬리 없이 몸통만 동기화 */
  private syncBodyOnly() {
    if (!this.alive || !this.bodyCircle) return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;

    if (this._alignToVelocity && body && (body.velocity.x || body.velocity.y)) {
      const ang = Math.atan2(body.velocity.y, body.velocity.x);
      this.sprite.setRotation(ang);
    }

    this.bodyCircle.x = this.sprite.x;
    this.bodyCircle.y = this.sprite.y;
  }

  private syncRotationOnly() {
    if (!this.alive || !this._alignToVelocity) return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (body && (body.velocity.x || body.velocity.y)) {
      const ang = Math.atan2(body.velocity.y, body.velocity.x);
      this.sprite.setRotation(ang);
    }
  }

  // ⭐ destroy 메서드
  destroy(_silent = false) {
    if (!this.alive) return;
    this.alive = false;

    // 이벤트 리스너 제거
    this.scene.events.off("update", this.syncTailAndBody, this);
    this.scene.events.off("update", this.syncBodyOnly, this);
    this.scene.events.off("update", this.syncRotationOnly, this);

    // 시각 오브젝트 제거
    this.tail?.destroy();
    this.bodyCircle?.destroy();

    // 데이터 정리
    if (this.sprite) {
      try {
        if (typeof this.sprite.setData === "function") {
          this.sprite.setData("bullet", null);
        }
      } catch (error) {
        console.warn("Could not clear bullet data on destroy:", error);
      }
    }

    // 그룹에서 제거 후 스프라이트 제거
    if (this.bulletGroup && this.sprite) {
      try {
        this.bulletGroup.remove(this.sprite, true, true);
      } catch {
        this.sprite.destroy();
      }
    } else if (this.sprite) {
      this.sprite.destroy();
    }
  }

  // ⭐ 그룹 설정 메서드
  public setGroup(group: Phaser.Physics.Arcade.Group): void {
    if (this.bulletGroup) {
      this.bulletGroup.remove(this.sprite);
    }
    this.bulletGroup = group;
    group.add(this.sprite);
  }

  // 🔥 물리 바디 상태 확인 메서드 추가
  public debugPhysics(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    console.log(`🔍 총알 물리 디버그:`, {
      position: `(${this.sprite.x.toFixed(1)}, ${this.sprite.y.toFixed(1)})`,
      velocity: `(${body.velocity.x.toFixed(1)}, ${body.velocity.y.toFixed(
        1
      )})`,
      speed: body.velocity.length().toFixed(1),
      allowGravity: body.allowGravity,
      gravity: `(${body.gravity.x}, ${body.gravity.y})`,
      worldGravity: `(${this.scene.physics.world.gravity.x}, ${this.scene.physics.world.gravity.y})`,
      drag: `(${body.drag.x}, ${body.drag.y})`,
      bounce: `(${body.bounce.x}, ${body.bounce.y})`,
      moves: (body as any).moves,
      immovable: body.immovable,
    });
  }

  // ----- 리소스 생성 -----
  static preload(scene: Phaser.Scene) {
    // 충돌 바디용 원형 텍스처(안 보임)
    if (!scene.textures.exists("bullet")) {
      const cfg = readBulletCfg();
      const diameter = (cfg.diameter ?? (cfg.radius ? cfg.radius * 2 : 8)) | 0;
      const r = Math.max(1, Math.floor(diameter / 2));
      const g = scene.add.graphics({ x: 0, y: 0 }).setVisible(false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(r, r, r);
      g.generateTexture("bullet", diameter, diameter);
      g.destroy();
    }
    // 폭발 파티클용 점
    if (!scene.textures.exists("particle")) {
      const g = scene.add.graphics({ x: 0, y: 0 }).setVisible(false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(20, 20, 20);
      g.generateTexture("particle", 16, 16);
      g.destroy();
    }
    // 꼬리(테어드롭) 텍스처
    Bullet.ensureTailTexture(scene);
  }

  /** 테어드롭(그라디언트) 텍스처 생성 */
  static ensureTailTexture(scene: Phaser.Scene) {
    if (scene.textures.exists("__bullet_tail")) return;

    const w = 192,
      h = 48;
    const tex = scene.textures.createCanvas(
      "__bullet_tail",
      w,
      h
    ) as Phaser.Textures.CanvasTexture | null;

    const fallbackWithGraphics = () => {
      const g = scene.add.graphics({ x: 0, y: 0 }).setVisible(false);
      g.destroy();
    };

    if (!tex) {
      fallbackWithGraphics();
      return;
    }

    const ctx = tex.getContext();
    if (!ctx) {
      scene.textures.remove("__bullet_tail");
      fallbackWithGraphics();
      return;
    }

    ctx.clearRect(0, 0, w, h);

    const headX = Math.floor(w * 0.5),
      headY = h / 2;
    const tailX = Math.floor(w * 0.005),
      tailY = h / 2;
    const half = Math.floor(h * 0.22);

    // 실루엣
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.quadraticCurveTo(w * 0.5, tailY - half * 0.9, headX, headY);
    ctx.quadraticCurveTo(w * 0.5, tailY + half * 0.9, tailX, tailY);
    ctx.closePath();

    const lg = ctx.createLinearGradient(tailX, tailY, headX, headY);
    lg.addColorStop(0.0, "rgba(255,180,0,0.00)");
    lg.addColorStop(0.35, "rgba(255,180,0,0.45)");
    lg.addColorStop(0.75, "rgba(255,200,40,0.85)");
    lg.addColorStop(1.0, "rgba(255,255,255,1.00)");
    ctx.fillStyle = lg;
    ctx.fill();

    // 머리 코어(래디얼)
    const rg = ctx.createRadialGradient(headX, headY, 2, headX, headY, 16);
    rg.addColorStop(0.0, "rgba(255,255,255,1.0)");
    rg.addColorStop(0.5, "rgba(255,220,80,0.9)");
    rg.addColorStop(1.0, "rgba(255,180,0,0.0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(headX, headY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 코어 라인
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.quadraticCurveTo(w * 0.2, tailY, headX, headY);
    ctx.stroke();

    tex.refresh();
  }

  // ----- 유틸 -----
  static fireFromMuzzle(
    scene: Phaser.Scene,
    gun: Phaser.GameObjects.GameObject & { rotation?: number },
    muzzleOffset: Phaser.Math.Vector2,
    options: BulletOptions & { angleAdjustDeg?: number } = {},
    bulletGroup?: Phaser.Physics.Arcade.Group
  ) {
    const world = toWorldPoint(gun as any, muzzleOffset.x, muzzleOffset.y);
    const angleRad =
      (gun.rotation ?? 0) +
      Phaser.Math.DEG_TO_RAD * (options.angleAdjustDeg ?? 0);
    return new Bullet(scene, world.x, world.y, angleRad, options, bulletGroup);
  }

  static explodeMuzzle(
    scene: Phaser.Scene,
    x: number,
    y: number,
    _angleRad = 0,
    textureKey = "particle"
  ) {
    const emitter: any = scene.add.particles(x, y, textureKey, {
      speed: { min: 80, max: 220 },
      quantity: 12,
      lifespan: { min: 120, max: 180 },
      angle: { min: -25, max: 25 },
      scale: { start: 1.1, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    emitter.explode(12, x, y);
    scene.time.delayedCall(120, () => emitter.destroy());
  }
}

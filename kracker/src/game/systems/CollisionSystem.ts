// src/game/systems/CollisionSystem.ts - 총알과 플랫폼 충돌 관리 (수정됨)
import { Bullet } from "../bullet";
import Rectangle = Phaser.Geom.Rectangle;
import Line = Phaser.Geom.Line;
import Intersects = Phaser.Geom.Intersects;

export class CollisionSystem {
  private scene: Phaser.Scene;
  private bulletGroup: Phaser.Physics.Arcade.Group;
  private platformGroup: Phaser.Physics.Arcade.StaticGroup;
  private collider?: Phaser.Physics.Arcade.Collider;
  private _ccdLine: Phaser.Geom.Line = new Line();
  private _rect: Phaser.Geom.Rectangle = new Rectangle();

  constructor(
    scene: Phaser.Scene,
    bulletGroup: Phaser.Physics.Arcade.Group,
    platformGroup: Phaser.Physics.Arcade.StaticGroup
  ) {
    this.scene = scene;
    this.bulletGroup = bulletGroup;
    this.platformGroup = platformGroup;
    this.scene.events.on("update", this._ccdSweep, this);
    this.setupCollisions();
  }
  private _ccdSweep() {
    const bullets =
      this.bulletGroup.getChildren() as Phaser.Physics.Arcade.Image[];
    if (!bullets.length) return;

    const platforms = this.platformGroup.getChildren();
    if (!platforms.length) return;

    for (const b of bullets) {
      if (!b.active || !b.body) continue;

      const body = b.body as Phaser.Physics.Arcade.Body;

      // 💬 속도 디버그 로그
      const velocity = body.velocity;
      const speed = velocity.length();
      console.debug(
        `[총알 디버그] 위치 (${b.x.toFixed(1)}, ${b.y.toFixed(
          1
        )}), 속도: ${speed.toFixed(2)}`
      );

      // ⚠️ 속도 0이면 무의미한 총알 → 제거
      if (speed < 1) {
        console.warn(
          `⚠️ 정지된 총알 제거됨: 위치 (${b.x.toFixed(1)}, ${b.y.toFixed(1)})`
        );
        b.destroy();
        continue;
      }

      const prevX = (b as any).data?.get?.("__prevX") ?? b.x;
      const prevY = (b as any).data?.get?.("__prevY") ?? b.y;
      const curX = b.x;
      const curY = b.y;

      // 🛑 위치가 안 바뀐 총알 → 패스
      if (prevX === curX && prevY === curY) {
        (b as any).setData?.("__prevX", curX);
        (b as any).setData?.("__prevY", curY);
        continue;
      }

      this._ccdLine.setTo(prevX, prevY, curX, curY);

      let hitFound = false;
      for (const p of platforms) {
        const body = (p as any).body as
          | Phaser.Physics.Arcade.StaticBody
          | undefined;
        if (!body) continue;

        this._rect.setTo(
          body.left,
          body.top,
          body.right - body.left,
          body.bottom - body.top
        );

        if (Intersects.LineToRectangle(this._ccdLine, this._rect)) {
          this.onBulletHitPlatform(b, p);
          hitFound = true;
          break;
        }
      }

      if (!hitFound) {
        (b as any).setData?.("__prevX", curX);
        (b as any).setData?.("__prevY", curY);
      }
    }
  }

  /** 충돌 감지 설정 */
  private setupCollisions(): void {
    // ⭐ 타입 수정: 정확한 콜백 시그니처 사용
    this.collider = this.scene.physics.add.collider(
      this.bulletGroup,
      this.platformGroup,
      (object1, object2) => {
        // object1이 총알, object2가 플랫폼일 수도 있고 그 반대일 수도 있음
        let bulletSprite: Phaser.Physics.Arcade.Image | undefined;
        let platformSprite: Phaser.GameObjects.GameObject | undefined;

        // 어느 것이 총알인지 확인
        if (
          object1 instanceof Phaser.Physics.Arcade.Image &&
          this.bulletGroup.contains(object1)
        ) {
          bulletSprite = object1;
          platformSprite = object2 as Phaser.GameObjects.GameObject;
        } else if (
          object2 instanceof Phaser.Physics.Arcade.Image &&
          this.bulletGroup.contains(object2)
        ) {
          bulletSprite = object2;
          platformSprite = object1 as Phaser.GameObjects.GameObject;
        }

        if (bulletSprite && platformSprite) {
          this.onBulletHitPlatform(bulletSprite, platformSprite);
        }
      },
      undefined, // processCallback
      this // 콜백 컨텍스트
    );

    console.log("🎯 Collision system initialized: bullets vs platforms");
  }

  /** 총알이 플랫폼에 부딪혔을 때 호출되는 콜백 */
  private onBulletHitPlatform = (
    bulletSprite: Phaser.Physics.Arcade.Image,
    platformSprite: Phaser.GameObjects.GameObject
  ): void => {
    // 총알 스프라이트에서 Bullet 인스턴스 찾기
    const bullet = this.findBulletBySprite(bulletSprite);

    if (bullet) {
      console.log(
        `💥 Bullet hit platform at (${bulletSprite.x.toFixed(
          1
        )}, ${bulletSprite.y.toFixed(1)})`
      );

      // 충돌 지점에서 폭발 효과와 함께 총알 제거
      bullet.hitAndExplode(bulletSprite.x, bulletSprite.y);
    } else {
      console.warn(
        "⚠️ Could not find bullet instance for sprite:",
        bulletSprite
      );

      // 안전장치: 스프라이트만이라도 제거
      if (bulletSprite && bulletSprite.scene) {
        bulletSprite.destroy();
      }
    }
  };

  /** ⭐ 스프라이트로부터 Bullet 인스턴스 찾기 (타입 안전) */
  private findBulletBySprite(
    sprite: Phaser.Physics.Arcade.Image
  ): Bullet | null {
    try {
      // ⭐ getData 메서드 사용 (removeData 대신)
      const bulletInstance = sprite.getData("bullet") as Bullet;

      if (bulletInstance && bulletInstance.active) {
        return bulletInstance;
      }

      // 폴백: 이미 destroy된 bullet이거나 데이터가 없는 경우
      console.warn("No valid bullet data found on sprite");
      return null;
    } catch (error) {
      console.warn("Error retrieving bullet data:", error);
      return null;
    }
  }

  /** 총알 그룹에 새 총알 추가 */
  public addBullet(bullet: Bullet): void {
    if (!bullet?.sprite) return;

    bullet.sprite.setData("bullet", bullet);

    if (!this.bulletGroup.contains(bullet.sprite)) {
      this.bulletGroup.add(bullet.sprite);
    }

    // 동적 바디 보증
    const body = bullet.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true); // ✅ 중력 허용으로 변경
    body.setImmovable(false);
    body.setDrag(0, 0); // ✅ 드래그 명시적으로 0 설정
    body.setBounce(0, 0); // ✅ 바운스도 0으로
    (body as any).moves = true;
  }

  /** 총알 그룹에서 총알 제거 */
  public removeBullet(bullet: Bullet): void {
    if (bullet.sprite && this.bulletGroup.contains(bullet.sprite)) {
      // ⭐ 데이터 정리 (removeData 메서드가 없을 수 있으므로 안전하게)
      try {
        if (typeof bullet.sprite.setData === "function") {
          bullet.sprite.setData("bullet", null);
        }
      } catch (error) {
        console.warn("Could not clear bullet data:", error);
      }

      // 그룹에서 제거
      this.bulletGroup.remove(bullet.sprite, true, true);

      console.log(
        `🗑️ Removed bullet from collision system (remaining: ${this.bulletGroup.children.size})`
      );
    }
  }

  /** 모든 총알 제거 */
  public clearAllBullets(): void {
    // 모든 총알의 데이터 정리
    this.bulletGroup.children.entries.forEach((sprite) => {
      if (sprite instanceof Phaser.Physics.Arcade.Image) {
        const bullet = sprite.getData("bullet") as Bullet;
        if (bullet) {
          bullet.destroy();
        } else {
          sprite.destroy();
        }
      }
    });

    this.bulletGroup.clear(true, true);
    console.log("🧹 Cleared all bullets from collision system");
  }

  /** 충돌 시스템 활성화/비활성화 */
  public setEnabled(enabled: boolean): void {
    if (this.collider) {
      this.collider.active = enabled;
      console.log(`🎯 Collision system ${enabled ? "enabled" : "disabled"}`);
    }
  }

  /** 디버그 정보 */
  public getDebugInfo(): {
    bulletCount: number;
    platformCount: number;
    colliderActive: boolean;
  } {
    return {
      bulletCount: this.bulletGroup.children.size,
      platformCount: this.platformGroup.children.size,
      colliderActive: this.collider?.active ?? false,
    };
  }

  /** 충돌 시스템 정리 */
  public destroy(): void {
    console.log("🧽 Destroying collision system...");

    // 모든 총알 정리
    this.clearAllBullets();

    // 충돌 감지 제거
    if (this.collider) {
      this.collider.destroy();
      this.collider = undefined;
    }
    this.scene.events.off("update", this._ccdSweep, this);

    console.log("✅ Collision system destroyed");
  }
}

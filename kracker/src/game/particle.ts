// src/game/particle.ts
import Phaser from "phaser";

export class ParticleSystem {
  readonly scene: Phaser.Scene;
  private isEnabled: boolean = true;
  private texturesInitialized: boolean = false;

  constructor(scene: Phaser.Scene, enableMouseListener: boolean = true) {
    this.scene = scene;
    if (enableMouseListener) {
      this.setupMouseListener();
    }
  }

  // 활성화/비활성화
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  // 씬 유효성 검사 헬퍼 함수
  private isSceneValid(): boolean {
    const sys = (this.scene as any)?.sys;
    return !!(
      (
        this.scene &&
        this.scene.textures &&
        this.scene.time &&
        sys &&
        sys.isActive() &&
        sys.displayList && // ✅ 추가
        sys.updateList
      ) // ✅ 추가
    );
  }

  private setupMouseListener() {
    // 마우스 클릭 이벤트 리스너
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isEnabled) {
        this.createParticleExplosion(pointer.worldX, pointer.worldY);
      }
    });
  }

  // 메인 파티클 생성 함수
  createParticleExplosion(x: number, y: number) {
    // 씬 유효성 검사
    if (!this.isSceneValid()) {
      console.warn(
        "ParticleSystem: 씬이 유효하지 않아 파티클 생성을 건너뜁니다."
      );
      return;
    }

    if (!this.ensureParticleTexture()) {
      console.warn("ParticleSystem: 파티클 텍스처 생성 실패");
      return;
    }

    try {
      const emitter = this.scene.add.particles(x, y, "particle_circle", {
        // 한 번에 여러 개 뿌리기
        quantity: { min: 1, max: 2 },

        // 속도 (멀리 튀는 애 + 가까이 있는 애)
        speed: { min: 10, max: 100 },
        angle: { min: 90, max: 180 },

        // 중력 (밑으로 빨려 내려감)
        gravityY: -100,

        // 생존 시간
        lifespan: { min: 400, max: 700 },

        // 크기 → 큰 거 + 작은 거 섞임
        scale: { start: 2, end: 0 },

        // 투명도 → 서서히 사라짐
        alpha: { start: 1, end: 0 },

        // 회전은 필요 없음 (원형이라 의미X)
        rotate: 0,

        // 한 번만 발사
        emitting: false,
      });

      // 💥 폭발 실행
      emitter.explode(Phaser.Math.Between(8, 15));

      // 2초 뒤 정리
      this.scene.time.delayedCall(1500, () => {
        if (emitter && emitter.active) {
          emitter.destroy();
        }
      });
    } catch (error) {
      console.warn("ParticleSystem: 파티클 생성 실패:", error);
    }
  }

  createJumpParticle(x: number, y: number) {
    if (!this.isSceneValid()) {
      console.warn(
        "ParticleSystem: 씬이 유효하지 않아 점프 파티클 생성을 건너뜁니다."
      );
      return;
    }

    if (!this.ensureParticleTexture()) return;

    try {
      const emitter = this.scene.add.particles(x, y, "particle_circle", {
        quantity: { min: 1, max: 1 },
        speed: { min: 10, max: 100 },
        angle: { min: 240, max: 360 },
        gravityY: -100,
        lifespan: { min: 400, max: 700 },
        scale: { start: 2, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: 0,
        emitting: false,
      });

      emitter.explode(Phaser.Math.Between(8, 15));

      this.scene.time.delayedCall(1500, () => {
        if (emitter && emitter.active) {
          emitter.destroy();
        }
      });
    } catch (error) {
      console.warn("ParticleSystem: 점프 파티클 생성 실패:", error);
    }
  }

  createWallLeftJumpParticle(x: number, y: number) {
    if (!this.isSceneValid()) return;
    if (!this.ensureParticleTexture()) return;

    try {
      const emitter = this.scene.add.particles(x, y, "particle_circle", {
        quantity: { min: 1, max: 2 },
        speed: { min: 10, max: 100 },
        angle: { min: 90, max: 180 },
        gravityY: -100,
        lifespan: { min: 400, max: 700 },
        scale: { start: 2, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: 0,
        emitting: false,
      });

      emitter.explode(Phaser.Math.Between(8, 15));

      this.scene.time.delayedCall(1500, () => {
        if (emitter && emitter.active) {
          emitter.destroy();
        }
      });
    } catch (error) {
      console.warn("ParticleSystem: 벽 점프 파티클 생성 실패:", error);
    }
  }

  createWallRightJumpParticle(x: number, y: number) {
    if (!this.isSceneValid()) return;
    if (!this.ensureParticleTexture()) return;

    try {
      const emitter = this.scene.add.particles(x, y, "particle_circle", {
        quantity: { min: 1, max: 2 },
        speed: { min: 10, max: 100 },
        angle: { min: 270, max: 360 },
        gravityY: -100,
        lifespan: { min: 400, max: 700 },
        scale: { start: 2, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: 0,
        emitting: false,
      });

      emitter.explode(Phaser.Math.Between(8, 15));

      this.scene.time.delayedCall(1500, () => {
        if (emitter && emitter.active) {
          emitter.destroy();
        }
      });
    } catch (error) {
      console.warn("ParticleSystem: 벽 점프 파티클 생성 실패:", error);
    }
  }

  // 사각형 파티클 텍스처 생성 (반환값을 boolean으로 변경)
  // 사각형/원형 파티클 텍스처 생성 (디스플레이리스트를 건드리지 않도록 변경)
  private ensureParticleTexture(): boolean {
    if (!this.isSceneValid()) {
      console.warn("ParticleSystem: 씬이 유효하지 않음");
      return false;
    }

    try {
      // ✅ displayList에 올리지 않고 오프스크린으로 사용
      const graphics = this.scene.make.graphics({ x: 0, y: 0 });

      // 원형 텍스처들
      const circleRadii = [2, 3, 4, 5];
      for (let i = 0; i < circleRadii.length; i++) {
        const radius = circleRadii[i];
        graphics.clear();
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(radius, radius, radius);
        graphics.generateTexture(
          `particle_circle_${i}`,
          radius * 2,
          radius * 2
        );
      }

      // 기본 원형
      graphics.clear();
      graphics.fillStyle(0xee9841, 1);
      graphics.fillCircle(5, 5, 5);
      graphics.generateTexture("particle_circle", 10, 10);

      // 사각형
      graphics.clear();
      graphics.fillStyle(0xff6644, 1);
      graphics.fillRect(0, 0, 8, 8);
      graphics.generateTexture("particle_rect", 8, 8);

      graphics.destroy(); // 리소스 정리
      this.texturesInitialized = true;
      return true;
    } catch (error) {
      // ❗ 스택 폭탄 방지: 메시지만 남기고 error 객체는 붙이지 않음
      console.warn("ParticleSystem: 텍스처 생성 실패 (make.graphics)");
      this.texturesInitialized = true; // 반복 시도 방지
      return false;
    }
  }

  // 더 화려한 파티클 (다양한 크기와 색상)
  createFancyParticleExplosion(x: number, y: number) {
    if (!this.isSceneValid()) return;
    if (!this.ensureParticleTexture()) return;

    try {
      // 큰 파티클들
      const bigEmitter = this.scene.add.particles(x, y, "particle_rect", {
        quantity: { min: 8, max: 15 },
        speed: { min: 150, max: 350 },
        angle: { min: 0, max: 360 },
        gravityY: 400,
        lifespan: { min: 1000, max: 1800 },
        scale: { start: 0.8, end: 0.2 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -180, max: 180 },
        emitting: false,
      });

      // 작은 파티클들 (더 많이)
      const smallEmitter = this.scene.add.particles(x, y, "particle_rect", {
        quantity: { min: 20, max: 35 },
        speed: { min: 80, max: 250 },
        angle: { min: 0, max: 360 },
        gravityY: 200,
        lifespan: { min: 600, max: 1200 },
        scale: { start: 0.4, end: 0.05 },
        alpha: { start: 0.9, end: 0 },
        emitting: false,
      });

      bigEmitter.explode();
      smallEmitter.explode();

      this.scene.time.delayedCall(2500, () => {
        if (bigEmitter && bigEmitter.active) {
          bigEmitter.destroy();
        }
        if (smallEmitter && smallEmitter.active) {
          smallEmitter.destroy();
        }
      });
    } catch (error) {
      console.warn("ParticleSystem: 화려한 파티클 생성 실패:", error);
    }
  }

  // 정적 메소드로 프리로드
  static preload(scene: Phaser.Scene) {
    // 필요한 경우 여기서 텍스처 미리 로드
  }

  // 파티클 시스템 정리
  destroy() {
    this.isEnabled = false;
    this.texturesInitialized = false;
    // 이벤트 리스너 정리는 씬에서 자동으로 처리됨
  }
}

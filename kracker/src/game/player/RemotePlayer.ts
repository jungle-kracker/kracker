// src/game/particle.ts - destroy 메서드 추가
import Phaser from "phaser";

export class ParticleSystem {
  readonly scene: Phaser.Scene;
  private isEnabled: boolean = true;
  private activeEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []; // ☆ 활성 이미터 추적

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

  // ☆ destroy 메서드 추가
  destroy(): void {
    // 모든 활성 이미터들 정리
    this.activeEmitters.forEach((emitter) => {
      if (emitter && !emitter.destroy) {
        try {
          emitter.destroy();
        } catch (error) {
          console.warn("ParticleSystem: 이미터 제거 중 오류:", error);
        }
      }
    });

    // 배열 초기화
    this.activeEmitters = [];

    // 마우스 이벤트 리스너 제거
    if (this.scene && this.scene.input) {
      this.scene.input.removeAllListeners();
    }

    console.log("ParticleSystem destroyed");
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
    this.ensureParticleTexture(); // circle 텍스처 포함해둔 상태

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

    // ☆ 활성 이미터 목록에 추가
    this.activeEmitters.push(emitter);

    // 💥 폭발 실행
    emitter.explode(Phaser.Math.Between(8, 15));

    // 2초 뒤 정리
    this.scene.time.delayedCall(1500, () => {
      // ☆ 목록에서 제거
      const index = this.activeEmitters.indexOf(emitter);
      if (index > -1) {
        this.activeEmitters.splice(index, 1);
      }
      emitter.destroy();
    });
  }

  createJumpParticle(x: number, y: number) {
    this.ensureParticleTexture(); // circle 텍스처 포함해둔 상태

    const emitter = this.scene.add.particles(x, y, "particle_circle", {
      // 한 번에 여러 개 뿌리기
      quantity: { min: 1, max: 1 },

      // 속도 (멀리 튀는 애 + 가까이 있는 애)
      speed: { min: 10, max: 100 },
      angle: { min: 240, max: 360 },

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

    // ☆ 활성 이미터 목록에 추가
    this.activeEmitters.push(emitter);

    // 💥 폭발 실행
    emitter.explode(Phaser.Math.Between(8, 15));

    // 2초 뒤 정리
    this.scene.time.delayedCall(1500, () => {
      const index = this.activeEmitters.indexOf(emitter);
      if (index > -1) {
        this.activeEmitters.splice(index, 1);
      }
      emitter.destroy();
    });
  }

  createWallLeftJumpParticle(x: number, y: number) {
    this.ensureParticleTexture(); // circle 텍스처 포함해둔 상태

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

    // ☆ 활성 이미터 목록에 추가
    this.activeEmitters.push(emitter);

    // 💥 폭발 실행
    emitter.explode(Phaser.Math.Between(8, 15));

    // 2초 뒤 정리
    this.scene.time.delayedCall(1500, () => {
      const index = this.activeEmitters.indexOf(emitter);
      if (index > -1) {
        this.activeEmitters.splice(index, 1);
      }
      emitter.destroy();
    });
  }

  createWallRightJumpParticle(x: number, y: number) {
    this.ensureParticleTexture(); // circle 텍스처 포함해둔 상태

    const emitter = this.scene.add.particles(x, y, "particle_circle", {
      // 한 번에 여러 개 뿌리기
      quantity: { min: 1, max: 2 },

      // 속도 (멀리 튀는 애 + 가까이 있는 애)
      speed: { min: 10, max: 100 },
      angle: { min: 270, max: 360 },

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

    // ☆ 활성 이미터 목록에 추가
    this.activeEmitters.push(emitter);

    // 💥 폭발 실행
    emitter.explode(Phaser.Math.Between(8, 15));

    // 2초 뒤 정리
    this.scene.time.delayedCall(1500, () => {
      const index = this.activeEmitters.indexOf(emitter);
      if (index > -1) {
        this.activeEmitters.splice(index, 1);
      }
      emitter.destroy();
    });
  }

  // 사각형 파티클 텍스처 생성
  private ensureParticleTexture() {
    // 이미 circle 텍스처가 있으면 다시 안만듦
    if (this.scene.textures.exists("particle_circle")) return;

    const graphics = this.scene.add.graphics().setVisible(false);

    // 여러 색상의 원 파티클 생성
    const colors = [0xff4444, 0xff8844, 0xffaa44, 0xffdd44];
    const radius = 3;

    for (let i = 0; i < colors.length; i++) {
      graphics.clear();
      graphics.fillStyle(colors[i], 1);
      graphics.fillCircle(radius, radius, radius); // 원 그리기
      graphics.generateTexture(`particle_circle_${i}`, radius * 2, radius * 2);
    }

    // 기본 파티클 (랜덤색상용)
    graphics.clear();
    graphics.fillStyle(0xee9841, 1);
    graphics.fillCircle(5, 5, 5);
    graphics.generateTexture("particle_circle", 10, 10);

    // 사각형 파티클도 생성
    graphics.clear();
    graphics.fillStyle(0xff6644, 1);
    graphics.fillRect(0, 0, 8, 8);
    graphics.generateTexture("particle_rect", 8, 8);

    graphics.destroy();
  }

  // 더 화려한 파티클 (다양한 크기와 색상)
  createFancyParticleExplosion(x: number, y: number) {
    this.ensureParticleTexture();

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

    // ☆ 활성 이미터 목록에 추가
    this.activeEmitters.push(bigEmitter, smallEmitter);

    bigEmitter.explode();
    smallEmitter.explode();

    this.scene.time.delayedCall(2500, () => {
      // ☆ 목록에서 제거
      const bigIndex = this.activeEmitters.indexOf(bigEmitter);
      if (bigIndex > -1) {
        this.activeEmitters.splice(bigIndex, 1);
      }
      const smallIndex = this.activeEmitters.indexOf(smallEmitter);
      if (smallIndex > -1) {
        this.activeEmitters.splice(smallIndex, 1);
      }

      bigEmitter.destroy();
      smallEmitter.destroy();
    });
  }

  // 정적 메소드로 프리로드
  static preload(scene: Phaser.Scene) {
    // 필요한 경우 여기서 텍스처 미리 로드
  }
}

// 사용법 예시:
// const particleSystem = new ParticleSystem(this);
//
// 또는 직접 호출:
// particleSystem.createParticleExplosion(100, 100);
// particleSystem.createFancyParticleExplosion(200, 200);
//
// 정리할 때:
// particleSystem.destroy();

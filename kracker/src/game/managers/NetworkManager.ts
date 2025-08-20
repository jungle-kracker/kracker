// src/game/managers/NetworkManager.ts - 실시간 멀티플레이어 동기화
import { socket } from "../../lib/socket";

// 타입 정의
interface PlayerMovement {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: "left" | "right";
  isGrounded: boolean;
  isJumping: boolean;
  isCrouching: boolean;
  isWallGrabbing: boolean;
  health?: number; // 체력은 선택적으로 (healthUpdate 이벤트에서만 관리)
}

interface ShootData {
  x: number;
  y: number;
  angle: number;
  gunX: number;
  gunY: number;
}

interface BulletHit {
  bulletId: string;
  targetPlayerId?: string;
  x: number;
  y: number;
  damage: number;
}

interface GameEvent {
  type: "damage" | "heal" | "respawn" | "powerup" | "showHealthBar";
  playerId: string;
  data: any;
}

export class NetworkManager {
  private scene: any;
  private myPlayerId: string | null = null;
  private roomId: string | null = null;
  private isConnected: boolean = false;

  // 네트워크 최적화
  private lastSentMovement: PlayerMovement | null = null;
  private movementThreshold = 5; // 5픽셀 이상 움직여야 전송
  private maxUpdateRate = 1000 / 20; // 20fps로 제한
  private lastMovementSent = 0;

  // 이벤트 핸들러들
  private onPlayerMoveCallback?: (
    playerId: string,
    data: PlayerMovement
  ) => void;
  private onPlayerShootCallback?: (playerId: string, data: ShootData) => void;
  private onBulletHitCallback?: (data: BulletHit) => void;
  private onGameEventCallback?: (event: GameEvent) => void;
  private onPlayerJoinCallback?: (playerData: any) => void;
  private onPlayerLeaveCallback?: (playerId: string) => void;
  private onPoseCallback?: (playerId: string, pose: any) => void;
  private onParticleCallback?: (particleData: any) => void;
  private lastPoseSentAt = 0;
  private lastPoseCache?: any;
  private onHealthUpdateCallback?: (data: any) => void;
  private onAugmentSnapshotCallback?: (data: any) => void;

  constructor(scene: any) {
    this.scene = scene;
    this.setupSocketListeners();
  }

  // 초기화
  public initialize(roomId: string, myPlayerId: string): void {
    console.log(
      `🌐 NetworkManager 초기화: 방 ${roomId}, 플레이어 ${myPlayerId}`
    );

    this.roomId = roomId;
    this.myPlayerId = myPlayerId;
    this.isConnected = socket.connected;

    // 소켓 연결 상태 확인
    if (!this.isConnected) {
      console.warn("⚠️ 소켓이 연결되지 않았습니다. 재연결을 시도합니다.");
      socket.connect();
    }

    // 게임 룸 입장 알림
    this.joinGameRoom();
  }

  // 게임 룸 입장
  private joinGameRoom(): void {
    if (!this.roomId) return;

    socket.emit(
      "game:join",
      {
        roomId: this.roomId,
        playerId: this.myPlayerId,
      },
      (response: any) => {
        if (response?.ok) {
          console.log("✅ 게임 룸 입장 성공");
          this.isConnected = true;
        } else {
          console.error("❌ 게임 룸 입장 실패:", response?.error);
        }
      }
    );
  }

  // 소켓 이벤트 리스너 설정
  private setupSocketListeners(): void {
    // 연결 상태 관리
    socket.on("connect", () => {
      console.log("🔗 소켓 연결됨");
      this.isConnected = true;

      // 재연결 시 룸 재입장
      if (this.roomId && this.myPlayerId) {
        this.joinGameRoom();
      }
    });

    socket.on("disconnect", () => {
      console.log("🔌 소켓 연결 끊김");
      this.isConnected = false;
    });

    // 플레이어 움직임 수신
    socket.on("state:move", (data: any) => {
      if (data.id !== this.myPlayerId && this.onPlayerMoveCallback) {
        // facing 값을 안전하게 변환
        const facing: "left" | "right" = data.facing === "L" ? "left" : "right";

        const movement: PlayerMovement = {
          x: data.x,
          y: data.y,
          vx: data.vx,
          vy: data.vy,
          facing: facing,
          isGrounded: true,
          isJumping: false,
          isCrouching: false,
          isWallGrabbing: false,
          health: 100,
        };
        this.onPlayerMoveCallback(data.id, movement);
      }
    });

    // 플레이어 사격 수신
    socket.on("state:shoot", (data: any) => {
      if (data.id !== this.myPlayerId && this.onPlayerShootCallback) {
        const shootData: ShootData = {
          x: data.x,
          y: data.y,
          angle: data.angle,
          gunX: data.x,
          gunY: data.y,
        };
        this.onPlayerShootCallback(data.id, shootData);
      }
    });

    // 총알 충돌 수신
    socket.on("game:bulletHit", (data: BulletHit) => {
      if (this.onBulletHitCallback) {
        this.onBulletHitCallback(data);
      }
    });

    // 포즈(관절/조준각) 수신
    socket.on("pose:update", (pose: any) => {
      // 보낸 당사자라면 스킵
      const pid = pose?.id;
      if (!pid || pid === this.myPlayerId) return;
      this.onPoseCallback?.(pid, pose);
    });

    // 파티클 수신
    socket.on("particle:create", (particleData: any) => {
      this.onParticleCallback?.(particleData);
    });

    // 게임 이벤트 수신
    socket.on("game:event", (event: GameEvent) => {
      if (this.onGameEventCallback) {
        this.onGameEventCallback(event);
      }
    });

    // 체력 업데이트 수신
    socket.on("game:healthUpdate", (data: any) => {
      console.log(`💚 NetworkManager: 체력 업데이트 수신:`, data);
      if (this.onHealthUpdateCallback) {
        this.onHealthUpdateCallback(data);
      }
    });
    // 🆕 증강 스냅샷 수신
    socket.on("augment:snapshot", (data: any) => {
      console.log("📦 증강 스냅샷 수신:", data);
      this.onAugmentSnapshotCallback?.(data);
    });

    // 플레이어 입장/퇴장
    socket.on("game:playerJoined", (playerData: any) => {
      if (playerData.id !== this.myPlayerId && this.onPlayerJoinCallback) {
        this.onPlayerJoinCallback(playerData);
      }
    });

    socket.on("game:playerLeft", (data: { playerId: string }) => {
      if (data.playerId !== this.myPlayerId && this.onPlayerLeaveCallback) {
        this.onPlayerLeaveCallback(data.playerId);
      }
    });

    console.log("🎧 소켓 리스너 설정 완료");
  }

  // 플레이어 움직임 전송
  public sendPlayerMovement(movement: PlayerMovement): void {
    if (!this.isConnected || !this.roomId) return;

    const now = Date.now();
    if (now - this.lastMovementSent < this.maxUpdateRate) return;

    // 서버가 기대하는 형식으로 전송
    socket.emit("input:move", {
      x: movement.x,
      y: movement.y,
      vx: movement.vx,
      vy: movement.vy,
      facing: movement.facing === "left" ? "L" : "R",
    });

    this.lastSentMovement = movement;
    this.lastMovementSent = now;
  }

  // 사격 데이터 전송
  public sendShoot(shootData: ShootData): void {
    if (!this.isConnected || !this.roomId) return;

    const data = {
      ...shootData,
      timestamp: Date.now(),
    };

    socket.emit("input:shoot", {
      x: shootData.x,
      y: shootData.y,
      angle: shootData.angle,
    });

    console.log(
      `🔫 사격 데이터 전송: (${shootData.x.toFixed(1)}, ${shootData.y.toFixed(
        1
      )})`
    );
  }

  // 총알 충돌 전송
  public sendBulletHit(hitData: BulletHit): void {
    if (!this.isConnected || !this.roomId) return;

    const payload = {
      roomId: this.roomId,
      playerId: this.myPlayerId,
      hit: {
        ...hitData,
        timestamp: Date.now(),
      },
    };

    console.log(`💥 충돌 데이터 전송:`, {
      roomId: this.roomId,
      targetPlayerId: hitData.targetPlayerId,
      damage: hitData.damage,
      bulletId: hitData.bulletId,
      position: `(${hitData.x}, ${hitData.y})`
    });

    socket.emit("game:bulletHit", payload);
  }

  // 게임 이벤트 전송
  public sendGameEvent(event: Omit<GameEvent, "playerId">): void {
    if (!this.isConnected || !this.roomId || !this.myPlayerId) return;

    socket.emit("game:event", {
      roomId: this.roomId,
      event: {
        ...event,
        timestamp: Date.now(),
      },
    });

    console.log(`🎯 게임 이벤트 전송: ${event.type}`);
  }

  // 라운드 종료 전송 (승리 스택 포함)
  public sendRoundEnd(players: Array<{
    id: string;
    nickname: string;
    color: string;
    wins: number;
  }>): void {
    if (!this.isConnected || !this.roomId) return;

    socket.emit("round:end", {
      players: players,
    }, (response: any) => {
      if (response?.ok) {
        console.log("✅ 라운드 종료 전송 성공");
      } else {
        console.error("❌ 라운드 종료 전송 실패:", response?.error);
      }
    });

    console.log(`🏆 라운드 종료 전송: ${players.length}명의 플레이어`);
  }

  // 채팅 메시지 전송
  public sendChatMessage(message: string): void {
    if (!this.isConnected || !this.roomId) return;

    socket.emit("game:chat", {
      roomId: this.roomId,
      playerId: this.myPlayerId,
      message: message.trim(),
      timestamp: Date.now(),
    });
  }

  // 이벤트 핸들러 등록
  public onPlayerMove(
    callback: (playerId: string, data: PlayerMovement) => void
  ): void {
    this.onPlayerMoveCallback = callback;
  }

  public onPlayerShoot(
    callback: (playerId: string, data: ShootData) => void
  ): void {
    this.onPlayerShootCallback = callback;
  }

  public onBulletHit(callback: (data: BulletHit) => void): void {
    this.onBulletHitCallback = callback;
  }

  public onGameEvent(callback: (event: GameEvent) => void): void {
    this.onGameEventCallback = callback;
  }

  public onPlayerJoin(callback: (playerData: any) => void): void {
    this.onPlayerJoinCallback = callback;
  }

  public onPlayerLeave(callback: (playerId: string) => void): void {
    this.onPlayerLeaveCallback = callback;
  }

  // 콜백 등록용 메서드
  public onPose(callback: (playerId: string, pose: any) => void): void {
    this.onPoseCallback = callback;
  }

  public onParticle(callback: (particleData: any) => void): void {
    this.onParticleCallback = callback;
  }

  public onHealthUpdate(callback: (data: any) => void): void {
    this.onHealthUpdateCallback = callback;
  }

  // 전송/스로틀
  public maybeSendPose(build: () => any) {
    const now = performance.now();
    if (now - this.lastPoseSentAt < 50) return; // 20Hz
    const pose = build();
    // 데드밴드(각도/방향 같으면 스킵)
    const prev = this.lastPoseCache;
    const same =
      prev &&
      prev.facing === pose.facing &&
      Math.abs((prev.angle ?? 0) - (pose.angle ?? 0)) < 0.02; // ~1.1도
    if (same) return;

    this.lastPoseSentAt = now;
    this.lastPoseCache = pose;

    if (!this.roomId) return;
    socket.emit("pose:update", { roomId: this.roomId, pose });
  }

  // 파티클 전송
  public sendParticle(particleData: any): void {
    if (!this.isConnected || !this.roomId) return;
    socket.emit("particle:create", { roomId: this.roomId, particleData });
  }

  // 네트워크 상태 정보
  public getNetworkStatus(): {
    isConnected: boolean;
    roomId: string | null;
    myPlayerId: string | null;
    lastMovementSent: number;
    packetsSent: number;
  } {
    return {
      isConnected: this.isConnected,
      roomId: this.roomId,
      myPlayerId: this.myPlayerId,
      lastMovementSent: this.lastMovementSent,
      packetsSent: 0, // TODO: 패킷 카운터 구현
    };
  }

  // 네트워크 설정 조정
  public setUpdateRate(fps: number): void {
    this.maxUpdateRate = 1000 / Math.max(1, Math.min(60, fps));
    console.log(`🔧 네트워크 업데이트 레이트 설정: ${fps}fps`);
  }

  public setMovementThreshold(threshold: number): void {
    this.movementThreshold = Math.max(1, threshold);
    console.log(`🔧 움직임 임계값 설정: ${threshold}px`);
  }

  // 강제 동기화 (필요시)
  public forceSyncMovement(movement: PlayerMovement): void {
    this.lastSentMovement = null; // 임계값 체크 무시
    this.sendPlayerMovement(movement);
  }

  // 게임 룸 나가기
  public leaveGameRoom(): void {
    if (!this.roomId) return;

    socket.emit("game:leave", {
      roomId: this.roomId,
      playerId: this.myPlayerId,
    });

    console.log("🚪 게임 룸 나가기");
  }

  // 정리
  public destroy(): void {
    console.log("🧹 NetworkManager 정리 시작");

    // 게임 룸 나가기
    this.leaveGameRoom();

    // 소켓 리스너 제거
    socket.off("connect");
    socket.off("disconnect");
    socket.off("game:playerMove");
    socket.off("state:shoot");
    socket.off("game:bulletHit");
    socket.off("game:event");
    socket.off("game:playerJoined");
    socket.off("game:playerLeft");

    // 상태 초기화
    this.isConnected = false;
    this.roomId = null;
    this.myPlayerId = null;
    this.lastSentMovement = null;

    // 콜백 제거
    this.onPlayerMoveCallback = undefined;
    this.onPlayerShootCallback = undefined;
    this.onBulletHitCallback = undefined;
    this.onGameEventCallback = undefined;
    this.onPlayerJoinCallback = undefined;
    this.onPlayerLeaveCallback = undefined;
    this.onHealthUpdateCallback = undefined;

    console.log("✅ NetworkManager 정리 완료");
  }

  // 디버그 정보
  public getDebugInfo(): any {
    return {
      network: {
        isConnected: this.isConnected,
        roomId: this.roomId,
        myPlayerId: this.myPlayerId,
        socketId: socket.id,
        lastMovementSent: this.lastMovementSent,
        movementThreshold: this.movementThreshold,
        maxUpdateRate: this.maxUpdateRate,
        lastSentMovement: this.lastSentMovement,
      },
    };
  }

  public logDebugInfo(): void {
    const info = this.getDebugInfo();
    console.log("=== NETWORK MANAGER DEBUG INFO ===");
    console.log("네트워크 상태:", info.network);
    console.log("===============================");
  }

  // 개발자 도구
  public getDevTools() {
    return {
      forceReconnect: () => {
        socket.disconnect();
        setTimeout(() => socket.connect(), 1000);
        console.log("🔄 강제 재연결 시도");
      },

      simulateNetworkDelay: (ms: number) => {
        // 시뮬레이션된 네트워크 지연
        const originalSend = this.sendPlayerMovement.bind(this);
        this.sendPlayerMovement = (movement: PlayerMovement) => {
          setTimeout(() => originalSend(movement), ms);
        };
        console.log(`⏱️ 네트워크 지연 시뮬레이션: ${ms}ms`);
      },

      testConnection: () => {
        socket.emit("ping", Date.now(), (serverTime: number) => {
          const latency = Date.now() - serverTime;
          console.log(`🏓 핑: ${latency}ms`);
        });
      },

      logNetworkStats: () => {
        this.logDebugInfo();
      },

      setHighUpdateRate: () => {
        this.setUpdateRate(60);
        this.setMovementThreshold(1);
        console.log("⚡ 고성능 네트워크 모드 활성화");
      },

      setLowUpdateRate: () => {
        this.setUpdateRate(10);
        this.setMovementThreshold(10);
        console.log("🐌 저대역폭 네트워크 모드 활성화");
      },
    };
  }
}

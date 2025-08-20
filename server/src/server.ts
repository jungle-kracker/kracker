// server.ts
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
type Team = "A" | "B";
type Status = "waiting" | "playing" | "ended";
type Visibility = "public" | "private";

type Player = {
  id: string; // socket.id
  nickname: string;
  team?: Team;
  color?: string;
  ready: boolean;
  health?: number; // 체력 추가
};

type Room = {
  roomId: string;
  hostId: string;
  max: number;
  status: Status;
  players: Record<string, Player>;
  visibility: Visibility; // 공개/비공개
  roomName: string; // 방 이름
  gameMode: string; // "팀전" 등
  createdAt: number;
  nextTeam: Team; // 다음 배정 예정 팀 ("A" 또는 "B")
  // 증강 관련 필드 추가
  currentRound: number;
  roundResults: Array<{
    round: number;
    players: Array<{
      id: string;
      nickname: string;
      color: string;
      wins: number;
    }>;
  }>;
  augmentSelections: Array<{
    round: number;
    selections: Record<string, string>; // playerId -> augmentId
  }>;
};

const MAX_ROOMS = 5;
const TEAM_CAP = 3;

const COLOR_PRESETS = [
  "#D76A6A",
  "#EE9841",
  "#5A945B",
  "#196370",
  "#6C3FAF",
  "#DF749D",
];

const isHexColor = (s: string) => /^#?[0-9a-fA-F]{6}$/.test(s);
const normalizeHex = (s: string) => ("#" + s.replace("#", "")).toUpperCase();
const getUsedColors = (room: Room) =>
  new Set(
    Object.values(room.players).map((p) => (p.color || "").toLowerCase())
  );
const pickFirstFreeColor = (room: Room) => {
  const used = getUsedColors(room);
  return COLOR_PRESETS.find((c) => !used.has(c.toLowerCase())) ?? "#888888";
};

const toSafeRoom = (room: Room) => ({
  roomId: room.roomId,
  max: room.max,
  status: room.status,
  visibility: room.visibility,
  roomName: room.roomName,
  gameMode: room.gameMode,
  createdAt: room.createdAt,
  players: Object.values(room.players).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    color: p.color,
    team: p.team,
    ready: p.ready,
  })),
});

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new Map<string, Room>();

function safeRoomState(room: Room) {
  const players = Object.values(room.players).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    team: p.team,
    color: p.color,
    ready: p.ready,
    health: p.health || 100, // 체력 정보 포함
  }));
  return {
    roomId: room.roomId,
    hostId: room.hostId,
    max: room.max,
    status: room.status,
    players,
    // 추가
    visibility: room.visibility,
    roomName: room.roomName,
    gameMode: room.gameMode,
  };
}

// ──────────────────────────────────────────────────────────────
// Socket.IO
// ──────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  // 방 생성
  socket.on("room:create", (payload: any, ack?: Function) => {
    // 제한 초과 시 실패 응답
    if (rooms.size >= MAX_ROOMS) {
      return ack?.({ ok: false, error: "ROOM_LIMIT", max: MAX_ROOMS });
    }

    const roomId = Math.random().toString(36).slice(2, 7).toUpperCase();

    const room: Room = {
      roomId,
      hostId: socket.id,
      max: Math.max(2, Math.min(16, payload.max || 8)),
      status: "waiting",
      players: {},
      // 기본값 지정
      visibility: payload?.visibility ?? "public",
      roomName: String(payload?.roomName ?? "ROOM"),
      gameMode: String(payload?.gameMode ?? "팀전"),
      createdAt: Date.now(),
      nextTeam: "A", // 처음은 A로 시작
      // 증강 관련 필드 초기화
      currentRound: 0,
      roundResults: [],
      augmentSelections: [],
    };

    room.players[socket.id] = {
      id: socket.id,
      nickname: String(payload?.nickname ?? "Player"), // ✅ 저장
      team: "A",
      ready: false,
      health: 100, // 초기 체력 설정
    };

    rooms.set(roomId, room);

    const player: Player = {
      id: socket.id,
      nickname: payload.nickname?.trim() || "Player",
      ready: false,
      team: "A",
    };

    rooms.set(roomId, room);
    socket.join(roomId);

    room.players[socket.id] = player;

    room.nextTeam = "B";

    console.log(
      `[ROOM CREATE] ${player.nickname} (${socket.id}) -> ${roomId} (max=${room.max})`
    );

    ack?.({ ok: true, room: safeRoomState(room) });
    io.to(roomId).emit("room:update", safeRoomState(room));
  });

  // 4) 방 목록: 공개방만 + 필드 포함
  socket.on("room:list", (_: {}, ack?: Function) => {
    const list = [...rooms.values()]
      .filter((r) => r.visibility === "public" && r.status === "waiting")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3) //서버에서도 3개 제한
      .map((r) => ({
        roomId: r.roomId,
        max: r.max,
        players: Object.values(r.players),
        status: r.status,
        // 추가
        visibility: r.visibility,
        roomName: r.roomName,
        gameMode: r.gameMode,
        createdAt: r.createdAt,
      }));
    ack?.({ ok: true, rooms: list });
  });

  // 5) 방 정보 조회 (로비 새로고침용)
  socket.on("room:info", (payload: { roomId: string }, ack?: Function) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack?.({ ok: false, error: "NOT_FOUND" });
    ack?.({ ok: true, room: safeRoomState(room) });
  });

  function pickTeamWithAlternation(room: Room, cap: number): Team | null {
    const countA = Object.values(room.players).filter(
      (p) => p.team === "A"
    ).length;
    const countB = Object.values(room.players).filter(
      (p) => p.team === "B"
    ).length;

    const order: Team[] = room.nextTeam === "A" ? ["A", "B"] : ["B", "A"];

    for (const t of order) {
      if (t === "A" && countA < cap) {
        room.nextTeam = "B"; // 다음은 반대로
        return "A";
      }
      if (t === "B" && countB < cap) {
        room.nextTeam = "A";
        return "B";
      }
    }
    return null; // 양쪽 다 꽉 참
  }

  // 방 참가
  socket.on("room:join", (payload: any, ack?: Function) => {
    const { roomId, nickname } = payload || {};

    const room = rooms.get(roomId);

    if (!room) {
      console.log(
        `[ROOM JOIN FAIL] ${socket.id} -> ${payload.roomId} (NOT_FOUND)`
      );
      return ack?.({ ok: false, error: "NOT_FOUND" });
    }
    if (room.status !== "waiting") {
      console.log(
        `[ROOM JOIN FAIL] ${socket.id} -> ${payload.roomId} (IN_PROGRESS)`
      );
      return ack?.({ ok: false, error: "IN_PROGRESS" });
    }
    if (Object.keys(room.players).length >= room.max) {
      console.log(`[ROOM JOIN FAIL] ${socket.id} -> ${payload.roomId} (FULL)`);
      return ack?.({ ok: false, error: "FULL" });
    }

    // 방 합류
    socket.join(roomId);

    const n = String(nickname ?? "Player");
    const ex = room.players[socket.id];

    if (ex) {
      // 기존 입장자면 닉네임만 갱신(정책에 따라 유지해도 됨)
      ex.nickname = n; // ✅ 갱신
    } else {
      room.players[socket.id] = {
        id: socket.id,
        nickname: n, // ✅ 저장
        team: "A",
        ready: false,
        health: 100, // 초기 체력 설정
      };
    }

    // ✅ 새 플레이어 객체를 먼저 만든 뒤 팀 자동배정
    const player: Player = {
      id: socket.id,
      nickname: (payload.nickname ?? "Player").trim() || "Player",
      ready: false,
    };

    // ✅ 팀전이면: A팀이 꽉 차(TEAM_CAP) 있으면 B팀, 아니면 A팀
    if (room.gameMode === "팀전") {
      const team = pickTeamWithAlternation(room, TEAM_CAP);
      if (!team) {
        return ack?.({ ok: false, error: "FULL" });
      }
      player.team = team;
    }

    // 최종 등록 (체력 추가)
    player.health = 100; // 초기 체력 설정
    room.players[socket.id] = player;

    console.log("palyer:", player);

    console.log(
      `[ROOM JOIN] ${player.nickname} (${socket.id}) -> ${payload.roomId} (${
        Object.keys(room.players).length
      }/${room.max})`
    );

    ack?.({ ok: true, room: safeRoomState(room) });
    io.to(roomId).emit("room:update", safeRoomState(room));
    io.to(roomId).emit("player:joined", {
      players: Object.values(room.players).map((player) => ({
        ...player,
        health: player.health || 100,
      })),
    });
  });

  // 방 나가기(수동)
  socket.on("room:leave", (_: {}, ack?: Function) => {
    const left = leaveAllRooms(socket);
    ack?.({ ok: true, left });
  });

  // Ready 토글
  socket.on("player:ready", (_: {}, ack?: Function) => {
    const rid = currentRoomIdOf(socket);
    if (!rid) return ack?.({ ok: false });
    const room = rooms.get(rid);
    if (!room) return ack?.({ ok: false });
    const p = room.players[socket.id];
    if (!p) return ack?.({ ok: false });

    p.ready = !p.ready;
    console.log(
      `[READY] ${p.nickname} (${socket.id}) -> ${rid} : ${
        p.ready ? "ON" : "OFF"
      }`
    );

    io.to(rid).emit("room:update", safeRoomState(room));

    // 전원 Ready면 시작 가능 알림
    const allReady =
      Object.values(room.players).length >= 2 &&
      Object.values(room.players).every((pp) => pp.ready);
    if (allReady) {
      console.log(`[READY ALL] room ${rid} is ready to start`);
      io.to(rid).emit("game:readyToStart");
    }
    ack?.({ ok: true, ready: p.ready });
  });

  // 팀/색 선택
  socket.on(
    "player:select",
    (payload: { team?: Team; color?: string }, ack?: Function) => {
      const rid = currentRoomIdOf(socket);
      if (!rid) return ack?.({ ok: false });
      const room = rooms.get(rid);
      if (!room) return ack?.({ ok: false });
      const p = room.players[socket.id];
      if (!p) return ack?.({ ok: false });

      if (payload.team) p.team = payload.team;

      if (payload.color) {
        const used = new Set(
          Object.values(room.players)
            .map((x) => x.color)
            .filter(Boolean) as string[]
        );
        if (!used.has(payload.color)) p.color = payload.color; // 중복 최소 방지
      }

      console.log(
        `[SELECT] ${p.nickname} (${socket.id}) -> room ${rid} team=${
          p.team ?? "-"
        } color=${p.color ?? "-"}`
      );

      io.to(rid).emit("room:update", safeRoomState(room));
      ack?.({ ok: true });
    }
  );

  //플레이어 색
  socket.on("player:setColor", ({ roomId, color }, ack) => {
    const room = rooms.get(roomId);
    if (!room) return ack?.({ ok: false, error: "NO_ROOM" });

    const me = room.players[socket.id];
    if (!me) return ack?.({ ok: false, error: "NOT_IN_ROOM" });

    // 간단한 검증
    const isHex = /^#?[0-9a-fA-F]{6}$/.test(color || "");
    if (!isHex) return ack?.({ ok: false, error: "INVALID_COLOR" });

    const hex = ("#" + String(color).replace("#", "")).toUpperCase();

    // (선택) 중복 금지: 다른 사람이 쓰는 색이면 거부
    const used = new Set(
      Object.values(room.players).map((p) => (p.color || "").toLowerCase())
    );
    const myCurrent = (me.color || "").toLowerCase();
    if (used.has(hex.toLowerCase()) && hex.toLowerCase() !== myCurrent) {
      return ack?.({ ok: false, error: "COLOR_TAKEN" });
    }

    me.color = hex;
    ack?.({ ok: true });

    // 클라가 이미 구독 중인 이벤트로 전파
    io.to(roomId).emit("player:updated", {
      players: Object.values(room.players),
    });
  });

  // 호스트만 게임 시작
  socket.on("game:start", (_: {}, ack?: Function) => {
    const rid = currentRoomIdOf(socket);
    if (!rid) return ack?.({ ok: false, error: "NO_ROOM" });
    const room = rooms.get(rid)!;
    if (room.hostId !== socket.id)
      return ack?.({ ok: false, error: "NOT_HOST" });

    // ✅ 전원 팔레트 색 선택 확인 (기본색 "#888888"은 미선택)
    const DEFAULT_SKIN = "#888888";
    const everyoneColored = Object.values(room.players).every(
      (p) => p.color && p.color !== DEFAULT_SKIN
    );
    if (!everyoneColored) {
      return ack?.({ ok: false, error: "COLOR_NOT_READY" });
    }

    room.status = "playing";
    console.log(`[GAME START] room ${rid} by host ${socket.id}`);

    // 게임 시작 시 모든 플레이어의 체력 정보 전송
    const playersWithHealth = Object.values(room.players).map((player) => ({
      ...player,
      health: player.health || 100,
    }));

    io.to(rid).emit("game:started", {
      // ← "game:started"로 변경
      startTime: Date.now(), // ← "at" 대신 "startTime"
      room: safeRoomState(room),
      players: playersWithHealth, // ← 체력 정보가 포함된 플레이어 데이터
    });

    // 게임 시작 시 모든 플레이어의 현재 체력 정보를 각각 전송
    Object.entries(room.players).forEach(([playerId, player]) => {
      io.to(rid).emit("game:healthUpdate", {
        playerId: playerId,
        health: player.health || 100,
        damage: 0,
        timestamp: Date.now(),
      });
    });
    ack?.({ ok: true });
  });

  // 입력 중계(로그는 과다하니 기본 비활성)
  socket.on(
    "input:move",
    (data: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      facing: "L" | "R";
    }) => {
      const rid = currentRoomIdOf(socket);
      if (!rid) return;
      socket
        .to(rid)
        .emit("state:move", { id: socket.id, ...data, t: Date.now() });
    }
  );

  socket.on("input:shoot", (data: { x: number; y: number; angle: number }) => {
    const rid = currentRoomIdOf(socket);
    if (!rid) return;

    console.log(`[SHOOT] ${socket.id} -> room ${rid}: angle ${data.angle}`);

    socket.to(rid).emit("state:shoot", {
      id: socket.id,
      ...data,
      t: Date.now(),
    });
  });

  // 원격 HP 반영용: 총알 피격 중계
  socket.on(
    "game:bulletHit",
    (payload: { roomId: string; playerId: string; hit: any }) => {
      const { roomId, hit } = payload || {};
      if (!roomId || !hit) return;

      // 서버에서 체력 관리
      const room = rooms.get(roomId);
      if (room && room.players[hit.targetPlayerId]) {
        // 현재 체력 가져오기 (기본값 100)
        const currentHealth = room.players[hit.targetPlayerId]?.health || 100;
        const newHealth = Math.max(0, currentHealth - hit.damage);

        // 서버에 체력 업데이트
        const player = room.players[hit.targetPlayerId];
        if (player) {
          player.health = newHealth;

          // 체력이 0이 되었을 때 리스폰 처리
          if (newHealth <= 0) {
            console.log(`[RESPAWN] ${hit.targetPlayerId} 체력 0으로 리스폰`);
            // 3초 후 체력 회복
            setTimeout(() => {
              const currentRoom = rooms.get(roomId);
              const currentPlayer = currentRoom?.players[hit.targetPlayerId];
              if (currentPlayer) {
                currentPlayer.health = 100;

                // 리스폰 이벤트 전송
                io.to(roomId).emit("game:healthUpdate", {
                  playerId: hit.targetPlayerId,
                  health: 100,
                  damage: 0,
                  timestamp: Date.now(),
                });

                console.log(`[RESPAWN] ${hit.targetPlayerId} 체력 회복: 100`);
              }
            }, 3000);
          }
        }

        // 모든 클라이언트에게 체력 업데이트 전송
        io.to(roomId).emit("game:healthUpdate", {
          playerId: hit.targetPlayerId,
          health: newHealth,
          damage: hit.damage,
          timestamp: Date.now(),
        });

        console.log(
          `[HEALTH] ${hit.targetPlayerId}: ${currentHealth} -> ${newHealth} (-${hit.damage})`
        );

        // 방의 모든 플레이어 체력 상태 로그
        console.log(
          `[ROOM HEALTH] Room ${roomId} players health:`,
          Object.entries(room.players).map(
            ([id, p]) => `${p.nickname}: ${p.health}`
          )
        );
      }

      // 기존 충돌 이벤트도 전송
      io.to(roomId).emit("game:bulletHit", hit);
    }
  );

  // 관절(포즈) 동기화: 조준 각도 등
  socket.on("pose:update", (payload: { roomId: string; pose: any }) => {
    const { roomId, pose } = payload || {};
    if (!roomId || !pose) return;
    // 보낸 당사자 제외, 같은 방에 전달
    socket.to(roomId).emit("pose:update", pose);
  });

  // 파티클 이벤트 중계
  socket.on(
    "particle:create",
    (payload: { roomId: string; particleData: any }) => {
      const { roomId, particleData } = payload || {};
      if (!roomId || !particleData) return;
      // 보낸 당사자 제외, 같은 방에 전달
      socket.to(roomId).emit("particle:create", particleData);
    }
  );

  // 게임 이벤트 중계 (체력바 표시 등)
  socket.on("game:event", (payload: { roomId: string; event: any }) => {
    const { roomId, event } = payload || {};
    if (!roomId || !event) return;
    // 보낸 당사자 제외, 같은 방에 전달
    socket.to(roomId).emit("game:event", event);
  });

  // 채팅
  socket.on("chat:send", (data: { message: string }) => {
    const rid = currentRoomIdOf(socket);
    if (!rid) return;
    const msg = (data.message || "").slice(0, 200);
    console.log(`[CHAT] room ${rid} ${socket.id}: ${msg}`);
    io.to(rid).emit("chat:message", {
      id: socket.id,
      message: msg,
      t: Date.now(),
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 라운드 종료 → 결과 표출 → 3초 뒤 증강 선택 진입 (방 단위 동기화)
  // ──────────────────────────────────────────────────────────────
  socket.on(
    "round:end",
    (
      payload: {
        players: Array<{
          id: string;
          nickname: string;
          color: string;
          wins: number;
        }>;
      },
      ack?: Function
    ) => {
      const rid = currentRoomIdOf(socket);
      if (!rid) return ack?.({ ok: false, error: "NO_ROOM" });

      const room = rooms.get(rid);
      if (!room) return ack?.({ ok: false, error: "NO_ROOM" });

      // 현재 라운드 번호 증가
      room.currentRound += 1;

      // 라운드 결과 저장
      room.roundResults.push({
        round: room.currentRound,
        players: payload.players,
      });

      // 결과 패널 표출 지시 (클라이언트는 수신 즉시 RoundResultModal 오픈)
      io.to(rid).emit("round:result", {
        players: payload.players,
        round: room.currentRound,
      });

      // 3초 후 증강 선택 화면으로 전환 지시
      setTimeout(() => {
        io.to(rid).emit("round:augment", {
          players: payload.players.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            color: p.color,
          })),
          round: room.currentRound,
        });
      }, 3000);

      ack?.({ ok: true });
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 증강 선택 처리 (플레이어별 선택 결과 서버 보관)
  // ──────────────────────────────────────────────────────────────
  socket.on(
    "augment:select",
    (
      payload: {
        augmentId: string;
        round: number;
      },
      ack?: Function
    ) => {
      const rid = currentRoomIdOf(socket);
      if (!rid) return ack?.({ ok: false, error: "NO_ROOM" });

      const room = rooms.get(rid);
      if (!room) return ack?.({ ok: false, error: "NO_ROOM" });

      // 해당 라운드의 증강 선택 결과 찾기 또는 생성
      let roundSelection = room.augmentSelections.find(
        (s) => s.round === payload.round
      );

      if (!roundSelection) {
        roundSelection = {
          round: payload.round,
          selections: {},
        };
        room.augmentSelections.push(roundSelection);
      }

      // 플레이어의 증강 선택 저장
      roundSelection.selections[socket.id] = payload.augmentId;

      console.log(
        `[AUGMENT SELECT] room ${rid}, round ${payload.round}, player ${socket.id} -> ${payload.augmentId}`
      );

      // 모든 플레이어가 선택했는지 확인
      const allPlayersSelected = Object.values(room.players).every(
        (player) => roundSelection!.selections[player.id]
      );

      if (allPlayersSelected) {
        console.log(
          `[AUGMENT COMPLETE] room ${rid}, round ${payload.round} - 모든 플레이어 선택 완료`
        );
        
        // 모든 플레이어에게 증강 선택 완료 알림
        io.to(rid).emit("augment:complete", {
          round: payload.round,
          selections: roundSelection.selections,
        });
      }

      ack?.({ ok: true, allSelected: allPlayersSelected });
    }
  );

  // 연결 종료
  socket.on("disconnect", () => {
    console.log(`[DISCONNECT] ${socket.id}`);
    leaveAllRooms(socket);
  });
});

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function currentRoomIdOf(socket: any): string | null {
  const rid = [...socket.rooms].find((r) => r !== socket.id);
  return rid ?? null;
}

function leaveAllRooms(socket: any) {
  const joined = [...socket.rooms].filter((r) => r !== socket.id);
  const left: string[] = [];
  for (const rid of joined) {
    const room = rooms.get(rid);
    if (!room) continue;

    const player = room.players[socket.id];
    console.log(`[ROOM LEAVE] ${player?.nickname || socket.id} left ${rid}`);

    delete room.players[socket.id];

    // 호스트가 나가면 다음 사람을 호스트로
    if (room.hostId === socket.id) {
      const nextHost = Object.keys(room.players)[0];
      if (nextHost) {
        room.hostId = nextHost;
        console.log(`[HOST SWITCH] room ${rid} -> ${nextHost}`);
      } else {
        rooms.delete(rid);
        console.log(`[ROOM CLOSE] room ${rid} closed (empty)`);
      }
    }

    socket.leave(rid);
    if (rooms.has(rid)) {
      io.to(rid).emit("room:update", safeRoomState(room));
      io.to(rid).emit("player:left", { id: socket.id });
    } else {
      io.to(rid).emit("room:closed");
    }
    left.push(rid);
  }
  return left;
}

// ──────────────────────────────────────────────────────────────
// HTTP
// ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, t: Date.now() }));

server.listen(4000, () => console.log("Socket.IO server on :4000"));

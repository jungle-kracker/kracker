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
  wins?: number; // 🆕 라운드 승리 스택
  // 🆕 활성 증강: augmentId -> { id, startedAt }
  augments?: Record<string, { id: string; startedAt: number }>;
  // 🆕 서버가 추적하는 마지막 위치(상태/넉백 계산용)
  x?: number;
  y?: number;
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
    completionScheduled?: boolean; // 🆕 완료 방송 예약 여부
  }>;
  // 🆕 라운드 종료 브로드캐스트 지연 중 여부
  isRoundEnding?: boolean;
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

// ──────────────────────────────────────────────────────────────
// 맵 스폰 좌표(기본 level1)
// 클라이언트의 public/maps/level1.json과 동일하게 유지
const DEFAULT_SPAWNS: Array<{ name: "A" | "B"; x: number; y: number }> = [
  { name: "A", x: 165, y: 350 },
  { name: "B", x: 1755, y: 350 },
  { name: "A", x: 500, y: 100 },
  { name: "B", x: 1420, y: 100 },
  { name: "A", x: 375, y: 750 },
  { name: "B", x: 1545, y: 750 },
];

function computeSpawnPositions(room: Room): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const entries = Object.entries(room.players);

  const byTeam = (team: Team) => DEFAULT_SPAWNS.filter((s) => s.name === team);
  const all = DEFAULT_SPAWNS.slice();

  if (room.gameMode === "팀전") {
    const teamAIds = entries.filter(([, p]) => p.team === "A").map(([id]) => id);
    const teamBIds = entries.filter(([, p]) => p.team === "B").map(([id]) => id);

    const aSpawns = byTeam("A");
    const bSpawns = byTeam("B");

    teamAIds.forEach((id, idx) => {
      const candidate = aSpawns.length > 0 ? aSpawns[idx % aSpawns.length] : all[idx % all.length];
      const base = candidate || all[0];
      const cycle = Math.floor(idx / Math.max(1, (aSpawns.length || all.length)));
      positions[id] = { x: base!.x + (cycle % 2 === 0 ? 10 * cycle : -10 * cycle), y: base!.y };
    });
    teamBIds.forEach((id, idx) => {
      const candidate = bSpawns.length > 0 ? bSpawns[idx % bSpawns.length] : all[idx % all.length];
      const base = candidate || all[0];
      const cycle = Math.floor(idx / Math.max(1, (bSpawns.length || all.length)));
      positions[id] = { x: base!.x + (cycle % 2 === 0 ? 10 * cycle : -10 * cycle), y: base!.y };
    });
  } else {
    entries.forEach(([id], idx) => {
      const base = all[idx % all.length] || all[0];
      const cycle = Math.floor(idx / Math.max(1, all.length));
      positions[id] = { x: base!.x + (cycle % 2 === 0 ? 10 * cycle : -10 * cycle), y: base!.y };
    });
  }

  return positions;
}

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
      isRoundEnding: false,
    };

    room.players[socket.id] = {
      id: socket.id,
      nickname: String(payload?.nickname ?? "Player"), // ✅ 저장
      team: "A",
      ready: false,
      health: 100, // 초기 체력 설정
      wins: 0, // 🆕 승리 스택 초기화
    };

    rooms.set(roomId, room);

    const player: Player = {
      id: socket.id,
      nickname: payload.nickname?.trim() || "Player",
      ready: false,
      team: "A",
      health: 100,
      wins: 0,
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
      if (ex.health == null) ex.health = 100;
      if (ex.wins == null) ex.wins = 0;
    } else {
      room.players[socket.id] = {
        id: socket.id,
        nickname: n, // ✅ 저장
        team: "A",
        ready: false,
        health: 100, // 초기 체력 설정
        wins: 0, // 🆕 승리 스택 초기화
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
    player.wins = player.wins ?? 0;
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

    // 🔢 스폰 인덱스 사전 배정 (팀전은 팀별 인덱스, 개인전은 전체 인덱스)
    const spawnPlan: Record<string, number> = {};
    const entries = Object.entries(room.players);
    if (room.gameMode === "팀전") {
      const teamA = entries.filter(([, p]) => p.team === "A").map(([id]) => id);
      const teamB = entries.filter(([, p]) => p.team === "B").map(([id]) => id);
      teamA.forEach((id, idx) => (spawnPlan[id] = idx));
      teamB.forEach((id, idx) => (spawnPlan[id] = idx));
    } else {
      entries.forEach(([id], idx) => (spawnPlan[id] = idx));
    }

    io.to(rid).emit("game:started", {
      // ← "game:started"로 변경
      startTime: Date.now(), // ← "at" 대신 "startTime"
      room: safeRoomState(room),
      players: playersWithHealth, // ← 체력 정보가 포함된 플레이어 데이터
      spawnPlan, // 🔢 초기 스폰 인덱스 전달
      spawnPositions: computeSpawnPositions(room), // 🗺️ 초기 스폰 좌표 직접 전달
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
      // 서버에 마지막 위치 저장(넉백 등 상태 계산용)
      const room = rooms.get(rid);
      if (room) {
        const me = room.players[socket.id];
        if (me) {
          me.x = data.x;
          me.y = data.y;
        }
      }
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

      const room = rooms.get(roomId);
      if (room && room.players[hit.targetPlayerId]) {
        // 현재 체력 가져오기 (기본값 100)
        const target = room.players[hit.targetPlayerId];
        if (!target) return;
        const currentHealth = target.health ?? 100;

        // 이미 사망 상태면 추가 데미지 무시
        if (currentHealth <= 0) {
          return;
        }

        // 서버 권위 대미지 계산 (증강 반영)
        const shooter = room.players[payload.playerId];
        let damage = hit.damage ?? 25;
        // 빨리뽑기: 고정 추가 대미지 제거 (탄창/재장전 효과만 유지)
        const newHealth = Math.max(0, currentHealth - damage);

        // 서버에 체력 업데이트
        target.health = newHealth;

        // 모든 클라이언트에게 체력 업데이트 전송
        io.to(roomId).emit("game:healthUpdate", {
          playerId: hit.targetPlayerId,
          health: newHealth,
          damage: damage,
          timestamp: Date.now(),
        });
        
        // 데미지를 입은 플레이어에게 HP바 표시 이벤트 전송
        io.to(roomId).emit("game:event", {
          type: "showHealthBar",
          playerId: hit.targetPlayerId,
          data: {
            playerId: hit.targetPlayerId,
            health: newHealth,
            duration: 3000, // 3초간 표시
          },
        });
        
        // 독걸려랑: DoT 스케줄 (초당 5뎀, 3틱)
        if (shooter?.augments && shooter.augments["독걸려랑"] && newHealth > 0) {

          const victimId = hit.targetPlayerId;
          let ticks = 3;
          const dot = 5;
          const timer = setInterval(() => {
            const r = rooms.get(roomId);
            if (!r) return clearInterval(timer);
            const v = r.players[victimId];
            if (!v) return clearInterval(timer);
            const h = v.health ?? 100;
            if (h <= 0) return clearInterval(timer);
            const nh = Math.max(0, h - dot);
            v.health = nh;
            io.to(roomId).emit("game:healthUpdate", {
              playerId: victimId,
              health: nh,
              damage: dot,
              timestamp: Date.now(),
            });

            // 독 데미지로 인한 HP바 표시
            io.to(roomId).emit("game:event", {
              type: "showHealthBar",
              playerId: victimId,
              data: {
                playerId: victimId,
                health: nh,
                duration: 3000, // 3초간 표시
              },
            });
            ticks -= 1;
            if (nh <= 0 || ticks <= 0) clearInterval(timer);
          }, 1000);
        }

        // 벌이야!: DoT 스케줄 (2초당 5뎀, 3틱)
        if (shooter?.augments && shooter.augments["벌이야!"] && newHealth > 0) {
          const victimId = hit.targetPlayerId;
          let ticks = 3;
          const dot = 5;
          const timer2 = setInterval(() => {
            const r = rooms.get(roomId);
            if (!r) return clearInterval(timer2);
            const v = r.players[victimId];
            if (!v) return clearInterval(timer2);
            const h = v.health ?? 100;
            if (h <= 0) return clearInterval(timer2);
            const nh = Math.max(0, h - dot);
            v.health = nh;
            io.to(roomId).emit("game:healthUpdate", {
              playerId: victimId,
              health: nh,
              damage: dot,
              timestamp: Date.now(),
            });
            ticks -= 1;
            if (nh <= 0 || ticks <= 0) clearInterval(timer2);
          }, 2000);
        }

        // ===== 서버 권위 상태이상/버프 처리 =====
        if (shooter?.augments) {
          // 끈적여요: 둔화 (augments.json 기준 1500ms, 0.5)
          if (shooter.augments["끈적여요"]) {
            io.to(roomId).emit("game:event", {
              type: "status",
              playerId: hit.targetPlayerId,
              data: { status: "slow", ms: 1500, multiplier: 0.5 },
            });
          }

          // 앗따거: 스턴(1000ms)
          if (shooter.augments["앗따거"]) {
            io.to(roomId).emit("game:event", {
              type: "status",
              playerId: hit.targetPlayerId,
              data: { status: "stun", ms: 1000 },
            });
          }

          // 잠깐만: 넉백 (기본 임펄스 * 2)
          if (shooter.augments["잠깐만"]) {
            const victim = room.players[hit.targetPlayerId];
            const px = victim?.x ?? hit.x;
            const py = victim?.y ?? hit.y;
            let dx = (px as number) - hit.x;
            let dy = (py as number) - hit.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            dx /= len;
            dy /= len;
            const impulseBase = 400 * 2;
            io.to(roomId).emit("game:event", {
              type: "status",
              playerId: hit.targetPlayerId,
              data: { status: "knockback", vx: dx * impulseBase, vy: dy * impulseBase, ms: 0 },
            });
          }

          // 기생충: 라이프스틸(+15)
          if (shooter.augments["기생충"]) {
            const healer = room.players[payload.playerId];
            const old = healer?.health ?? 100;
            const nh = Math.min(100, old + 15);
            if (healer) healer.health = nh;
            io.to(roomId).emit("game:healthUpdate", {
              playerId: payload.playerId,
              health: nh,
              damage: 0,
              timestamp: Date.now(),
            });
          }
        }

        // 사망 브로드캐스트
        if (newHealth <= 0) {
          io.to(roomId).emit("game:event", {
            type: "dead",
            playerId: hit.targetPlayerId,
            data: { x: hit.x, y: hit.y },
          });
        }

        // 🔎 라운드 종료 판정 및 스케줄링 (3초 대기 후 방송)
        const { shouldEnd, winners } = evaluateRoundEnd(room);
        if (shouldEnd && !room.isRoundEnding) {
          room.isRoundEnding = true;
          setTimeout(() => {
            // 승자 승리 스택 반영
            winners.forEach((pid) => {
              const wp = room.players[pid];
              if (wp) wp.wins = (wp.wins || 0) + 1;
            });
            // 라운드 결과/다음 단계 방송
            endRound(io, room);
            // 스케줄 해제
            room.isRoundEnding = false;
          }, 3000);
        }

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
          completionScheduled: false,
        };
        room.augmentSelections.push(roundSelection);
      }

      // 플레이어의 증강 선택 저장
      roundSelection.selections[socket.id] = payload.augmentId;

      console.log(
        `[AUGMENT SELECT] room ${rid}, round ${payload.round}, player ${socket.id} -> ${payload.augmentId}`
      );

      // 진행 상황 브로드캐스트 (실시간 동기화)
      io.to(rid).emit("augment:progress", {
        round: payload.round,
        selections: roundSelection.selections,
        selectedCount: Object.keys(roundSelection.selections).length,
        totalPlayers: Object.keys(room.players).length,
      });

      // 모든 플레이어가 선택했는지 확인
      const allPlayersSelected = Object.values(room.players).every(
        (player) => roundSelection!.selections[player.id]
      );

      if (allPlayersSelected && !roundSelection.completionScheduled) {
        roundSelection.completionScheduled = true;
        console.log(
          `[AUGMENT COMPLETE] room ${rid}, round ${payload.round} - 모든 플레이어 선택 완료`
        );

        // 즉시 완료 방송
        io.to(rid).emit("augment:complete", {
          round: payload.round,
          selections: roundSelection.selections,
        });

        // 🆕 서버 저장: 각 플레이어의 활성 증강 갱신(간단 모델)
        Object.entries(roundSelection.selections).forEach(([pid, augId]) => {
          const p = room.players[pid];
          if (!p) return;
          if (!p.augments) p.augments = {};
          p.augments[augId] = { id: augId, startedAt: Date.now() };
        });

        // 🆕 증강 상태 전체 방송(스냅샷)
        io.to(rid).emit("augment:snapshot", {
          players: Object.values(room.players).map((p) => ({
            id: p.id,
            augments: p.augments || {},
          })),
          round: payload.round,
          t: Date.now(),
        });

        // 2초 대기하는 동안: 모든 플레이어 체력 100% 회복 및 브로드캐스트,
        // 증강 선택 상태 초기화
        Object.values(room.players).forEach((p) => {
          p.health = 100;
          io.to(rid).emit("game:healthUpdate", {
            playerId: p.id,
            health: 100,
            damage: 0,
            timestamp: Date.now(),
          });
        });

        // 모든 플레이어에게 스폰 위치로 복귀 지시 (클라에서 맵 스폰에 맞춰 위치 리셋)
        const playerEntries = Object.entries(room.players);
        playerEntries.forEach(([playerId, player], index) => {
          io.to(rid).emit("game:event", {
            type: "respawnAll",
            playerId: "server",
            data: { 
              round: payload.round,
              spawnIndex: index, // 입장 순서 기반 스폰 인덱스
              targetPlayerId: playerId // 해당 플레이어에게만 전송
            },
          });
        });

        // 스폰 이동 후 alive 신호로 입력/가시성 해제
        Object.values(room.players).forEach((p) => {
          io.to(rid).emit("game:event", {
            type: "alive",
            playerId: p.id,
            data: { round: payload.round },
          });
        });

        // 선택 상태 초기화(서버)
        // 진행 상태를 즉시 0으로 재방송하면 클라이언트에 혼란(0/1 {})을 주므로,
        // 내부 상태만 초기화하고 진행 이벤트는 다음 라운드 전환에서만 보내도록 함.
        roundSelection.selections = {};

        // 2초 후 완료 예약 상태 해제
        setTimeout(() => {
          roundSelection!.completionScheduled = false;
        }, 2000);
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
// 라운드 종료 판정 및 처리 헬퍼
// ──────────────────────────────────────────────────────────────
function evaluateRoundEnd(room: Room): {
  shouldEnd: boolean;
  winners: string[];
} {
  const players = Object.values(room.players);
  const alive = players.filter((p) => (p.health ?? 100) > 0);

  if (alive.length <= 1) {
    // 살아남은 사람이 1명이면 그 사람, 0명이면 빈 배열
    return { shouldEnd: true, winners: alive.map((p) => p.id) };
  }

  // 팀전인 경우: 살아남은 플레이어들이 모두 같은 팀이면 종료
  const aliveTeams = new Set(alive.map((p) => p.team));
  if (aliveTeams.size === 1) {
    // 동일 팀 전원 승리
    return { shouldEnd: true, winners: alive.map((p) => p.id) };
  }

  return { shouldEnd: false, winners: [] };
}

function buildRoundResultPayload(
  room: Room
): Array<{ id: string; nickname: string; color: string; wins: number }> {
  return Object.values(room.players).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    color: p.color || "#888888",
    wins: p.wins || 0,
  }));
}

function endRound(io: Server, room: Room) {
  room.currentRound += 1;

  const payloadPlayers = buildRoundResultPayload(room);

  room.roundResults.push({
    round: room.currentRound,
    players: payloadPlayers,
  });

  // 결과 패널 표출 지시
  io.to(room.roomId).emit("round:result", {
    players: payloadPlayers,
    round: room.currentRound,
  });

  // 최종 승리 조건: 한 명이라도 wins >= 5 (팀전도 플레이어 wins로 판정)
  const isFinal = Object.values(room.players).some((p) => (p.wins || 0) >= 5);

  if (isFinal) {
    // 3초 후 최종 결과 방송 (증강 선택으로 가지 않음)
    setTimeout(() => {
      io.to(room.roomId).emit("game:final", {
        round: room.currentRound,
        players: payloadPlayers,
      });
    }, 3000);
  } else {
    // 3초 후 증강 선택 화면으로 전환 지시
    setTimeout(() => {
      io.to(room.roomId).emit("round:augment", {
        players: Object.values(room.players).map((p) => ({
          id: p.id,
          nickname: p.nickname,
          color: p.color || "#888888",
        })),
        round: room.currentRound,
      });
    }, 3000);
  }
}

// ──────────────────────────────────────────────────────────────
// HTTP
// ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, t: Date.now() }));

server.listen(4000, () => console.log("Socket.IO server on :4000"));

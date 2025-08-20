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
    };

    room.players[socket.id] = {
      id: socket.id,
      nickname: String(payload?.nickname ?? "Player"), // ✅ 저장
      team: "A",
      ready: false,
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

    // 최종 등록
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
      players: Object.values(room.players),
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

    io.to(rid).emit("game:started", {
      // ← "game:started"로 변경
      startTime: Date.now(), // ← "at" 대신 "startTime"
      room: safeRoomState(room),
      players: Object.values(room.players), // ← 플레이어 데이터 추가
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

// server.ts
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
type Team = "A" | "B";
type Status = "waiting" | "playing";

type Player = {
  id: string; // socket.id
  nickname: string;
  team?: Team;
  color?: string;
  ready: boolean;
};

type Visibility = "public" | "private";

type Room = {
  roomId: string;
  hostId: string;
  max: number;
  status: Status;
  players: Record<string, Player>;
  // 추가
  visibility: Visibility;        // 공개/비공개
  roomName: string;              // 방 이름
  gameMode: string;              // "팀전" 등
};

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
  socket.on(
    "room:create",
    (
      payload: {
        nickname: string;
        max: number;
        visibility?: Visibility;
        roomName?: string;
        gameMode?: string;
      },
      ack?: Function) => {
      const roomId = Math.random().toString(36).slice(2, 7).toUpperCase();
      const room: Room = {
        roomId,
        hostId: socket.id,
        max: Math.max(2, Math.min(16, payload.max || 8)),
        status: "waiting",
        players: {},
        // 기본값 지정
        visibility: payload.visibility ?? "public",
        roomName: (payload.roomName ?? "").trim() || "ROOM",
        gameMode: (payload.gameMode ?? "").trim() || "팀전",
      };
      rooms.set(roomId, room);

      const player: Player = {
        id: socket.id,
        nickname: payload.nickname?.trim() || "Player",
        ready: false,
      };

      socket.join(roomId);
      room.players[socket.id] = player;

      console.log(
        `[ROOM CREATE] ${player.nickname} (${socket.id}) -> ${roomId} (max=${room.max})`
      );

      ack?.({ ok: true, room: safeRoomState(room) });
      io.to(roomId).emit("room:update", safeRoomState(room));
    }
  );

  // 4) 방 목록: 공개방만 + 필드 포함
  socket.on("room:list", (_: {}, ack?: Function) => {
    const list = [...rooms.values()]
      .filter((r) => r.visibility === "public" && r.status === "waiting")
      .map((r) => ({
        roomId: r.roomId,
        max: r.max,
        players: Object.values(r.players),
        status: r.status,
        // 추가
        visibility: r.visibility,
        roomName: r.roomName,
        gameMode: r.gameMode,
      }));
    ack?.({ ok: true, rooms: list });
  });

  // 5) 방 정보 조회 (로비 새로고침용)
  socket.on("room:info", (payload: { roomId: string }, ack?: Function) => {
    const room = rooms.get(payload.roomId);
    if (!room) return ack?.({ ok: false, error: "NOT_FOUND" });
    ack?.({ ok: true, room: safeRoomState(room) });
  });

  // 방 참가
  socket.on(
    "room:join",
    (payload: { roomId: string; nickname: string }, ack?: Function) => {
      const room = rooms.get(payload.roomId);

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
        console.log(
          `[ROOM JOIN FAIL] ${socket.id} -> ${payload.roomId} (FULL)`
        );
        return ack?.({ ok: false, error: "FULL" });
      }

      socket.join(room.roomId);
      room.players[socket.id] = {
        id: socket.id,
        nickname: payload.nickname?.trim() || "Player",
        ready: false,
      };

      console.log(
        `[ROOM JOIN] ${payload.nickname} (${socket.id}) -> ${payload.roomId} (${Object.keys(room.players).length
        }/${room.max})`
      );

      ack?.({ ok: true, room: safeRoomState(room) });
      io.to(room.roomId).emit("room:update", safeRoomState(room));
      io.to(room.roomId).emit("player:joined", { id: socket.id });


    }
  );

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
      `[READY] ${p.nickname} (${socket.id}) -> ${rid} : ${p.ready ? "ON" : "OFF"
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
        `[SELECT] ${p.nickname} (${socket.id}) -> room ${rid} team=${p.team ?? "-"
        } color=${p.color ?? "-"}`
      );

      io.to(rid).emit("room:update", safeRoomState(room));
      ack?.({ ok: true });
    }
  );

  // 호스트만 게임 시작
  socket.on("game:start", (_: {}, ack?: Function) => {
    const rid = currentRoomIdOf(socket);
    if (!rid) return ack?.({ ok: false, error: "NO_ROOM" });
    const room = rooms.get(rid)!;
    if (room.hostId !== socket.id)
      return ack?.({ ok: false, error: "NOT_HOST" });

    room.status = "playing";
    console.log(`[GAME START] room ${rid} by host ${socket.id}`);

    io.to(rid).emit("game:start", {
      at: Date.now(),
      room: safeRoomState(room),
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
    socket
      .to(rid)
      .emit("state:shoot", { id: socket.id, ...data, t: Date.now() });
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

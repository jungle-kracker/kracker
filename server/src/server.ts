import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

// 헬스체크 엔드포인트
app.get("/", (_req, res) => res.send("OK"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // 로컬 개발 편의
});

type Player = { x: number; y: number };
const players: Record<string, Player> = {};

io.on("connection", (socket) => {
  console.log("connected:", socket.id);
  players[socket.id] = { x: 0, y: 0 };
  io.emit("stateUpdate", players);

  socket.on("move", (p: Player) => {
    players[socket.id] = p;
    io.emit("stateUpdate", players);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("stateUpdate", players);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Socket server on", PORT));
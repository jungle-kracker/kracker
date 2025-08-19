export type RoomStatus = "waiting" | "playing" | "ended";
export type PlayerSummary = { id: string; nick: string; ready: boolean };

export type RoomSummary = {
  roomId: string;                // 4~6 대문자
  hostId: string;
  maxPlayers: number;
  currentPlayers: PlayerSummary[];
  status: RoomStatus;
  createdAt: number;             // timestamp
  roomName: string;              // 표시용
  visibility: "public" | "private";
  gameMode: string;
};

export type SafeRoomPlayer = {
  id: string;
  nickname: string;
  color: string;             // ← string '#RRGGBB'
  team: 'A' | 'B';
  ready: boolean;
};

export type SafeRoomState = {
  roomId: string;
  max: number;
  status: 'waiting' | 'playing' | 'ended';
  visibility: 'public' | 'private';
  roomName: string;
  gameMode: string;
  createdAt: number;
  players: SafeRoomPlayer[];
};
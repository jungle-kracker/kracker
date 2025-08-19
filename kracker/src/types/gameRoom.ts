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
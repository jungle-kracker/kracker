import React from "react";

export interface SearchRoom {
  id: string;        // roomId
  code: string;      // 방 코드(대문자 4~6)
  isPublic: boolean; // 공개방 여부
  title?: string;    // 목록에 보일 텍스트(없으면 기본 문구)
}

interface SearchRoomPanelProps {
  rooms: SearchRoom[];                 // 전체 방 목록
  onJoinRoom?: (roomId: string) => void;
}

/** 목록 패널: border 금지, box-shadow(#909090)로 경계 */
const SearchRoomPanel: React.FC<SearchRoomPanelProps> = ({ rooms, onJoinRoom }) => {
  const publics = rooms.filter(r => r.isPublic).slice(0, 3); // 공개방 최대 3개

  return (
    <div
      style={{
        width: "max(700px, min(69.0625vw, 1326px))",
        minHeight: 520,
        borderRadius: 28,
        padding: 36,
        background: "rgba(0,0,0,0.20)",
        boxShadow: "inset 0 0 0 1px #909090",
        display: "flex",
        alignItems: publics.length ? "stretch" : "center",
        justifyContent: "center",
      }}
    >
      {publics.length === 0 ? (
        <div style={{ width: "100%", display: "grid", placeItems: "center", minHeight: 420 }}>
          <p style={{ margin: 0, fontSize: 42, color: "rgba(255,255,255,0.75)", letterSpacing: 1, fontWeight: 100}}>
            현재 방이 존재하지 않습니다
          </p>
        </div>
      ) : (
        <div style={{ width: "100%", display: "grid", gap: 24 }}>
          {publics.map(room => (
            <button
              key={room.id}
              onClick={() => onJoinRoom?.(room.id)}
              style={{
                width: "100%",
                height: 84,
                borderRadius: 20,
                background: "rgba(255,255,255,0.06)",
                boxShadow: "inset 0 0 0 1px #909090", // 경계
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 24px",
                fontSize: 28,
                color: "#FFFFFF",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {room.title ?? "함께 게임해요"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchRoomPanel;
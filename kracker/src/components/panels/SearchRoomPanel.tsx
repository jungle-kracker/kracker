import React from "react";

export interface SearchRoom {
  id: string;         // roomId
  name: string;       // ✅ 목록에 보일 방 이름(유일 표시)
  isPublic: boolean;  // 공개방 여부
  // code?: string;    // 필요하면 보관, 화면에는 쓰지 않음
}

interface SearchRoomPanelProps {
  rooms: SearchRoom[];               // 전체 목록(비공개 포함 가능)
  onJoinRoom?: (roomId: string) => void;
}

const EDGE = "#909090";

const SearchRoomPanel: React.FC<SearchRoomPanelProps> = ({ rooms, onJoinRoom }) => {
  // ✅ 무조건 공개방만 + 최대 3개
  const publics = rooms.filter(r => r.isPublic).slice(0, 3);

  return (
    <div
      style={{
        width: "max(760px, min(62.5vw, 1100px))",
        
        borderRadius: 36,
        padding: "60px 65px",
        background: "#1A181F",
        boxShadow: `inset 0 0 0 2px ${EDGE}`, // border 금지, box-shadow만
        display: "block",
        alignItems: publics.length ? "stretch" : "center",
        justifyContent: "center",
      }}
    >
      {publics.length === 0 ? (
        <div style={{ width: "100%", display: "grid", placeItems: "center", minHeight: 420 }}>
          <p style={{ margin: 0, fontSize: 42, color: "rgba(255,255,255,0.75)", letterSpacing: 1, fontWeight: 100 }}>
            현재 방이 존재하지 않습니다
          </p>
        </div>
      ) : (
        <div style={{ width: "100%", display: "grid", rowGap: 40 }}>
          {publics.map(room => (
            <button
              key={room.id}
              onClick={() => onJoinRoom?.(room.id)}
              style={{
                width: "100%",
                height: 105,
                margin: 0,
                borderRadius: 28,
                background: "#1A181F",
                boxShadow: `inset 0 0 0 2px ${EDGE}`,
                border: "none",
                cursor: "pointer",

                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                padding: "0 48px",

                color: "#fff",
                fontSize: 30,
                fontWeight: 300,
                WebkitTapHighlightColor: "transparent",

                transition: "background .25s ease, box-shadow .25s ease, transform .08s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.boxShadow = `inset 0 0 0 2px rgba(255,255,255,.92)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "#1A181F";
                e.currentTarget.style.boxShadow = `inset 0 0 0 2px ${EDGE}`;
              }}
              onMouseDown={e => (e.currentTarget.style.transform = "translateY(1px)")}
              onMouseUp={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              {room.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchRoomPanel;
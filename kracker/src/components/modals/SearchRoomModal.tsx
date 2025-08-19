// src/components/SearchRoomModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import BasicModal from "./BasicModal";
import SearchRoomPanel, { SearchRoom } from "../panels/SearchRoomPanel";
import styled from "styled-components";
import { socket } from "../../lib/socket";

interface SearchRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname?: string;
  onJoined?: (room: any) => void; // 참가 성공시 콜백
}

const SearchRoomModal: React.FC<SearchRoomModalProps> = ({
  isOpen,
  onClose,
  nickname = "Player",
  onJoined,
}) => {
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<SearchRoom[]>([]);

  const handleChange = (v: string) => {
    setCode(v.toUpperCase().replace(/\s+/g, ""));
  };

  // 코드로 참가
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code) return;

    socket.emit("room:join", { roomId: code, nickname }, (res: any) => {
      if (res.ok) {
        console.log("참가 성공", res.room);
        onJoined?.(res.room);
        onClose();
      } else {
        alert("참가 실패: " + (res.error || "알 수 없음"));
      }
    });
  };

  // 공개방 클릭 → 바로 참가 시도
  const joinRoom = (roomId: string) => {
    socket.emit("room:join", { roomId, nickname }, (res: any) => {
      if (res.ok) {
        onJoined?.(res.room);
        onClose();
      } else {
        alert("참가 실패: " + (res.error || "알 수 없음"));
      }
    });
  };

  // 방 목록 가져오기 (옵션: 서버가 room:list 제공해야함)
  useEffect(() => {
    if (!isOpen) return;
    socket.emit("room:list", {}, (res: any) => {
      if (res.ok) {
        const list = Array.isArray(res.rooms) ? res.rooms : [];

        const toBool = (v: any) => v === true || v === "true" || v === 1 || v === "1";

        const normalizeIsPublic = (r: any): boolean => {
          // 1) 문자열 visibility
          if (typeof r?.visibility === "string") {
            const s = r.visibility.toLowerCase();
            if (s === "public") return true;
            if (s === "private") return false;
          }
          // 2) 불리언/숫자/문자열로 내려오는 여러 키 지원
          if ("isPublic" in r) return toBool(r.isPublic);
          if ("public" in r) return toBool(r.public);
          if ("private" in r) return !toBool(r.private);
          if ("listed" in r) return toBool(r.listed);
          // 3) 서버가 공개방만 주는 경우를 고려해 기본 true
          return true;
        };

        const roomsNorm = list.map((r: any) => ({
          id: r.roomId ?? r.id ?? r.code ?? r.codeId ?? r._id,
          isPublic: normalizeIsPublic(r),
          name:
            r.roomName ??
            r.name ??
            r.title ??
            `방(${(r.players?.length ?? 0)}/${r.max ?? r.maxPlayers ?? "-"})`,
        }));

        // 유효 id만 남기기(조심스럽게)
        setRooms(roomsNorm.filter((x: any) => !!x.id));
      } else {
        setRooms([]);
      }
    });
  }, [isOpen]);

  const memoRooms = useMemo(
    () => (rooms && rooms.length > 0 ? rooms : []),
    [rooms]
  );

  return (
    <BasicModal isOpen={isOpen} onClose={onClose} title="게임 찾기">
      <div
        style={{
          display: "grid",
          gap: 36,
          placeItems: "center",
          width: "100%",
        }}
      >
        {/* 코드 입력 */}
        <form
          onSubmit={submit}
          style={{ width: "max(700px, min(69.0625vw, 1326px))" }}
        >
          <div
            style={{
              position: "relative",
              justifySelf: "center",
              margin: "30px 0px",
              width: "100%",
              height: 98,
              overflow: "hidden",
              background:
                "linear-gradient(90deg, rgba(0,0,0,0) 20%, rgba(255,255,255,0.97) 50%, rgba(0,0,0,0) 80%)",
            }}
          >
            <CodeInput
              value={code}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="코드를 입력하세요"
              aria-label="게임 코드 입력"
            />
          </div>
        </form>

        {/* 공개방 목록 */}
        <SearchRoomPanel rooms={memoRooms} onJoinRoom={joinRoom} />
      </div>
    </BasicModal>
  );
};

const CodeInput = styled.input`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;

   /* ✅ 브라우저 기본 외형 제거 */
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;

  /* ✅ 텍스트 렌더링 통일 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;

  text-align: center;
  font-weight: 800;
  font-size: 50px;
  letter-spacing: 2px;
  color: rgba(0, 0, 0, 1);

  &::placeholder {
    font-weight: 300;
    font-size: 36px;
    color: rgba(0, 0, 0, 0.36);
  }

  /* ✅ iOS Safari 관련 */
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;
`;

export default SearchRoomModal;

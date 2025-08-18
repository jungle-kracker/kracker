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
        // 서버에서 내려준 방 리스트를 SearchRoom[] 형식으로 매핑
        setRooms(
          res.rooms.map((r: any) => ({
            id: r.roomId,
            isPublic: true,
            name: `방(${r.players.length}/${r.max})`,
          }))
        );
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
              width: 1600,
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
`;

export default SearchRoomModal;

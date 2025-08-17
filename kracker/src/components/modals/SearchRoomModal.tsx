import React, { useEffect, useMemo, useState } from "react";
import BasicModal from "./BasicModal";
import SearchRoomPanel, { SearchRoom } from "../panels/SearchRoomPanel";
import styled from "styled-components";

interface SearchRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms?: SearchRoom[];                    // 서버에서 받은 전체 방 목록
  onSubmitCode?: (code: string) => void;   // 코드 입력 후 엔터/제출
  onJoinRoom?: (roomId: string) => void;   // 공개방 클릭
}

const SearchRoomModal: React.FC<SearchRoomModalProps> = ({
  isOpen,
  onClose,
  rooms = [],
  onSubmitCode,
  onJoinRoom,
}) => {
  const [code, setCode] = useState("");

  const demoRooms: SearchRoom[] = [
    { id: "r1",  isPublic: true,  name: "이것은 게임 방 목록을" },
    { id: "r2",  isPublic: true,  name: "보기 위해 만든 임시 데이터" },
    { id: "r3",  isPublic: true,  name: "함께 게임해요" },
  ];

  const handleChange = (v: string) => {
    // 대문자 + 공백 제거
    setCode(v.toUpperCase().replace(/\s+/g, ""));
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code) return;
    onSubmitCode?.(code);
  };

  // rooms가 바뀌어도 렌더링 최적화
  const memoRooms = useMemo(
    () => (rooms && rooms.length > 0 ? rooms : demoRooms),
    [rooms]
  );

  return (
    <BasicModal isOpen={isOpen} onClose={onClose} title="게임 찾기">
      <div style={{ display: "grid", gap: 36, placeItems: "center", width: "100%" }}>
        {/* ===== 코드 입력(양방향 선형 그라데이션) ===== */}
        <form onSubmit={submit} style={{ width: "max(700px, min(69.0625vw, 1326px))" }}>
          <div
            style={{
              position: "relative",
              justifySelf: "center",
              margin: "30px 0px",
              width: 1600,
              height: 98,
              overflow: "hidden",
              // 양끝 어둡고 중앙 밝은 금속 느낌의 양방향 그라데이션
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

        {/* ===== 공개방 목록 패널 ===== */}
        <SearchRoomPanel rooms={memoRooms} onJoinRoom={onJoinRoom} />
      </div>
    </BasicModal>
  )
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

  /* 입력 텍스트 */
  font-weight: 800;
  font-size: 50px;
  letter-spacing: 2px;
  color: rgba(0, 0, 0, 1);

  /* placeholder 전용 */
  &::placeholder {
    font-weight: 300;
    font-size: 36px;
    color: rgba(0, 0, 0, 0.36);
  }
`;

export default SearchRoomModal;
import React from "react";
import styled from "styled-components";
import BasicSelect, { OptionItem } from "../selects/BasicSelect";

export interface RoomSettingPanelProps {
  roomName: string;
  maxPlayers: number;
  gameMode: string;
  onChangeRoomName: (v: string) => void;
  onChangeMaxPlayers: (v: number) => void;
  onChangeGameMode: (v: string) => void;
  onSubmit: () => void;   // 완료
}

const RoomSettingPanel: React.FC<RoomSettingPanelProps> = ({
  roomName = "",
  maxPlayers = 0,
  gameMode = "",
  onChangeRoomName,
  onChangeMaxPlayers,
  onChangeGameMode,
  onSubmit,
}) => {
  const roomNameError = roomName.trim() ? "" : "방 제목을 입력해주세요";
  const maxPlayersError = maxPlayers >= 2 ? "" : "최대 인원을 선택해주세요";
  const gameModeError = gameMode ? "" : "게임 모드를 선택해주세요";
  const isValid = !roomNameError && !maxPlayersError && !gameModeError;

  // 1920x1080 디자인 기준 폭(= 모달 상단 divider 길이 비율과 동일)
  const containerWidth = "max(700px, min(69.0625vw, 1326px))";

  // 게임 모드 예시 옵션 (props 변경 없이 내부 기본값 제공)
  const modeOptions: OptionItem[] =
    ["개인전", "팀전"].map(m => ({ value: m, label: m }));

  const playerOptions: OptionItem[] =
    Array.from({ length: 5 }, (_, i) => i + 2).map(n => ({ value: String(n), label: String(n) }));

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!isValid) return; //유효할 때만 진행
        onSubmit();
      }}
      style={{
        width: containerWidth,
        display: "grid",
        rowGap: 28,                 // 섹션 간 충분한 간격
        justifyItems: "stretch",
      }}
    >
      {/* 방 제목 */}
      <Field>
        <Label>방 제목</Label>
        <InputWrapper>
          <FieldInput
            $error={!!roomNameError}
            aria-invalid={!!roomNameError}
            aria-describedby={roomNameError ? "roomNameErr" : undefined}
            value={roomName}
            onChange={(e) => onChangeRoomName(e.target.value)}
            placeholder="제목을 입력해주세요"
          />
        </InputWrapper>
      </Field>

      {/* 최대 인원: 셀렉트(2~6) + 커스텀 화살표 */}
      <Field>
        <Label>최대 인원</Label>
        <InputWrapper>
          <BasicSelect
            value={maxPlayers >= 2 ? String(maxPlayers) : ""}
            onChange={(v) => onChangeMaxPlayers(parseInt(v, 10))}
            options={playerOptions}
            placeholder="최대 인원을 설정해주세요"
            invalid={!!maxPlayersError}
            errorId="maxPlayersErr"
          />
        </InputWrapper>
      </Field>

      {/* 게임 모드: 셀렉트 + 커스텀 화살표 */}
      <Field>
        <Label>게임 모드</Label>
        <InputWrapper>
          <BasicSelect
            value={gameMode}
            onChange={(v) => onChangeGameMode(v)}
            options={modeOptions}
            placeholder="게임 모드를 선택해주세요"
            invalid={!!gameModeError}
            errorId="gameModeErr"
          />
        </InputWrapper>
      </Field>

      {/* 액션 */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
        <button
          type="submit"
          disabled={!isValid}
          aria-disabled={!isValid}
          style={{
            ...primaryBtnStyle,
            opacity: isValid ? 1 : 0.45,
            color: isValid ? '#ffffffff' : '#8f8f8f',
            cursor: isValid ? "pointer" : "not-allowed",
          }}
        >
          완료
        </button>
      </div>
    </form >
  );
};

export default RoomSettingPanel;

/* ---------- 작은 파츠 컴포넌트 ---------- */

const Field: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "grid", rowGap: 10 }}>{children}</div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontSize: 48, fontWeight: 300, color: "#fff" }}>{children}</span>
);

const InputWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "relative",
      width: "100%",
    }}
  >
    {children}
  </div>
);

// 버튼
const baseBtn: React.CSSProperties = {
  minWidth: 180,
  height: 80,
  padding: "0 28px",
  borderRadius: 24,
  cursor: "pointer",
  fontSize: 50,
};

const primaryBtnStyle: React.CSSProperties = {
  ...baseBtn,
  border: "none",
  background: "rgba(255,255,255,0)",
  color: "#8F8F8F",
  fontWeight: 800,
};

const FieldInput = styled.input<{ $error?: boolean }>`
  width: 100%;
  height: 84px;
  padding: 0 0 0 28px;
  box-sizing: border-box;
  border: none;
  border-radius: 28px;
  background: rgba(0,0,0,0.25);
  color: #909090;
  font-size: 24px;
  outline: none;

  /* 기본/에러 박스섀도우 */
  box-shadow: ${({ $error }) =>
    $error
      ? "0 0 0 3px rgba(255,71,87,0.3), 0 10px 28px rgba(0,0,0,0.35)" // error red
      : "0 0 0 2px rgba(255,255,255,0.25), 0 10px 28px rgba(0,0,0,0.35)"};

  &::placeholder { color: rgba(255,255,255,0.6); transition: color .2s; }

  /* hover/focus 시에도 에러면 빨강 유지, 아니면 흰 강조 */
  &:hover {
    box-shadow: ${({ $error }) =>
    $error
      ? "0 0 0 3px rgba(255,71,87,0.3), 0 12px 32px rgba(0,0,0,0.45)"
      : "0 0 0 2px rgba(255,255,255,1), 0 12px 32px rgba(0,0,0,0.45)"};
    color: #fff;
  }
  &:focus {
    box-shadow: ${({ $error }) =>
    $error
      ? "0 0 0 4px rgba(255,71,87,0.3), 0 12px 36px rgba(0,0,0,0.5)"
      : "0 0 0 3px rgba(255,255,255,1), 0 12px 36px rgba(0,0,0,0.5)"};
    color: #fff;
  }
`;
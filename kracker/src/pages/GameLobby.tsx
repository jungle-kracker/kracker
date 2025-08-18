import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

import BgBase from "../assets/images/titleBackground.svg";

import BackButton from "../components/buttons/BackButton";
import ActionButton from "../components/buttons/ActionButton";
import PlayerCard from "../components/cards/PlayerCard";
import { PLAYER_CONSTANTS } from "../game/config/GameConstants";
import ColorSelectModal from "../components/modals/ColorSelectModal";

// ===== 모드 설정 =====
const IS_TEAM_MODE = true;       // 팀전/개인전 전환용 (추후 룸 데이터에 연동)
const NUM_TEAMS = IS_TEAM_MODE ? 2 : 0; // 3v3 => 2팀, 개인전 => 0이면 드롭다운 숨김

const toCssHex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
// ===== 더미 플레이어 (team을 숫자로) =====
type Player = { id: string; team: number; name: string; color: string };

const initialPlayers: Player[] = [
  { id: "p1", team: 1, name: "진짜로",    color: toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.빨간색.primary) },
  { id: "p2", team: 1, name: "코딩이",    color: toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.주황색.primary) },
  { id: "p3", team: 1, name: "너무어려워요", color: toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.초록색.primary) },
  { id: "p4", team: 2, name: "매일밤을",  color: toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.파란색.primary) },
  { id: "p5", team: 2, name: "새고있어요", color: toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.보라색.primary) },
  { id: "p6", team: 2, name: "다들화이팅", color: toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.핑크색.primary) },
];

interface GameLobbyProps {
  roomCode?: string;
  onExit?: () => void;
}

const GameLobby: React.FC<GameLobbyProps> = ({ roomCode = "ABCDEFGH", onExit }) => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { room?: any } };
  
  const [selected, setSelected] = useState<Player | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [room, setRoom] = useState<any>(location.state?.room ?? null);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);

  const applyPlayerChange = (next: Player) => {
    setPlayers(prev => prev.map(p => (p.id === next.id ? next : p)));
  };

  const openColorPicker = (p: Player) => {
    setSelected(p);
    setModalOpen(true);
  };

  useEffect(() => {
    if (!room) {
      const cached = sessionStorage.getItem("room:last");
      if (cached) {
        try { setRoom(JSON.parse(cached)); } catch { /* noop */ }
      }
    }
  }, [room]);

  const codeToShow = room?.roomId ?? roomCode;

  const handleTeamChange = (id: string, nextTeam: number) => {
    if (NUM_TEAMS < 2) return; // 개인전이면 무시
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, team: nextTeam } : p));
  };

  return (
    <Wrap>
      <TitleSection>
        <TextBackButton onClick={onExit ?? (() => navigate("/"))} aria-label="나가기">나가기</TextBackButton>
        <TitleBox>
          <Label>방 코드</Label>
          <Code>{codeToShow}</Code>
        </TitleBox>
      </TitleSection>

      {/*색상 선택 모달 구현위치*/}
      {modalOpen && (
        <ColorSelectModal
          open={modalOpen}
          player={selected}
          numTeams={NUM_TEAMS}
          onClose={() => setModalOpen(false)}
          onConfirm={(next) => applyPlayerChange(next)}
        />
      )}

      <OuterCard>
        <SlotGrid>
          {players.slice(0, 3).map((p) => (
            <PlayerCard
              key={p.id}
              name={p.name}
              team={p.team}
              numTeams={NUM_TEAMS}
              onTeamChange={(n) => handleTeamChange(p.id, n)}
              onCardClick={() => openColorPicker(p)}
            />
          ))}
        </SlotGrid>
        <InnerDivider />
        <SlotGrid>
          {players.slice(3, 6).map((p) => (
            <PlayerCard
              key={p.id}
              name={p.name}
              team={p.team}
              numTeams={NUM_TEAMS}
              onTeamChange={(n) => handleTeamChange(p.id, n)}
              onCardClick={() => openColorPicker(p)}
            />
          ))}
        </SlotGrid>
      </OuterCard>

      <ActionButton>시작하기</ActionButton>
    </Wrap>
  );
};

export default GameLobby;

/* ================= styles (기존 그대로) ================ */

const Wrap = styled.main`
  min-height: 100vh;
  background: #090731;
  display: flex;
  flex-direction: column;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: url(${BgBase}) center/cover no-repeat;
    opacity: 0.1;
  }
`;

const TitleSection = styled.header`
  position: relative;
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: 40px clamp(24px, 5vw, 64px);
`;

const TextBackButton = styled(BackButton)`
  position: absolute;
  left: clamp(24px, 5vw, 64px);
  top: 50%;
  transform: translateY(-50%);
  width: 175px;
  height: 60px;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  margin-left: 80px;
  background: transparent;
  border: none;
  border-radius: 0;
  cursor: pointer;
  color: #8f8f8f;
  font-family: "Apple SD Gothic Neo", sans-serif;
  font-size: 40px;
  font-weight: 300;
  letter-spacing: -0.2px;
  &:hover { color: #fff; }
  &:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,0.45); border-radius: 8px; }
`;

const TitleBox = styled.div`
  display: grid;
  justify-items: center;
  row-gap: 8px;
`;

const Label = styled.span`
  font-size: 32px;
  font-weight: 300;
  margin: 20px 0 -10px;
  color: rgba(255,255,255,0.85);
`;

const Code = styled.h2`
  margin: 0;
  font-weight: 900;
  letter-spacing: 2px;
  color: #fff;
  font-size: 100px;
  line-height: 1;
`;

const OuterCard = styled.section`
  width: max(700px, min(69.0625vw, 1326px));
  margin: -10px auto 20px;
  padding: clamp(24px, 4vh, 40px) clamp(24px, 4vw, 44px);
  background: rgba(255,255,255,0.08);
  border: 2px solid rgba(255,255,255,0.25);
  border-radius: 36px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.45);
`;

const SlotGrid = styled.div`
  display: grid;
  justify-items: center;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(60px, 2.6vw, 60px);
  padding: 8px 0;
`;

const InnerDivider = styled.hr`
  margin: clamp(20px, 3vh, 36px) 100px;
  border: 0;
  height: 2px;
  background: rgba(255,255,255,0.35);
`;

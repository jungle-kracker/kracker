import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

import BgBase from "../assets/images/titleBackground.svg";

import { RoomSummary } from "../types/gameRoom";
import BackButton from "../components/buttons/BackButton";
import ActionButton from "../components/buttons/ActionButton";
import PlayerCard from "../components/cards/PlayerCard";
import { PLAYER_CONSTANTS } from "../game/config/GameConstants";
import ColorSelectModal from "../components/modals/ColorSelectModal";
import { socket } from './../lib/socket';

const toCssHex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

// ✔ ColorSelectModal과 호환되도록 color는 항상 string
type Player = { id: string; team: number; name: string; color: string };

interface GameLobbyProps {
  roomCode?: string;
  onExit?: () => void;
}

const GameLobby: React.FC<GameLobbyProps> = ({ roomCode = "", onExit }) => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { room?: RoomSummary } };

  const [selected, setSelected] = useState<Player | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [room, setRoom] = useState<RoomSummary | null>(location.state?.room ?? null);

  const DEFAULT_SKIN = "#888888";

  const [myId, setMyId] = useState<string | null>(socket.id ?? null);

  //닉네임
  const getSavedNickname = () =>
    (localStorage.getItem("userNickname") || "").trim();

  const isMe = (pid: string | null | undefined) => !!pid && pid === myId;

  // 네비게이션 state로 전달된 players를 string color로 정규화하여 초기화
  const [players, setPlayers] = useState<Player[]>(
    () =>
      (location.state?.room as any)?.players?.map((p: any) => ({
        id: String(p.id),
        team: typeof p.team === "number" ? p.team : 1,
        name: p.nickname ?? p.name ?? "Player",
        color:
          typeof p.color === "string" && p.color.length > 0
            ? p.color
            : DEFAULT_SKIN,
      })) ?? []
  );

  const normalizeHex = (s: string) => {
    const t = s.startsWith('#') ? s.slice(1) : s;
    return `#${t.toUpperCase()}`;
  };

  const handleColorConfirm = (next: Player) => {
    if (!room?.roomId) return;

    // 1) 낙관적 업데이트 (바로 보이게)
    const hex = normalizeHex(next.color);
    setPlayers(prev => prev.map(p => (p.id === next.id ? { ...p, color: hex } : p)));

    // 2) 서버에 반영
    socket.emit("player:setColor", { roomId: room.roomId, color: hex }, (res: any) => {
      if (!res?.ok) {
        // 실패 시 서버 권위 상태로 리셋
        fetchRoomInfo();
        alert(
          res?.error === "COLOR_TAKEN" ? "이미 사용 중인 색입니다." :
            res?.error === "INVALID_COLOR" ? "잘못된 색 형식입니다. (#RRGGBB)" :
              "색 변경에 실패했습니다."
        );
      } else {
        // 성공 후에도 서버 상태로 한번 더 확정 (레이스 방지)
        fetchRoomInfo();
      }
    });
  };

  // 공통 정규화 함수(서버 응답/이벤트 수신 시 사용)
  const normalizePlayer = useCallback((p: any): Player => {
    const toNumTeam = (t: any) => {
      if (typeof t === "number") return t;
      if (t === "A") return 1;
      if (t === "B") return 2;
      return 1;
    };
    return {
      id: String(p.id),
      team: toNumTeam(p.team),
      name: p.nickname ?? p.name ?? "Player",
      color:
        typeof p.color === "string" && p.color.length > 0
          ? p.color
          : DEFAULT_SKIN,
    };
  }, []);

  // 팀전 여부
  const isTeamMode = room?.gameMode ? room.gameMode === "팀전" : true;
  const NUM_TEAMS = isTeamMode ? 2 : 0;
  const TEAM_CAP = 3;

  const codeToShow = room?.roomId ?? roomCode;

  // 팀 인원 카운트 및 과밀 체크
  const teamCounts = useMemo(() => {
    const acc: Record<number, number> = {};
    for (const p of players) acc[p.team] = (acc[p.team] ?? 0) + 1;
    return acc;
  }, [players]);

  const overCapacity = isTeamMode && Object.values(teamCounts).some((c) => c > TEAM_CAP);

  const allColored =
    players.length > 0 &&
    players.every((p) => typeof p.color === "string" && p.color.length > 0 && p.color !== DEFAULT_SKIN);

  // ===== 새로고침(서버 재조회) 함수 =====
  const fetchRoomInfo = useCallback(() => {
    const id = room?.roomId;
    if (!id) return;
    socket.emit("room:info", { roomId: id }, (res: any) => {
      if (res?.ok && res.room) {
        setRoom((prev) => ({ ...(prev ?? {}), ...res.room }));
        setPlayers((res.room.players ?? []).map(normalizePlayer));
      }
    });
  }, [room?.roomId, normalizePlayer]);

  useEffect(() => {
    if (!room?.roomId || !myId) return;
    const nick = getSavedNickname();
    if (!nick) return;

    const me = players.find(p => p.id === myId);
    if (!me || me.name === nick) return;

    socket.emit(
      "player:setNickname",
      { roomId: room.roomId, nickname: nick },
      (res: any) => {
        if (res?.ok) fetchRoomInfo(); // 서버 권위 상태로 재싱크
      }
    );
  }, [room?.roomId, myId, players, fetchRoomInfo]);

  const applyPlayerChange = (next: Player) => {
    setPlayers(prev => prev.map(p => (p.id === next.id ? next : p)));
  };

  const openColorPicker = (p: Player) => {
    setSelected(p);
    setModalOpen(true);
  };

  const team1Players = useMemo(
    () => (NUM_TEAMS >= 2 ? players.filter(p => p.team === 1) : players),
    [players, NUM_TEAMS]
  );
  const team2Players = useMemo(
    () => (NUM_TEAMS >= 2 ? players.filter(p => p.team === 2) : []),
    [players, NUM_TEAMS]
  );

  // 로비 진입 시 room 캐시/복원
  useEffect(() => {
    if (!room) {
      const cached = sessionStorage.getItem("room:last");
      if (cached) {
        try {
          setRoom(JSON.parse(cached));
        } catch { }
      }
    } else {
      sessionStorage.setItem("room:last", JSON.stringify(room));
    }
  }, [room]);

  // 최초 동기화 + 소켓 이벤트 수신 시 자동 새로고침
  useEffect(() => {
    if (!room?.roomId) return;

    // 최초 한번 상태 싱크
    fetchRoomInfo();

    // payload 기반의 빠른 업데이트(낙관적)
    const onUpdate = (payload: any) => {
      const list = payload?.players ?? payload?.room?.players;
      if (list) {
        setPlayers(list.map(normalizePlayer));
      }
    };

    // 새 플레이어 접속/퇴장 시에는 권위 상태를 다시 조회(= "새로고침")
    const onJoinedOrLeft = () => {
      fetchRoomInfo();
    };

    socket.on("room:update", onUpdate);
    socket.on("player:updated", onUpdate);

    socket.on("player:joined", onJoinedOrLeft);
    socket.on("player:left", onJoinedOrLeft);

    return () => {
      socket.off("room:update", onUpdate);
      socket.off("player:updated", onUpdate);
      socket.off("player:joined", onJoinedOrLeft);
      socket.off("player:left", onJoinedOrLeft);
    };
  }, [room?.roomId, fetchRoomInfo, normalizePlayer]);

  const handleTeamChange = (id: string, nextTeam: number) => {
    if (NUM_TEAMS < 2) return; // 개인전이면 무시
    if (id !== myId) return;

    const me = players.find(p => p.id === id);
    if (!me) return;

    // 이미 같은 팀이면 무시
    if (me.team === nextTeam) return;

    // 팀 정원 체크 (예: 3명)
    const nextCount = teamCounts[nextTeam] ?? 0;
    if (nextCount >= TEAM_CAP) {
      alert(`${nextTeam}팀은 최대 ${TEAM_CAP}명까지 가능합니다.`);
      return;
    }

    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, team: nextTeam } : p)));
    // 필요 시 서버에도 반영: 

    socket.emit("player:setTeam", { roomId: room?.roomId, playerId: id, team: nextTeam === 1 ? "A" : "B" })
  };

  const handleExit = () => {
    socket.emit("room:leave", {}, () => {
      sessionStorage.removeItem("room:last");
      navigate("/");
    });
  };

  useEffect(() => {
    const onClosed = () => {
      alert("방이 종료되었습니다.");
      sessionStorage.removeItem("room:last");
      navigate("/");
    };
    socket.on("room:closed", onClosed);
    return () => {
      socket.off("room:closed", onClosed);
    };
  }, [navigate]);

  const handleGameStart = () => {
    navigate('/game');
  }

  const isDisabled = overCapacity || !allColored;

  // ===== blockedColors: 반드시 string[]로 보장 =====
  const blockedColors = useMemo(
    () => players.map((p) => p.color).filter((c): c is string => typeof c === "string" && c.length > 0),
    [players]
  );

  return (
    <Wrap>
      <TitleSection>
        <TextBackButton onClick={handleExit} aria-label="나가기">나가기</TextBackButton>

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
          onConfirm={handleColorConfirm}
          blockedColors={selected ? blockedColors.filter((c) => c !== selected.color) : blockedColors}
        />
      )}

      <OuterCard>
        {NUM_TEAMS >= 2 ? (
          <>
            <SlotGrid>
              {team1Players.map((p) => (
                <PlayerCard
                  key={p.id}
                  name={p.name}
                  team={p.team}
                  numTeams={NUM_TEAMS}
                  editable={p.id === myId}
                  onTeamChange={p.id === myId ? (n) => handleTeamChange(p.id, n) : undefined}
                  onCardClick={p.id === myId ? () => openColorPicker(p) : undefined}
                  playerColor={p.color}
                />
              ))}
            </SlotGrid>

            <InnerDivider />

            <SlotGrid>
              {team2Players.map((p) => (
                <PlayerCard
                  key={p.id}
                  name={p.name}
                  team={p.team}
                  numTeams={NUM_TEAMS}
                  editable={p.id === myId}
                  onTeamChange={p.id === myId ? (n) => handleTeamChange(p.id, n) : undefined}
                  onCardClick={p.id === myId ? () => openColorPicker(p) : undefined}
                  playerColor={p.color}
                />
              ))}
            </SlotGrid>
          </>
        ) : (
          // 개인전 등 팀전이 아닐 때는 기존 형태 유지(원하면 제거 가능)
          <>
            <SlotGrid>
              {players.slice(0, 3).map((p) => (
                <PlayerCard
                  key={p.id}
                  name={p.name}
                  team={p.team}
                  numTeams={NUM_TEAMS}
                  editable={p.id === myId}
                 onTeamChange={p.id === myId ? (n) => handleTeamChange(p.id, n) : undefined}
                  onCardClick={p.id === myId ? () => openColorPicker(p) : undefined}
                  playerColor={p.color}
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
                  editable={p.id === myId}
                  onTeamChange={p.id === myId ? (n) => handleTeamChange(p.id, n) : undefined}
                  onCardClick={p.id === myId ? () => openColorPicker(p) : undefined}
                  playerColor={p.color}
                />
              ))}
            </SlotGrid>
          </>
        )}
      </OuterCard>

      <ActionButton
        disabled={isDisabled}
        onClick={handleGameStart} // '/game'으로 이동
        style={{
          opacity: isDisabled ? 0.45 : 1,
          color: isDisabled ? '#8f8f8f' : '#ffffff',
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
      >
        시작하기
      </ActionButton>
    </Wrap >
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
    pointer-events: none;
  }
`;

const TitleSection = styled.header`
  position: relative;
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: 10px clamp(24px, 5vw, 64px);
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
  margin: 0 0 10px 0;
  font-weight: 900;
  letter-spacing: 2px;
  color: #fff;
  font-size: 80px;
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

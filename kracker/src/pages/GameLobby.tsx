import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import BackButton from "../components/buttons/BackButton";
import ActionButton from "../components/buttons/ActionButton";

interface GameLobbyProps {
  roomCode?: string;
  onExit?: () => void;
}

const GameLobby: React.FC<GameLobbyProps> = ({ roomCode = "ABCDEFGH", onExit }) => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { room?: any } };
  const room = location.state?.room;

  const codeToShow = room?.roomId ?? roomCode;

  return (
    <Wrap>
      {/* === 모달과 동일한 헤더 패턴 === */}
      <TitleSection>
        {/* 좌측: 텍스트형 '나가기' (absolute) */}
        <TextBackButton onClick={onExit ?? (()=>navigate("/"))} aria-label="나가기">나가기</TextBackButton>

        {/* 중앙: 방 코드 라벨/값 */}
        <TitleBox>
          <Label>방 코드</Label>
          <Code>{codeToShow}</Code>
        </TitleBox>
      </TitleSection>

      {/* === 본문: 큰 카드(외곽 + 디바이더만) === */}
      <OuterCard>
        <RowSpace />  {/* 위 슬롯 자리만 확보 */}
        <InnerDivider />
        <RowSpace />  {/* 아래 슬롯 자리만 확보 */}
      </OuterCard>

      <ActionButton >
        시작하기
      </ActionButton>
    </Wrap>
  );
};

export default GameLobby;

/* ================= styles ================ */

const Wrap = styled.main`
  min-height: 100vh;
  background: #0b0a18; /* 배경 생략 */
  display: flex;
  flex-direction: column;
`;

/* 모달 헤더와 동일한 구조: relative 컨테이너 + absolute BackButton + 중앙 그리드 */
const TitleSection = styled.header`
  position: relative;
  display: grid;
  place-items: center;       /* 중앙 정렬 */
  min-height: 120px;         /* 모달 타이틀 높이 */
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
  &:focus-visible { 
  outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,0.45); 
  border-radius: 8px; 
  }
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

const RowSpace = styled.div`
  height: clamp(160px, 24vh, 260px); /* 내부 슬롯 자리를 위한 공간만 */
`;

const InnerDivider = styled.hr`
  margin: clamp(20px, 3vh, 36px) 100px;
  border: 0;
  height: 2px;
  background: rgba(255,255,255,0.35);
`;
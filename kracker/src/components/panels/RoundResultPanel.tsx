import React, { useEffect, useMemo } from "react";
import styled, { keyframes, css } from "styled-components";

export type PlayerRoundResult = {
  id: string;
  nickname: string;
  color: string; // e.g. "#FF4D4D"
  wins: number; // 0~5
};

export interface RoundResultPanelProps {
  players: PlayerRoundResult[];
  maxWins?: number; // default 5
  onComplete?: () => void; // 모든 애니메이션 종료 콜백
  /** 각 점 등장 간격(ms). 왼쪽→오른쪽 순차 등장 */
  stepDelayMs?: number; // default 140
  /** 각 점의 애니메이션 지속(ms) */
  dotDurationMs?: number; // default 260
}

const PanelRoot = styled.div`
  width: max(700px, min(69.0625vw, 1326px));
  display: grid;
  row-gap: 36px;
  justify-items: center; /* 중앙 정렬 */
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: 40px;
`;

const Nick = styled.div`
  font-weight: 800;
  font-size: clamp(28px, 4.5vw, 72px);
  line-height: 1;
  color: #ffffff;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
`;

const Dots = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: center;
  align-items: center;
  column-gap: clamp(16px, 2.2vw, 44px);
`;

const popIn = keyframes`
  0% { transform: scale(0.4); opacity: 0; filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
  60% { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

const Dot = styled.div<{
  $filled: boolean;
  $color: string;
  $delay: number;
  $duration: number;
}>`
  width: clamp(18px, 2.6vw, 36px);
  height: clamp(18px, 2.6vw, 36px);
  border-radius: 9999px;
  background: ${({ $filled, $color }) => ($filled ? $color : "rgba(255,255,255,0.82)")};
  opacity: ${({ $filled }) => ($filled ? 0 : 0.5)};
  transform: ${({ $filled }) => ($filled ? "scale(0.4)" : "scale(1)")};
  animation: ${({ $filled, $duration }) =>
    $filled
      ? css`${popIn} ${$duration}ms cubic-bezier(.2,.9,.22,1)`
      : "none"};
  animation-fill-mode: forwards;
  animation-delay: ${({ $delay }) => `${$delay}ms`};
`;

const RoundResultPanel: React.FC<RoundResultPanelProps> = ({
  players,
  maxWins = 5,
  onComplete,
  stepDelayMs = 140,
  dotDurationMs = 260,
}) => {
  // 각 플레이어의 최종 애니메이션 종료시간 계산 (가장 늦게 끝나는 시간을 onComplete로 알림)
  const totalAnimationMs = useMemo(() => {
    let maxMs = 0;
    players.forEach((p) => {
      const filledCount = Math.max(0, Math.min(maxWins, p.wins));
      if (filledCount === 0) return;
      const lastIndex = filledCount - 1;
      const end = lastIndex * stepDelayMs + dotDurationMs;
      if (end > maxMs) maxMs = end;
    });
    return maxMs;
  }, [players, maxWins, stepDelayMs, dotDurationMs]);

  useEffect(() => {
    if (!onComplete) return;
    const timer = setTimeout(() => onComplete(), totalAnimationMs || 0);
    return () => clearTimeout(timer);
  }, [onComplete, totalAnimationMs]);

  return (
    <PanelRoot>
      {players.map((p) => {
        const safeWins = Math.max(0, Math.min(maxWins, p.wins));
        return (
          <Row key={p.id}>
            <Nick style={{ color: p.color }}>{p.nickname}</Nick>
            <Dots>
              {new Array(maxWins).fill(null).map((_, i) => {
                const filled = i < safeWins;
                const delay = filled ? i * stepDelayMs : 0;
                return (
                  <Dot
                    key={`${p.id}-${i}-${filled ? "on" : "off"}`}
                    $filled={filled}
                    $color={p.color}
                    $delay={delay}
                    $duration={dotDurationMs}
                    aria-hidden
                    title={filled ? `${i + 1}/${maxWins}` : undefined}
                  />
                );
              })}
            </Dots>
          </Row>
        );
      })}
    </PanelRoot>
  );
};

export default RoundResultPanel;



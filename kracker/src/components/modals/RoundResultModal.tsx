import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import RoundResultPanel, { PlayerRoundResult } from "../panels/RoundResultPanel";
import AugmentSelectModal from "./AugmentSelectModal";

export interface RoundResultModalProps {
  isOpen: boolean;
  title?: string; // 기본: "결과"
  players: PlayerRoundResult[]; // 현재 라운드까지 누적 승수
  onClose: () => void;
  /** 패널 내 점 애니메이션 종료 후 자동 닫힘까지 대기(ms). 기본 3000 */
  autoCloseAfterMs?: number;
}

const RoundResultModal: React.FC<RoundResultModalProps> = ({
  isOpen,
  title = "결과",
  players,
  onClose,
  autoCloseAfterMs = 3000,
}) => {
  const [panelDone, setPanelDone] = useState(false);
  // ★ 임시 조절용 로컬 상태 (테스트용)
  const [localPlayers, setLocalPlayers] = useState<PlayerRoundResult[]>(players);
  const [augmentOpen, setAugmentOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  // 바디 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // props로 받은 players 변화를 로컬 상태에 반영
  useEffect(() => {
    setLocalPlayers(players);
  }, [players]);

  // 패널 애니메이션 종료 이후 auto-close
  useEffect(() => {
    if (!isOpen || !panelDone) return;
    const t = setTimeout(() => {
      onClose();
      setAugmentOpen(true);
    }, autoCloseAfterMs);
    return () => clearTimeout(t);
  }, [isOpen, panelDone, autoCloseAfterMs, onClose]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal
      aria-labelledby="round-result-title"
      style={{
        position: "fixed",
        inset: 0,
        width: "100dvw",
        height: "100dvh",
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        zIndex: 1000,
        color: "#fff",
        touchAction: "none",
        opacity: isAnimating ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    >
      {/* Title 섹션 (뒤로가기 버튼 없음) */}
      <div style={{ display: "grid", gridTemplateRows: "auto auto", rowGap: 8, paddingTop: 8, marginTop: 20 }}>
        <div style={{ position: "relative", display: "grid", placeItems: "center", padding: "0 16px", minHeight: 120 }}>
          <h2
            id="round-result-title"
            style={{
              margin: 0,
              fontWeight: 800,
              fontSize: 90,
              lineHeight: 1,
              textAlign: "center",
              textShadow: "0 1px 1px rgba(0,0,0,0.25)",
              letterSpacing: "-0.5px",
            }}
          >
            {title}
          </h2>
        </div>
        <div style={{ width: "69.0625vw", maxWidth: "100%", height: 1, margin: "0 auto", background: "rgba(255,255,255,1)" }} />
      </div>

      {/* Content: 결과 패널 */}
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ display: "grid", placeItems: "center", paddingBottom: 40, rowGap: 20 }}>
          <RoundResultPanel players={localPlayers} onComplete={() => setPanelDone(true)} />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RoundResultModal;



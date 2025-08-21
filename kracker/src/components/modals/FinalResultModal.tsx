import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";

export interface FinalResultModalProps {
  isOpen: boolean;
  result?: "WIN" | "LOSE";
  onClose: () => void;
  // 🆕 최종 결과 판단을 위한 내 승리 스택 전달 (선택)
  myWins?: number;
}

const FinalResultModal: React.FC<FinalResultModalProps> = ({ isOpen, result, onClose, myWins }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  const derivedResult = useMemo<"WIN" | "LOSE">(() => {
    if (result) return result;
    if (typeof myWins === "number") return myWins >= 5 ? "WIN" : "LOSE";
    // 기본값: 패배로 처리
    return "LOSE";
  }, [result, myWins]);

  const handleClose = () => {
    setIsAnimating(false);
    onClose();
    navigate("/", { replace: true });
  };

  if (!isOpen) return null;
  
  return ReactDOM.createPortal(
    <div
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "rgba(0, 0, 0, 0.85)",
        color: "#fff",
        zIndex: 1200,
        cursor: "pointer",
        opacity: isAnimating ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 120, fontWeight: 900, letterSpacing: 8 }}>{derivedResult}</div>
        <div style={{ fontSize: 16, opacity: 0.7, marginTop: 16 }}>클릭하여 방에서 나가기</div>
      </div>
    </div>,
    document.body
  );
};

export default FinalResultModal;



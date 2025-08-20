import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";

export interface FinalResultModalProps {
  isOpen: boolean;
  result: "WIN" | "LOSE";
  onClose: () => void;
}

const FinalResultModal: React.FC<FinalResultModalProps> = ({ isOpen, result, onClose }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    // 바로 다른 페이지로 이동 (트랜지션 없이)
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
        background: "linear-gradient(180deg, #000000 0%, #0b0a2c 100%)",
        color: "#fff",
        zIndex: 1200,
        cursor: "pointer",
        transform: isAnimating ? "translateX(0)" : "translateX(100%)",
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 120, fontWeight: 900, letterSpacing: 8 }}>{result}</div>
        <div style={{ fontSize: 16, opacity: 0.7, marginTop: 16 }}>클릭하여 방에서 나가기</div>
      </div>
    </div>,
    document.body
  );
};

export default FinalResultModal;



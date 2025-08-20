import React, { useEffect, useState } from "react";
import BasicModal from "./BasicModal";

interface LoadingModalProps {
  isOpen: boolean;
  onClose?: (() => void) | undefined;
  currentPlayers: number;
  expectedPlayers: number;
  roomName: string;
}

const LoadingModal: React.FC<LoadingModalProps> = ({
  isOpen,
  onClose,
  currentPlayers,
  expectedPlayers,
  roomName,
}) => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isOpen]);

  const progress = Math.min((currentPlayers / expectedPlayers) * 100, 100);
  const isReady = currentPlayers >= expectedPlayers;

  return (
    <BasicModal
      isOpen={isOpen}
      onClose={onClose || (() => {})}
      title="멀티플레이어 연결 대기"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: "20px",
          textAlign: "center",
        }}
      >
        {/* 방 이름 */}
        <h3 style={{ margin: "0 0 20px 0", color: "#4a90e2" }}>{roomName}</h3>

        {/* 로딩 애니메이션 */}
        <div style={{ marginBottom: "30px" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #4a90e2",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 20px auto",
            }}
          />
          <p style={{ margin: 0, fontSize: "16px", color: "#666" }}>
            플레이어 연결 중{dots}
          </p>
        </div>

        {/* 진행률 */}
        <div style={{ width: "100%", marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "10px",
              fontSize: "14px",
              color: "#666",
            }}
          >
            <span>
              플레이어: {currentPlayers}/{expectedPlayers}
            </span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div
            style={{
              width: "100%",
              height: "8px",
              backgroundColor: "#f0f0f0",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                backgroundColor: isReady ? "#4CAF50" : "#4a90e2",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* 상태 메시지 */}
        <div
          style={{
            padding: "15px",
            backgroundColor: isReady ? "#e8f5e8" : "#f0f8ff",
            borderRadius: "8px",
            border: `1px solid ${isReady ? "#4CAF50" : "#4a90e2"}`,
            color: isReady ? "#2e7d32" : "#4a90e2",
            fontSize: "14px",
          }}
        >
          {isReady
            ? "모든 플레이어가 연결되었습니다! 게임을 시작합니다..."
            : "다른 플레이어들의 연결을 기다리는 중입니다."}
        </div>

        {/* 플레이어 목록 시뮬레이션 */}
        <div
          style={{
            marginTop: "20px",
            fontSize: "12px",
            color: "#999",
          }}
        >
          {Array.from({ length: expectedPlayers }, (_, i) => (
            <div
              key={i}
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: i < currentPlayers ? "#4CAF50" : "#ddd",
                margin: "0 4px",
                transition: "background-color 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </BasicModal>
  );
};

export default LoadingModal;

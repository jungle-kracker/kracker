import React, { useEffect, useRef, useCallback } from "react";
import styled from "styled-components";
import GameManager from "../game/GameManager";

// ⭐ 글로우 효과가 있는 고급 크로스헤어 컴포넌트
const CrosshairCursor = () => {
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = React.useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: mousePos.x,
        top: mousePos.y,
        width: "32px",
        height: "32px",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 10000,
      }}
    >
      {/* 외부 글로우 링 */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* 메인 원형 테두리 */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "20px",
          height: "20px",
          border: "2px solid rgba(255, 255, 255, 0.9)",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: `
            0 0 5px rgba(255, 255, 255, 0.8),
            inset 0 0 5px rgba(255, 255, 255, 0.1)
          `,
        }}
      />

      {/* 중앙 점 */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "3px",
          height: "3px",
          background: "rgba(255, 255, 255, 0.9)",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 3px rgba(255, 255, 255, 0.8)",
        }}
      />

      {/* 상단 라인 */}
      <div
        style={{
          position: "absolute",
          top: "2px",
          left: "50%",
          width: "2px",
          height: "6px",
          background:
            "linear-gradient(to bottom, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.3))",
          transform: "translateX(-50%)",
          boxShadow: "0 0 3px rgba(0, 255, 255, 0.6)",
        }}
      />

      {/* 하단 라인 */}
      <div
        style={{
          position: "absolute",
          bottom: "2px",
          left: "50%",
          width: "2px",
          height: "6px",
          background:
            "linear-gradient(to top, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.3))",
          transform: "translateX(-50%)",
          boxShadow: "0 0 3px rgba(0, 255, 255, 0.6)",
        }}
      />

      {/* 좌측 라인 */}
      <div
        style={{
          position: "absolute",
          left: "2px",
          top: "50%",
          width: "6px",
          height: "2px",
          background:
            "linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.3))",
          transform: "translateY(-50%)",
          boxShadow: "0 0 3px rgba(0, 255, 255, 0.6)",
        }}
      />

      {/* 우측 라인 */}
      <div
        style={{
          position: "absolute",
          right: "2px",
          top: "50%",
          width: "6px",
          height: "2px",
          background:
            "linear-gradient(to left, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.3))",
          transform: "translateY(-50%)",
          boxShadow: "0 0 3px rgba(0, 255, 255, 0.6)",
        }}
      />
    </div>
  );
};

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  background: #0a0a0a;
  overflow: hidden;

  /* 터치 디바이스에서 스크롤 방지 */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;

  /* ⭐ 기본 커서 숨기기 (커스텀 크로스헤어 사용) */
  cursor: none;
`;

const GameCanvas = styled.div`
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  position: relative;

  /* Phaser canvas 스타일링 */
  & > canvas {
    width: 100% !important;
    height: 100% !important;
    margin: 0;
    padding: 0;
    display: block;
    background: black;

    /* 픽셀 아트가 아닌 경우 부드러운 스케일링 */
    image-rendering: auto;

    /* 터치 이벤트 최적화 */
    touch-action: manipulation;
  }
`;

const LoadingOverlay = styled.div<{ isVisible: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  font-family: Arial, sans-serif;
  z-index: 1000;

  opacity: ${(props) => (props.isVisible ? 1 : 0)};
  visibility: ${(props) => (props.isVisible ? "visible" : "hidden")};
  transition: opacity 0.3s ease-in-out;
`;

const ErrorMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 0, 0, 0.9);
  color: white;
  padding: 20px;
  border-radius: 8px;
  font-family: Arial, sans-serif;
  text-align: center;
  z-index: 1001;
  max-width: 80%;

  h3 {
    margin: 0 0 10px 0;
  }

  p {
    margin: 5px 0;
    font-size: 14px;
  }
`;

const RoundsGame: React.FC = () => {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isGameReady, setIsGameReady] = React.useState(false);

  // 게임 초기화 함수
  const initializeGame = useCallback(async () => {
    if (!gameRef.current || gameManagerRef.current) return;

    try {
      console.log("게임 초기화 시작");
      setIsLoading(true);
      setError(null);

      gameManagerRef.current = new GameManager(gameRef.current);
      await gameManagerRef.current.initialize();

      setIsGameReady(true);
      setIsLoading(false);
      console.log("게임 초기화 성공");
    } catch (error) {
      console.error("게임 초기화 실패:", error);
      setError(
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다."
      );
      setIsLoading(false);
    }
  }, []);

  // 게임 정리 함수
  const cleanupGame = useCallback(() => {
    if (gameManagerRef.current) {
      console.log("게임 정리 시작");
      gameManagerRef.current.destroy();
      gameManagerRef.current = null;
      setIsGameReady(false);
      console.log("게임 정리 완료");
    }
  }, []);

  // 컴포넌트 마운트 시 게임 초기화
  useEffect(() => {
    const timer = setTimeout(initializeGame, 100);

    return () => {
      clearTimeout(timer);
      cleanupGame();
    };
  }, [initializeGame, cleanupGame]);

  // 윈도우 포커스 이벤트 처리 (백그라운드에서 돌아올 때 게임 상태 복구)
  useEffect(() => {
    const handleFocus = () => {
      if (isGameReady && gameManagerRef.current) {
        console.log("게임 포커스 복구");
        // 필요하다면 게임 상태 복구 로직 추가
      }
    };

    const handleBlur = () => {
      if (isGameReady && gameManagerRef.current) {
        console.log("게임 포커스 잃음");
        // 필요하다면 게임 일시정지 로직 추가
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isGameReady]);

  // 페이지 가시성 변화 처리 (탭 전환 등)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("페이지가 숨겨짐");
        // 게임 일시정지 등의 로직
      } else {
        console.log("페이지가 보임");
        // 게임 재개 등의 로직
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 에러 재시도 핸들러
  const handleRetry = useCallback(() => {
    setError(null);
    cleanupGame();
    setTimeout(initializeGame, 100);
  }, [cleanupGame, initializeGame]);

  return (
    <Container>
      <GameCanvas ref={gameRef} />

      {/* ⭐ 커스텀 크로스헤어 커서 */}
      <CrosshairCursor />

      <LoadingOverlay isVisible={isLoading}>
        <div>
          <div>🎮 게임 로딩 중...</div>
          <div style={{ fontSize: "14px", marginTop: "10px", opacity: 0.7 }}>
            맵과 리소스를 불러오고 있습니다
          </div>
        </div>
      </LoadingOverlay>

      {error && (
        <ErrorMessage>
          <h3>⚠️ 게임 로드 실패</h3>
          <p>{error}</p>
          <button
            onClick={handleRetry}
            style={{
              marginTop: "15px",
              padding: "8px 16px",
              backgroundColor: "#fff",
              color: "#000",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </ErrorMessage>
      )}
    </Container>
  );
};

export default RoundsGame;

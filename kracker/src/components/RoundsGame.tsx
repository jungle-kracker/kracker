import React, { useEffect, useRef, useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import GameManager from "../game/GameManager";
import RoundResultModal from "./modals/RoundResultModal";
import FinalResultModal from "./modals/FinalResultModal";
import type { PlayerRoundResult } from "./panels/RoundResultPanel";
import AugmentSelectModal from "./modals/AugmentSelectModal";
import { socket } from "../lib/socket";
import PlayerHealthUI from "./PlayerHealthUI";


// ★ 게임 상태 타입 정의
interface GamePlayer {
  id: string;
  name: string;
  team: number;
  color: string;
  isMe: boolean;
}

interface GameState {
  players: GamePlayer[];
  room: {
    roomId: string;
    gameMode: string;
    roomName: string;
  };
  myPlayerId: string;
  startTime: number;
}

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

// ★ 플레이어 정보 표시 UI
const PlayerListUI = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 8px;
  font-family: Arial, sans-serif;
  z-index: 100;
  min-width: 200px;

  h4 {
    margin: 0 0 10px 0;
    font-size: 16px;
    color: #00ff00;
  }

  .player-item {
    display: flex;
    align-items: center;
    margin: 5px 0;
    font-size: 14px;

    .color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
      border: 1px solid rgba(255, 255, 255, 0.5);
    }

    .player-name {
      flex: 1;
    }

    .team-badge {
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 8px;
    }

    &.is-me {
      background: rgba(0, 255, 0, 0.1);
      padding: 3px 6px;
      border-radius: 4px;
      border-left: 3px solid #00ff00;
    }
  }
`;

const RoundsGame: React.FC = () => {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameManagerRef = useRef<GameManager | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isGameReady, setIsGameReady] = React.useState(false);
  const [gameState, setGameState] = React.useState<GameState | null>(null);

  // ★ 임시 라운드 결과 모달 상태
  const [showRoundModal, setShowRoundModal] = React.useState(false);
  const [roundPlayers, setRoundPlayers] = React.useState<PlayerRoundResult[]>([]);
  const [showFinalModal, setShowFinalModal] = React.useState(false);
  // ★ 현재 라운드 번호 상태
  const [currentRound, setCurrentRound] = React.useState<number | undefined>(undefined);

  // ★ 증강 선택 모달 상태
  const [isAugmentSelectModalOpen, setIsAugmentSelectModalOpen] = React.useState(false);
  const [isFinalResultModalOpen, setIsFinalResultModalOpen] = React.useState(false);

  const [playerHealthInfo, setPlayerHealthInfo] = useState<
    Array<{
      id: string;
      name: string;
      health: number;
      maxHealth: number;
      isLocalPlayer: boolean;
    }>
  >([]);

  // ★ 게임 상태 로드
  useEffect(() => {
    // 1. location.state에서 게임 상태 가져오기
    let loadedGameState = location.state as GameState | null;

    // 2. location.state가 없으면 sessionStorage에서 시도
    if (!loadedGameState) {
      try {
        const saved = sessionStorage.getItem("gameState");
        if (saved) {
          loadedGameState = JSON.parse(saved);
        }
      } catch (e) {
        console.warn("sessionStorage에서 gameState 로드 실패:", e);
      }
    }

    // 3. 게임 상태가 없으면 로비로 리다이렉트
    if (!loadedGameState) {
      console.warn("게임 상태를 찾을 수 없어 로비로 이동합니다.");
      navigate("/", { replace: true });
      return;
    }

    setGameState(loadedGameState);
    console.log("게임 상태 로드 완료:", loadedGameState);
  }, [location.state, navigate]);

  // 게임 초기화 함수
  const initializeGame = useCallback(async () => {
    if (!gameRef.current || gameManagerRef.current || !gameState) return;

    try {
      console.log("게임 초기화 시작 - 플레이어 수:", gameState.players.length);
      setIsLoading(true);
      setError(null);

      gameManagerRef.current = new GameManager(gameRef.current);
      await gameManagerRef.current.initialize();

      // ⭐ 중요: 씬이 완전히 로드될 때까지 기다리기
      const scene = gameManagerRef.current.getScene();
      if (!scene) {
        console.log("⏳ 씬 로딩 대기 중...");
        setTimeout(() => {
          const retryScene = gameManagerRef.current?.getScene();
          if (retryScene && gameState) {
            console.log("🔄 씬 준비됨, 멀티플레이어 초기화 재시도");

            const gameData = {
              players: gameState.players,
              myPlayerId: gameState.myPlayerId,
              room: gameState.room,
              startTime: gameState.startTime,
            };

            console.log("🎮 멀티플레이어 데이터 전달:", gameData);

            if (
              typeof (retryScene as any).initializeMultiplayer === "function"
            ) {
              (retryScene as any).initializeMultiplayer(gameData);
            } else {
              console.error("❌ initializeMultiplayer 함수를 찾을 수 없음");
            }
          }
        }, 500); // 500ms 후 재시도

        setIsGameReady(true);
        setIsLoading(false);
        return;
      }

      // 씬이 준비되었다면 바로 초기화
      if (scene && gameState) {
        const gameData = {
          players: gameState.players,
          myPlayerId: gameState.myPlayerId,
          room: gameState.room,
          startTime: gameState.startTime,
        };

        console.log("🎮 게임 씬에 플레이어 데이터 전달:", gameData);

        if (typeof (scene as any).initializeMultiplayer === "function") {
          (scene as any).initializeMultiplayer(gameData);
        } else {
          console.error("❌ initializeMultiplayer 함수를 찾을 수 없음");
        }
      }

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
  }, [gameState]);

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

  // 게임 상태가 로드되면 초기화
  useEffect(() => {
    if (gameState) {
      const timer = setTimeout(initializeGame, 100);
      return () => {
        clearTimeout(timer);
        cleanupGame();
      };
    }
  }, [gameState, initializeGame, cleanupGame]);

  // 윈도우 포커스 이벤트 처리
  useEffect(() => {
    const handleFocus = () => {
      if (isGameReady && gameManagerRef.current) {
        console.log("게임 포커스 복구");
      }
    };

    const handleBlur = () => {
      if (isGameReady && gameManagerRef.current) {
        console.log("게임 포커스 잃음");
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isGameReady]);

  // 페이지 가시성 변화 처리
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("페이지가 숨겨짐");
      } else {
        console.log("페이지가 보임");
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

  // ★ 로비로 돌아가기
  const handleBackToLobby = useCallback(() => {
    cleanupGame();
    sessionStorage.removeItem("gameState");
    navigate("/", { replace: true });
  }, [cleanupGame, navigate]);

  // ★ ESC 키로 로비 복귀
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const confirmExit = window.confirm(
          "게임을 종료하고 로비로 돌아가시겠습니까?"
        );
        if (confirmExit) {
          handleBackToLobby();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleBackToLobby]);

  // 서버 지시에 따른 라운드 결과/증강 선택 동기화 수신
  useEffect(() => {
    const onRoundResult = (data: { players: PlayerRoundResult[]; round: number }) => {
      setRoundPlayers(data.players);
      setShowRoundModal(true);
      // 현재 라운드 번호 저장
      setCurrentRound(data.round);
    };

    const onRoundAugment = (data: {
      players: Array<{ id: string; nickname: string; color: string }>;
      round: number;
    }) => {
      // 결과 모달 닫고 증강 선택 모달 열기
      setShowRoundModal(false);
      setIsAugmentSelectModalOpen(true);
      setCurrentRound(data.round);
    };

    const onAugmentComplete = (data: { round: number; selections: Record<string, string> }) => {
      console.log(`🎯 라운드 ${data.round} 증강 선택 완료:`, data.selections);
      // 증강 선택 완료 후 처리 (예: 다음 라운드 시작)
      setIsAugmentSelectModalOpen(false);
    };

    socket.on("round:result", onRoundResult);
    socket.on("round:augment", onRoundAugment);
    socket.on("augment:complete", onAugmentComplete);

    return () => {
      socket.off("round:result", onRoundResult);
      socket.off("round:augment", onRoundAugment);
      socket.off("augment:complete", onAugmentComplete);
    };
  }, []);

  const handleOpenFinalResult = () => {
    setShowFinalModal(true);
  };

  // 플레이어 체력 정보 업데이트
  useEffect(() => {
    if (!isGameReady || !gameManagerRef.current) return;

    const updateHealthInfo = () => {
      const scene = gameManagerRef.current?.getScene();
      if (scene && typeof (scene as any).getPlayerHealthInfo === "function") {
        const healthInfo = (scene as any).getPlayerHealthInfo();
        setPlayerHealthInfo(healthInfo);
      }
    };

    // 초기 업데이트
    updateHealthInfo();

    // 주기적 업데이트 (100ms마다)
    const interval = setInterval(updateHealthInfo, 100);

    return () => clearInterval(interval);
  }, [isGameReady]);

  return (
    <Container>
      <GameCanvas ref={gameRef} />

      {/* ⭐ 커스텀 크로스헤어 커서 */}
      <CrosshairCursor />

      {/* 플레이어 체력 UI */}
      {isGameReady && playerHealthInfo.length > 0 && (
        <PlayerHealthUI players={playerHealthInfo} />
      )}

      {/* ★ 플레이어 리스트 UI */}
      {/* {gameState && isGameReady && (
        <PlayerListUI>
          <h4>참가자 ({gameState.players.length}명)</h4>
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className={`player-item ${player.isMe ? "is-me" : ""}`}
            >
              <div
                className="color-dot"
                style={{ backgroundColor: player.color }}
              />
              <span className="player-name">
                {player.name} {player.isMe && "(나)"}
              </span>
              {gameState.room.gameMode === "팀전" && (
                <span className="team-badge">팀 {player.team}</span>
              )}
            </div>
          ))}
          <div style={{ marginTop: "10px", fontSize: "12px", color: "#888" }}>
            ESC: 로비로 돌아가기
          </div>
        </PlayerListUI>
      )} */}

      <LoadingOverlay isVisible={isLoading}>
        <div>
          <div>🎮 게임 로딩 중...</div>
          <div style={{ fontSize: "14px", marginTop: "10px", opacity: 0.7 }}>
            {gameState
              ? `${gameState.players.length}명의 플레이어와 함께 게임을 시작합니다`
              : "맵과 리소스를 불러오고 있습니다"}
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
              marginTop: "10px",
              marginRight: "10px",
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
          <button
            onClick={handleBackToLobby}
            style={{
              marginTop: "10px",
              padding: "8px 16px",
              backgroundColor: "#666",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            로비로 돌아가기
          </button>
        </ErrorMessage>
      )}

      {/* 테스트 버튼들 제거 */}
      {/* 모든 임시 테스트 버튼과 플로팅 버튼 제거 */}

      {/* ★ 최종 결과 모달 */}
      <RoundResultModal
        isOpen={showRoundModal}
        players={roundPlayers}
        onClose={() => setShowRoundModal(false)}
      />

      {/* ★ 증강 선택 모달 */}
      <AugmentSelectModal
        isOpen={isAugmentSelectModalOpen}
        players={roundPlayers.map(p => ({ id: p.id, nickname: p.nickname, color: p.color }))}
        currentRound={currentRound}
        myPlayerId={gameState?.myPlayerId}
        onClose={() => setIsAugmentSelectModalOpen(false)}
      />

      {/* ★ 최종 결과 모달 */}
      <FinalResultModal
        isOpen={isFinalResultModalOpen}
        result="WIN"
        onClose={() => setIsFinalResultModalOpen(false)}
      />
    </Container>
  );
};

export default RoundsGame;

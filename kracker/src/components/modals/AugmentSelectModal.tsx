import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import BgBase from "../../assets/images/titleBackground.svg";
import AugmentCard from "../cards/AugmentCard";
import imgDok from "../../assets/cards/독걸려랑.svg";
import imgKki from "../../assets/cards/끼얏호우.svg";
import imgFast from "../../assets/cards/빨리뽑기.svg";
import { socket } from "../../lib/socket";

export type AugmentPlayer = {
  id: string;
  nickname: string;
  color: string;
  selected?: boolean;
};

export interface AugmentSelectModalProps {
  isOpen: boolean;
  players: AugmentPlayer[]; // 전체 플레이어 목록
  onClose: () => void;
  onSelect?: (playerId: string, augmentId: string) => void;
  autoCloseWhenAll?: boolean; // 기본 true
  currentRound?: number; // 현재 라운드 번호
  myPlayerId?: string; // 현재 플레이어의 ID
}

// 사용 가능한 카드 목록
const availableCards = [
  "독걸려랑",
  "끼얏호우", 
  "빨리뽑기"
];

// 이름→이미지 경로 매핑 (정적 import로 번들 안전)
const cardImageMap: Record<string, string> = {
  "독걸려랑": imgDok,
  "끼얏호우": imgKki,
  "빨리뽑기": imgFast,
};

// 증강 데이터 (랜덤으로 3개 카드 선택)
const getRandomAugmentData = () => {
  const shuffled = [...availableCards].sort(() => 0.5 - Math.random());
  const selectedCards = shuffled.slice(0, 3);
  
  return selectedCards.map((cardName, index) => ({
    id: `augment-${index + 1}`,
    name: cardName,
    description: `${cardName}의 효과가 적용됩니다.`,
  }));
};

const AugmentSelectModal: React.FC<AugmentSelectModalProps> = ({
  isOpen,
  players,
  onClose,
  onSelect,
  autoCloseWhenAll = true,
  myPlayerId,
  currentRound,
}) => {
  const [chosenBy, setChosenBy] = useState<Record<string, string>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  
  // 모달이 열릴 때마다 랜덤으로 카드 3개 선택
  const augmentData = useMemo(() => getRandomAugmentData(), [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setChosenBy({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !autoCloseWhenAll) return;
    const allChosen = players.length > 0 && players.every((p) => chosenBy[p.id]);
    if (allChosen) {
      setTimeout(() => {
        setIsAnimating(false);
        setTimeout(onClose, 300);
      }, 400);
    }
  }, [chosenBy, players, isOpen, autoCloseWhenAll, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal
      aria-labelledby="augment-title"
      style={{
        position: "fixed",
        inset: 0,
        width: "100dvw",
        height: "100dvh",
        background: "linear-gradient(180deg, #0b0a2c 0%, #5a2f32 100%)",
        overflow: "hidden",
        color: "#fff",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        opacity: isAnimating ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    >
      {/* 배경 텍스쳐 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `url(${BgBase}) center/cover no-repeat`,
          opacity: 0.12,
          pointerEvents: "none",
        }}
      />

      {/* 상단 타이틀 */}
      <div style={{ position: "relative", display: "grid", placeItems: "center", paddingTop: 24 }}>
        <h2
          id="augment-title"
          style={{
            margin: 0,
            fontWeight: 900,
            marginTop: 50,
            fontSize: 150,
            lineHeight: 1,
            letterSpacing: -0.5,
            textAlign: "center",
          }}
        >
          선택하세요
        </h2>

        {/* 좌우 플레이어 선택 점 표시 */}
        <div
          style={{
            position: "absolute",
            top: 100,
            left: 100,
            right: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            {players
              .slice(0, Math.ceil(players.length / 2))
              .map((p) => (
                <div
                  key={p.id}
                  title={p.nickname}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: chosenBy[p.id] ? p.color : "rgba(128, 128, 128, 0.8)",
                    opacity: 0.9,
                  }}
                />
              ))}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {players
              .slice(Math.ceil(players.length / 2))
              .map((p) => (
                <div
                  key={p.id}
                  title={p.nickname}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: chosenBy[p.id] ? p.color : "rgba(128, 128, 128, 0.8)",
                    opacity: 0.9,
                  }}
                />
              ))}
          </div>
        </div>
      </div>

      {/* 원형 카드 배치 영역 */}
      <div style={{ 
        display: "flex", 
        alignItems: "flex-end", 
        justifyContent: "center",
        position: "relative",
        height: "100%",
        paddingBottom: "50px", // 하단 여백 추가
      }}>
        {/* 카드들을 세미서큘러 형태로 배치 */}
        {augmentData.map((augment, index) => {
          // 3개 카드를 세미서큘러 형태로 배치
          const angle = (index - 1) * 25; // -20도, 0도, 20도 (더 자연스럽게)
          const radius = 1100; // 원의 반지름
          const centerX = 0;
          const centerY = -1000; // 화면 하단 중앙
          
          // 카드의 중앙이 원의 둘레에 맞도록 위치 계산
          const x = centerX + radius * Math.sin(angle * Math.PI / 180);
          const y = centerY + radius * Math.cos(angle * Math.PI / 180);
          
          // 가운데 카드에만 추가 Y축 transform 적용
          const additionalY = index === 1 ? -220 : 0;
          
          return (
            <div
              key={augment.id}
              style={{
                position: "absolute",
                transform: `translate(${x}px, ${y + additionalY}px)`,
                cursor: "pointer",
                transition: "all 0.3s ease",
                // 카드의 중앙을 기준점으로 설정
                transformOrigin: "center center",
                zIndex: 1, // 기본 z-index 설정
              }}
              onClick={() => {
                if (myPlayerId && !chosenBy[myPlayerId]) {
                  setChosenBy((prev) => ({ ...prev, [myPlayerId]: augment.id }));
                  onSelect?.(myPlayerId, augment.id);
                  
                  // 서버로 증강 선택 데이터 전송
                  if (currentRound) {
                    socket.emit("augment:select", {
                      augmentId: augment.id,
                      round: currentRound,
                    }, (response: any) => {
                      if (response?.ok) {
                        console.log(`✅ 증강 선택 전송 성공: ${augment.name}`);
                      } else {
                        console.error(`❌ 증강 선택 전송 실패:`, response?.error);
                      }
                    });
                  }
                }
              }}
              onMouseEnter={(e) => {
                // 호버 시 카드가 제일 앞에 보이도록 z-index 증가
                e.currentTarget.style.zIndex = "1000";
                setHoveredCardId(augment.id);
              }}
              onMouseLeave={(e) => {
                // 원래 z-index로 복원
                e.currentTarget.style.zIndex = "1";
                setHoveredCardId(null);
              }}
            >
              {/* SVG 카드 컨테이너 */}
              <div
                style={{
                  width: "390px",
                  height: "590px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "2px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(10px)",
                  transition: "all 0.3s ease, filter 0.3s ease",
                  // 카드 자체를 회전시키되, 중앙을 기준으로 회전
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: "center center",
                  // hover된 카드가 아닌 다른 카드들에 블러 효과 적용
                  filter: hoveredCardId && hoveredCardId !== augment.id ? "blur(1px)" : "none",
                  position: "relative", // 오버레이를 위한 relative 포지션
                }}
                onMouseEnter={(e) => {
                  // 호버 시 카드가 뽑혀 올라오는 효과 (회전 유지하면서)
                  e.currentTarget.style.transform = `rotate(${angle}deg) translateY(-80px) scale(1.05)`;
                  e.currentTarget.style.boxShadow = "0 20px 40px rgba(0,0,0,0.6)";
                }}
                onMouseLeave={(e) => {
                  // 원래 위치로 복귀
                  e.currentTarget.style.transform = `rotate(${angle}deg)`;
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* 검은색 오버레이 (hover된 카드가 아닌 경우에만) */}
                {hoveredCardId && hoveredCardId !== augment.id && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.2)",
                      borderRadius: "30px",
                      zIndex: 1,
                      pointerEvents: "none",
                    }}
                  />
                )}
                <AugmentCard
                  name={augment.name}
                  description={augment.description}
                  imageUrl={cardImageMap[augment.name]}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
};

export default AugmentSelectModal;



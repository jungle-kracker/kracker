// src/components/modals/ColorSelectModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import BgBase from "../../assets/images/titleBackground.svg";
import BackButton from "../buttons/BackButton";
import { PLAYER_CONSTANTS } from "../../game/config/GameConstants";

type Player = { id: string; team: number; name: string; color: string };

interface ColorSelectModalProps {
  open: boolean;
  player: Player | null;
  numTeams?: number;
  onClose: () => void;
  onConfirm: (next: Player) => void;
  palette?: string[];
}

// 0xRRGGBB → "#RRGGBB"
const toCssHex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

const DEFAULT_PALETTE: string[] = [
  toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.빨간색.primary),
  toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.주황색.primary),
  toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.초록색.primary),
  toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.파란색.primary),
  toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.보라색.primary),
  toCssHex(PLAYER_CONSTANTS.COLOR_PRESETS.핑크색.primary),
];

// === 방향 보정/스무딩 계수 ===
// DIR_BIAS: 0(완전한 개별 추적) ~ 1(양쪽 눈이 같은 전역 방향으로 시선 고정)
const DIR_BIAS = 0.45;
const SMOOTH = 0.18; // 하이라이트 위치 보간(더 낮을수록 부드럽고 느림)

const ColorSelectModal: React.FC<ColorSelectModalProps> = ({
  open,
  player,
  numTeams = 0,
  onClose,
  onConfirm,
  palette = DEFAULT_PALETTE,
}) => {
  const safePlayer = useMemo(
    () => player ?? { id: "", team: 0, name: "", color: palette[0] },
    [player, palette]
  );
  const [picked, setPicked] = useState<string>(safePlayer.color);

  // ========= 마우스 트래킹 & 하이라이트 위치 =========
  const faceRef = useRef<HTMLDivElement>(null);
  const leftEyeRef = useRef<HTMLDivElement>(null);
  const rightEyeRef = useRef<HTMLDivElement>(null);

  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [hlL, setHlL] = useState<{ leftPct: number; topPct: number }>({ leftPct: 30, topPct: 30 });
  const [hlR, setHlR] = useState<{ leftPct: number; topPct: number }>({ leftPct: 30, topPct: 30 });

  useEffect(() => {
    if (!mouse) return;

    // 전역(얼굴 기준) 방향 벡터 계산
    let gux = 0, guy = 0; // 단위벡터
    const face = faceRef.current?.getBoundingClientRect();
    if (face) {
      const gcx = face.left + face.width / 2;
      const gcy = face.top + face.height / 2;
      const gdx = mouse.x - gcx;
      const gdy = mouse.y - gcy;
      const gl = Math.hypot(gdx, gdy) || 1;
      gux = gdx / gl;
      guy = gdy / gl;
    }

    // 각 눈의 하이라이트 목표 위치 계산
    const calc = (eyeEl: HTMLDivElement | null, prev: { leftPct: number; topPct: number }) => {
      if (!eyeEl) return prev;

      const rect = eyeEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // 하이라이트 반지름 r = (눈 가로의 1/3)/2 = w/6
      const r = rect.width / 6;

      // 타원 반경 (하이라이트가 삐져나오지 않도록 r만큼 shrink)
      const a = Math.max(1, rect.width / 2 - r);
      const b = Math.max(1, rect.height / 2 - r);

      // ① 개별 추적(eye→mouse) 좌표
      const dx = mouse.x - cx;
      const dy = mouse.y - cy;
      const denom = Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b)) || 1;
      const scaleLocal = 1 / denom;
      const hxLocal = dx * scaleLocal;
      const hyLocal = dy * scaleLocal;

      // ② 전역 방향(얼굴→mouse)을 동일하게 각 눈에 투영
      const hxGlobal = gux * a;
      const hyGlobal = guy * b;

      // ③ 방향 보정: 두 결과를 선형 보간
      const hx = (1 - DIR_BIAS) * hxLocal + DIR_BIAS * hxGlobal;
      const hy = (1 - DIR_BIAS) * hyLocal + DIR_BIAS * hyGlobal;

      // 퍼센트 좌표로 변환
      const targetLeft = ((hx + rect.width / 2) / rect.width) * 100;
      const targetTop  = ((hy + rect.height / 2) / rect.height) * 100;

      // 스무딩
      const leftPct = prev.leftPct + (targetLeft - prev.leftPct) * SMOOTH;
      const topPct  = prev.topPct  + (targetTop  - prev.topPct)  * SMOOTH;

      return { leftPct, topPct };
    };

    setHlL(prev => calc(leftEyeRef.current, prev));
    setHlR(prev => calc(rightEyeRef.current, prev));
  }, [mouse]);

  if (!open || !player) return null;

  const handleConfirm = () => {
    onConfirm({ ...safePlayer, color: picked });
    onClose();
  };

  return (
    <Overlay role="dialog" aria-modal="true" onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}>
      <TopBar>
        <TextBackButton onClick={handleConfirm} aria-label="나가기(확정)">
          나가기
        </TextBackButton>
      </TopBar>

      <PreviewWrap>
        <Palette>
          {palette.map((c) => (
            <Swatch
              key={c}
              $color={c}
              $active={picked === c}
              onClick={() => setPicked(c)}
              aria-label={`색상 ${c}`}
            />
          ))}
        </Palette>

        <Face ref={faceRef} $color={picked}>
          {/* 눈 크기/비율/위치는 기존 파일 그대로 유지 */}
          <EyeWrap ref={leftEyeRef} $side="left">
            <Pupil />
            <Highlight style={{ left: `${hlL.leftPct}%`, top: `${hlL.topPct}%` }} />
          </EyeWrap>

          <EyeWrap ref={rightEyeRef} $side="right">
            <Pupil />
            <Highlight style={{ left: `${hlR.leftPct}%`, top: `${hlR.topPct}%` }} />
          </EyeWrap>
        </Face>
      </PreviewWrap>
    </Overlay>
  );
};

export default ColorSelectModal;

/* ====== styles (UI 건드리지 않음, 네 파일 그대로) ====== */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #090731;
  display: grid;
  grid-template-rows: auto 1fr;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: url(${BgBase}) center/cover no-repeat;
    opacity: 0.1;
    pointer-events: none;
  }
`;

const TopBar = styled.div`
  position: relative;
  height: 150px;
  padding: 20px 0;
  display: grid;
  place-items: center;
`;

const TextBackButton = styled(BackButton)`
  position: absolute;
  left: clamp(24px, 5vw, 96px);
  top: clamp(24px, 6vh, 72px);
  transform: none;
  width: 175px;
  height: 60px;
  align-items: center;
  justify-content: flex-start;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #8f8f8f;
  font-size: 40px;
  font-weight: 300;

  &:hover { color: #fff; }
  &:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,255,255,0.45); border-radius: 8px; }
`;

const Palette = styled.div`
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  width: clamp(640px, 42vw, 860px);
  height: clamp(96px, 7vh, 120px);
  padding: 16px 24px;
  box-sizing: border-box;
  border-radius: 14px;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.28);
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(6px);
`;

const Swatch = styled.button<{ $color: string; $active?: boolean }>`
  width: clamp(48px, 4vw, 80px);
  height: clamp(48px, 4vw, 80px);
  border-radius: 50%;
  border: none;
  background: ${({ $color }) => $color};
  cursor: pointer;
  transition: transform .12s ease;
  &:hover { transform: translateY(-2px); }
`;

const PreviewWrap = styled.div`
  display: grid;
  place-items: center;
  padding-bottom: 24px;
`;

const Face = styled.div<{ $color: string }>`
  width: clamp(820px, 58vw, 1200px);
  aspect-ratio: 1 / 0.5;
  border-top-left-radius: 1200px;
  border-top-right-radius: 1200px;
  background: ${({ $color }) => $color};
  position: relative;
  top: 100px;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: url(${BgBase}) center/cover no-repeat;
    opacity: 0.1;
    pointer-events: none;
  }
`;

const EyeWrap = styled.div<{ $side: "left" | "right" }>`
  position: absolute;
  top: 22%;
  ${({ $side }) => ($side === "left" ? "left: 35%;" : "right: 35%;")}
  width: 5%;
  height: 25%;
  transform: translate(-50%, 0);
  pointer-events: none;
`;

const Pupil = styled.div`
  position: absolute;
  inset: 0;
  background: #000;
  border-radius: 50%;
  overflow: hidden;
`;

const Highlight = styled.div`
  position: absolute;
  width: 33%;
  height: 16.5%;
  border-radius: 50%;
  background: #fff;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 0px rgba(0,0,0,0.06);
`;
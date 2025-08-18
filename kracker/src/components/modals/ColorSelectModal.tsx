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
const DIR_BIAS = 0.45;     // 0=개별 눈만 추적, 1=전역 방향만 추적
const PIVOT_SHIFT = 0.12;  // 눈 중심에서 아래로 내릴 비율 (눈 높이 대비)
const DEADZONE = 0.08;     // 중심 데드존(타원 반경 대비 비율)
const SMOOTH = 0.20;       // 위치 스무딩 정도 (0~1)

// 원활한 가감속(중심에서 벗어날수록 더 멀리)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);

// 각도 보간(랩어라운드 대응)
const mixAngle = (a: number, b: number, t: number) => {
    let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
};

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

        // 전역(얼굴) 기준 방향 각도 계산
        let globalAngle = 0;
        const faceRect = faceRef.current?.getBoundingClientRect();
        if (faceRect) {
            const gcx = faceRect.left + faceRect.width / 2;
            const gcy = faceRect.top + faceRect.height / 2;
            globalAngle = Math.atan2(mouse.y - gcy, mouse.x - gcx);
        }

        type Pt = { leftPct: number; topPct: number };

        const calc = (eyeEl: HTMLDivElement | null, prev: Pt): Pt => {
            if (!eyeEl) return prev;

            const rect = eyeEl.getBoundingClientRect();

            // 기준점을 눈 중심에서 아래로 살짝 내림(PIVOT_SHIFT)
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2 + rect.height * PIVOT_SHIFT;

            // 하이라이트 반지름 r = (눈 가로의 1/3)/2 = w/6
            const r = rect.width / 6;

            // 하이라이트가 밖으로 나가지 않도록 r만큼 축소된 타원 반경
            const a = Math.max(1, rect.width / 2 - r);
            const b = Math.max(1, rect.height / 2 - r);

            // 로컬(해당 눈) 기준 마우스 벡터
            const dx = mouse.x - cx;
            const dy = mouse.y - cy;

            // (1) 개별 눈의 방향 각도
            const localAngle = Math.atan2(dy, dx);
            // (2) 전역(얼굴) 방향 각도
            const angle = mixAngle(localAngle, globalAngle, DIR_BIAS);

            // 보정된 단위 방향벡터
            const ux = Math.cos(angle);
            const uy = Math.sin(angle);

            // 타원 계량 거리(중심=0, 경계=1 근사)
            const radial = Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
            // 데드존 → 이징
            let frac = Math.min(1, Math.max(0, radial));
            if (frac < DEADZONE) frac = 0;
            else frac = (frac - DEADZONE) / (1 - DEADZONE);
            frac = easeOut(frac);

            // 현재 방향으로 타원 경계까지의 스케일 (경계=1)
            const boundaryScale = 1 / Math.sqrt((ux * ux) / (a * a) + (uy * uy) / (b * b));

            // 최종 목표 좌표(중심 기준)
            const hx = ux * boundaryScale * frac;
            const hy = uy * boundaryScale * frac;

            // 퍼센트 좌표로 변환
            const targetLeft = ((hx + rect.width / 2) / rect.width) * 100;
            const targetTop = ((hy + rect.height / 2) / rect.height) * 100;

            // 스무딩
            const leftPct = prev.leftPct + (targetLeft - prev.leftPct) * SMOOTH;
            const topPct = prev.topPct + (targetTop - prev.topPct) * SMOOTH;

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
  width: 32%;
  height: 16%;
  border-radius: 50%;
  background: #fff;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 0px rgba(0,0,0,0.06);
`;
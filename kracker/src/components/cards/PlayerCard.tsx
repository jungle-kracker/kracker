import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { ReactComponent as CaretIcon } from "../../assets/images/mdi_triangle.svg";

type PlayerCardProps = {
    team: number;
    numTeams: number;
    onTeamChange?: (n: number) => void;
    name: string;
    className?: string;
    onCardClick?: () => void;
};

const CARD_W = 346;
const CARD_H = 220;
const RADIUS = 30;
const BORDER = 5;

const PlayerCard: React.FC<PlayerCardProps> = ({
    team, numTeams, onTeamChange, name, className, onCardClick,
}) => {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState<number>(Math.max(0, team - 1));
    const wrapRef = useRef<HTMLDivElement>(null);

    const options = Array.from({ length: Math.max(0, numTeams) }, (_, i) => i + 1);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!wrapRef.current || wrapRef.current.contains(e.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const onKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
        if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault(); setOpen(true); return;
        }
        if (!open) return;
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
        else if (e.key === "Enter") { e.preventDefault(); selectAt(active); }
        else if (e.key === "Escape" || e.key === "Tab") { setOpen(false); }
    };

    const selectAt = (idx: number) => {
        const n = options[idx];
        if (!n) return;
        onTeamChange?.(n);
        setActive(idx);
        setOpen(false); // 선택 즉시 닫힘 → 화살표 복구
    };

    return (
        <Card
            className={className}
            aria-label={`${team ? `${team}팀` : ""} - ${name}`}
            role={onCardClick ? "button" : undefined}
            tabIndex={onCardClick ? 0 : -1}
            onClick={() => onCardClick?.()}
            onKeyDown={(e) => {                           // ✅ Enter/Space로도 동작
                if (!onCardClick) return;
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCardClick();
                }
            }}
            $clickable={!!onCardClick}
        >
            {numTeams >= 2 && (
                <TeamChip
                    onMouseDown={(e) => e.stopPropagation()} //카드 클릭 방지
                    onClick={(e) => e.stopPropagation()}     //카드 클릭 방지
                >
                    {/* 1) 진짜 select는 시각적으로 숨김(값/접근성 유지) */}
                    <NativeSelect
                        value={String(team)}
                        onChange={(e) => {
                            onTeamChange?.(parseInt(e.target.value, 10));
                            setOpen(false);
                        }}
                        aria-label="팀 선택"
                        tabIndex={-1}
                    >
                        {options.map((n) => (
                            <option key={n} value={n}>{n}팀</option>
                        ))}
                    </NativeSelect>

                    {/* 2) 보이는 칩 버튼 */}
                    <ChipButton
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        onClick={() => setOpen((o) => !o)}
                        onKeyDown={onKeyDown}
                    >
                        <ChipText>{team}팀</ChipText>
                        <ArrowIcon aria-hidden focusable="false" $open={open} />
                    </ChipButton>

                    {/* 3) 커스텀 옵션 리스트 (여기가 '옵션 리스트' 부분) */}
                    {open && (
                        <Menu role="listbox" aria-label="팀 선택">
                            {options.map((n, idx) => (
                                <MenuRow
                                    key={n}
                                    role="option"
                                    aria-selected={team === n}
                                    $selected={team === n}
                                    $active={idx === active}
                                    onMouseEnter={() => setActive(idx)}
                                    onClick={() => selectAt(idx)}
                                >
                                    {n}팀
                                </MenuRow>
                            ))}
                        </Menu>
                    )}
                </TeamChip>
            )}

            <NameBar><Name>{name}</Name></NameBar>
        </Card>
    );
};

export default PlayerCard;

/* ================= styles ================= */

const Card = styled.div<{ $clickable?: boolean }>`
  width: min(100%, ${CARD_W}px);
  aspect-ratio: ${CARD_W} / ${CARD_H};
  position: relative;
  border-radius: ${RADIUS}px;
  border: 5px solid #ffffff;
  transition: transform .12s ease, box-shadow .12s ease;

  cursor: ${(p) => (p.$clickable ? "pointer" : "default")};
  user-select: none;

  &:hover { 
  ${(p) => p.$clickable &&
        "transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,.35);"
    }
  &:focus-visible {
    outline: 3px solid rgba(255,255,255,.5);
    outline-offset: 2px;
  }
`;

/* 옵션 칩 래퍼 */
const TeamChip = styled.label`
  position: absolute;
  left: ${BORDER - 10}px;
  top: ${BORDER - 10}px;
  height: 40px;
  min-width: 112px;
  background: #fff;
  color: #9f9f9f;
  font-weight: 800;
  padding: 0;
  border-top-left-radius: ${RADIUS}px;
  border-top-right-radius: ${RADIUS}px;
  border-bottom-right-radius: ${RADIUS}px;
  display: flex;
  align-items: center;
  z-index: 10;
`;

/* 시각적으로 숨긴 실제 select (값/접근성 보존) */
const NativeSelect = styled.select`
  position: absolute !important;
  width: 1px; height: 1px; padding: 0; margin: -1px;
  clip: rect(0 0 0 0); white-space: nowrap;
  border: 0;
`;

/* 보이는 칩 버튼 */
const ChipButton = styled.button`
  position: relative;
  width: 100%; height: 100%;
  padding: 0 28px 0 14px;   /* 오른쪽 아이콘 자리 */
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px;
  background: transparent;
  color: #9f9f9f;
  font-weight: 800; font-size: 15px;
  border: 0; cursor: pointer; outline: none;

  &:focus-visible { box-shadow: 0 0 0 3px rgba(0,0,0,.1) inset; border-radius: ${RADIUS}px; }
`;

const ChipText = styled.span`
  pointer-events: none;
`;

/* 화살표 — 열면 ↓, 닫히면 ↑ */
const ArrowIcon = styled(CaretIcon) <{ $open: boolean }>`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%) rotate(${p => (p.$open ? 0 : 180)}deg);
  transition: transform .18s ease;
  width: 14px; height: 14px;
  pointer-events: none;
  & path, & polygon, & g { fill: #9f9f9f; }
`;

/* 🔹 '옵션 리스트' 스타일: 둥근 모서리 + 다크/블러 + 보더 + 호버/선택 */
const Menu = styled.div`
  position: absolute;
  left: 0; right: 0;
  top: 100%;
  border-radius: 14px;
  border-top-left-radius: 0px;
  background: rgba(15, 15, 30, 0.92);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 2px solid rgba(255, 255, 255, 100);
  box-shadow: 0 16px 40px rgba(0,0,0,.45);
  max-height: 320px;
  z-index: 11;
`;

/* 옵션 행 */
const MenuRow = styled.button<{ $active?: boolean; $selected?: boolean }>`
  width: 100%;
  padding: 12px 14px;
  text-align: left;
  background:
    ${({ $selected, $active }) =>
        $selected ? "rgba(255,255,255,0.16)" :
            $active ? "rgba(255,255,255,0.10)" : "transparent"};
  color: #e9ecf3;
  border: 0;
  cursor: pointer;
  font-size: 14px;
  letter-spacing: .2px;
  z-index: 11;

  &:hover { background: rgba(255,255,255,0.12); }
`;

const NameBar = styled.div`
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 56px;
  background: #ffffffff;
  border: none;
  border-bottom-left-radius: ${RADIUS - 10}px;
  border-bottom-right-radius: ${RADIUS - 10}px;
  display: grid; place-items: center;
  z-index: 2;
`;

const Name = styled.div`
  font-size: 20px;
  font-weight: 500;
  letter-spacing: .2px;
  color: #1a1a1a;
`;
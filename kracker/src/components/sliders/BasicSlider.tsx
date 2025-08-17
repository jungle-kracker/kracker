import React from "react";
import styled from "styled-components";

export interface BasicSliderProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;  // default 0
  max?: number;  // default 100
  step?: number; // default 1
  ariaLabel?: string;
  width?: number | string; // default "100%"
}

const BasicSlider: React.FC<BasicSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ariaLabel,
  width = "100%",
}) => {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <Wrap style={{ width }}>
      <Range
        type="range"
        role="slider"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--percent" as any]: `${percent}%` }}
      />
    </Wrap>
  );
};

export default BasicSlider;

/* ---------- styles ---------- */

const Wrap = styled.div`
  display: block;
`;

const Range = styled.input`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  background:
    linear-gradient(to right, #ffffff 0 var(--percent), rgba(255,255,255,0.2) var(--percent) 100%);
  border-radius: 2px;
  outline: none;

  /* WebKit thumb (다이아몬드 모양) */
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: #ffffff;
    border: none;
    border-radius: 2px;
    transform: rotate(45deg);
    box-shadow: 0 0 0 1px rgba(0,0,0,0.2);
    margin-top: -4px; /* 트랙 중앙 정렬 보정 (thumb/2 - track/2) */
    cursor: pointer;
  }

  /* Firefox */
  &::-moz-range-track {
    height: 8px;
    background: rgba(255,255,255,0.2);
  }
  &::-moz-range-progress {
    height: 8px;
    background: #ffffff;
  }
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #ffffff;
    border: none;
    border-radius: 2px;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.2);
    cursor: pointer;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.35);
  }
`;
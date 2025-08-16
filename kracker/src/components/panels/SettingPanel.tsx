import React from "react";
import styled from "styled-components";
import BasicSlider from "../sliders/BasicSlider";

interface SettingPanelProps {
  master: number;
  bgm: number;
  sfx: number;
  onChangeMaster: (v: number) => void;
  onChangeBgm: (v: number) => void;
  onChangeSfx: (v: number) => void;
}

const SettingPanel: React.FC<SettingPanelProps> = ({
  master, bgm, sfx,
  onChangeMaster, onChangeBgm, onChangeSfx,
}) => {
  return (
    <Container>
      <Row>
        <LabelBadge>전체 음량 설정</LabelBadge>
        <BasicSlider value={master} onChange={onChangeMaster} ariaLabel="전체 음량" />
      </Row>

      <Row>
        <LabelBadge>배경 음량 설정</LabelBadge>
        <BasicSlider value={bgm} onChange={onChangeBgm} ariaLabel="배경 음량" />
      </Row>

      <Row>
        <LabelBadge>효과음 설정</LabelBadge>
        <BasicSlider value={sfx} onChange={onChangeSfx} ariaLabel="효과음" />
      </Row>
    </Container>
  );
};

export default SettingPanel;

/* ---------- styles ---------- */

/** 1920 기준 상단 구분선 폭과 동일한 비율 */
const Container = styled.div`
  width: max(700px, min(69.0625vw, 1326px));
  display: grid;
  row-gap: 70px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 520px 1fr;
  align-items: center;
  column-gap: 64px;
`;

const LabelBadge = styled.div`
  height: 86px;
  padding: 0 78px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 44px;
  font-weight: 300;
  color: #e7eef7;

  /* 좌→우로 부드럽게 사라지는 어두운 네이비 그라데이션 */
  background: linear-gradient(90deg, rgba(27, 26, 33, 0.1) 5%, rgba(101, 133, 213, 0.6) 44.23%, rgba(27, 26, 33, 0.1) 95%);
`;
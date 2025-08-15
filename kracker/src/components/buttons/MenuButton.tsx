import React from 'react';
import styled from 'styled-components';

interface Props {
  text: string;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
}

const ButtonRow = styled.div<{ isActive: boolean }>`
  width: 100%;
  padding: 20px 0;
  text-align: center;
  cursor: pointer;
  position: relative;
  transition: background 0.3s ease;

  background: ${({ isActive }) =>
    isActive
      ? 'linear-gradient(to right, rgba(255, 0, 0, 0.3), rgba(255, 255, 255, 0), rgba(255, 0, 0, 0.3))'
      : 'transparent'};

  &:hover {
    background: linear-gradient(to right, rgba(255, 0, 0, 0.3), rgba(255, 255, 255, 0), rgba(255, 0, 0, 0.3));
  }
`;

const ButtonText = styled.span`
  font-size: 24px;
  color: white;
  user-select: none;
`;

const MenuButton: React.FC<Props> = ({ text, isActive, onHover, onLeave }) => {
  return (
    <ButtonRow
      isActive={isActive}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <ButtonText>{text}</ButtonText>
    </ButtonRow>
  );
};

export default MenuButton;
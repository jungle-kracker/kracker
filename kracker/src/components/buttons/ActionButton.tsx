import React from "react";
import styled from "styled-components";

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/** 얇은 래퍼: styled-components의 className을 반드시 전달 */
const ActionButtonBase: React.FC<ActionButtonProps> = ({
  children,
  className,
  type = "submit",
  ...rest
}) => {
  return (
    <button type={type} className={className} {...rest}>
      {children}
    </button>
  );
};

/** 원래 쓰던 primaryBtnStyle 그대로 복원 */
export const ActionButtonPrimary = styled(ActionButtonBase)`
  min-width: 180px;
  height: 80px;
  border-radius: 24px;
  cursor: pointer;
  font-size: 50px;

  /* primaryBtnStyle */
  border: none;
  background: rgba(255, 255, 255, 0);
  color: #8F8F8F;
  font-weight: 800;

  /* 시스템 기본 버튼 스타일 제거(회색 네모 방지) */
  appearance: none;
  -webkit-appearance: none;

  /* 필요 시 호버/프레스는 사용처에서 추가 */
`;

export default ActionButtonPrimary;
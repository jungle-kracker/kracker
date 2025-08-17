import React from "react";
import styled from "styled-components";

interface ConfirmButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

// 기본은 submit. 모양/아이콘/텍스트는 전부 children·style로 사용처에서 지정.
const ConfirmButton: React.FC<ConfirmButtonProps> = ({
    children,
    style,
    type = "submit",
    disabled,
    ...rest
}) => {
    return (
        <button type={type} disabled={disabled} style={style} {...rest}>
            {children}
        </button>
    );
};

export const ConfirmButtonPrimary = styled(ConfirmButton)`
  min-width: 180px;
  height: 80px;
  padding: 0 28px;
  border: none;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0);
  color: ${({ disabled }) => (disabled ? "#8f8f8f" : "#fff")};
  font-size: 50px;
  font-weight: 800;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  opacity: ${({ disabled }) => (disabled ? 0.45 : 1)};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity .2s ease, transform .06s ease, box-shadow .2s ease;

  &:hover {
    ${({ disabled }) =>
        !disabled && "transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0,0,0,0.35);"}
  }
  &:active {
    ${({ disabled }) => !disabled && "transform: translateY(0);"}
  }
`;

export default ConfirmButton;
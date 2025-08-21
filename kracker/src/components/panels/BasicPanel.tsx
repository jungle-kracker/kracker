import React from "react";
import styled from "styled-components";

/** 패널(내용 컨테이너) 공통 레이아웃 */
export interface BasicPanelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** 내용 폭. 기본: 1920에서 1326px과 같은 비율 */
  width?: string; // e.g. "max(700px, min(69.0625vw, 1326px))"
  /** 섹션(행) 사이 간격 */
  gap?: number;   // grid row-gap (px)
  /** 아이템 수평 정렬 */
  align?: "start" | "center" | "end" | "stretch";
  /** 내부 패딩 */
  padding?: number | string;
}

/** 최상위 컨테이너 */
const Root = styled.div<{
  $width: string;
  $gap: number;
  $align: string;
  $padding: string;
}>`
  width: ${({ $width }) => $width};
  margin: 0 auto;
  display: grid;
  row-gap: ${({ $gap }) => $gap}px;
  justify-items: ${({ $align }) => $align};
  align-content: start;        /* 위에서부터 쌓임 */
  padding: ${({ $padding }) => $padding};
`;

/** 한 블록(라벨+필드 등)을 위한 섹션 */
const Section = styled.div<{ $gap?: number }>`
  display: grid;
  row-gap: ${({ $gap = 10 }) => $gap}px;
`;

/** 하단 액션 영역(버튼 정렬) */
const Actions = styled.div<{ $gap?: number }>`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: ${({ $gap = 16 }) => $gap}px;
`;

const BasicPanel: React.FC<BasicPanelProps> & {
  Section: typeof Section;
  Actions: typeof Actions;
} = ({
  width = "max(700px, min(69.0625vw, 1326px))",
  gap = 28,
  align = "stretch",
  padding = 0,
  children,
  ...rest
}) => {
  return (
    <Root
      $width={width}
      $gap={gap}
      $align={align}
      $padding={typeof padding === "number" ? `${padding}px` : String(padding)}
      {...rest}
    >
      {children}
    </Root>
  );
};

BasicPanel.Section = Section;
BasicPanel.Actions = Actions;

export default BasicPanel;
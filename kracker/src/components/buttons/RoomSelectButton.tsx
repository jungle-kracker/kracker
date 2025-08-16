import React from "react";

export interface RoomSelectButtonProps {
  title: string;
  description: string;
  onClick: () => void;
  /** 아바타(원) 크기 px */
  avatarSize?: number;     // default 260
  /** 아바타와 콘텐츠 사이 여백 px */
  gutter?: number;         // default 24
  /** 콘텐츠 폭 대비 라인 비율 (0~1) */
  lineRatio?: number;      // default 0.72
  /** 라인을 살짝 위로 올리는 픽셀(음수면 위로) */
  lineOffset?: number;     // default -6
  /** 아바타 커스텀 노드(이미지 등) */
  avatarNode?: React.ReactNode;
}

const RoomSelectButton: React.FC<RoomSelectButtonProps> = ({
  title,
  description,
  onClick,
  avatarSize = 260,
  gutter = 10,
  lineRatio = 0.9,
  lineOffset = -6, // 요청: 원 중심보다 살짝 위로
  avatarNode,
}) => {
  return (
    <button type="button" onClick={onClick} style={cardStyle(avatarSize, gutter)}>
      {/* 아바타 */}
      <div style={avatarWrapperStyle(avatarSize)}>
        {avatarNode ?? <div style={defaultAvatarStyle(avatarSize)} aria-hidden />}
      </div>

      {/* 콘텐츠(제목/선/설명) */}
      <div style={contentColStyle}>
        <strong style={{ fontSize: 90, lineHeight: 1.1, marginLeft: 40 }}>{title}</strong>
        <div
          style={{
            ...dividerStyle(lineRatio),
            transform: `translateY(${lineOffset}px)`, // 살짝 위로
          }}
        />
        <span style={{ fontSize: 45, marginLeft: 40 }}>{description}</span>
      </div>
    </button>
  );
};

export default RoomSelectButton;

/* ---------- styles ---------- */

const cardStyle =
  (avatarSize: number, gutter: number): React.CSSProperties => ({
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    background: "transparent",
    border: "none",
    outline: "none",

    display: "grid",
    gridTemplateColumns: `${avatarSize + gutter}px 1fr`, // 아바타보다 넓은 첫 열
    columnGap: 0,
    alignItems: "center",

    width: "100%",
    minHeight: 140,
    padding: "24px 20px",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
  });

const avatarWrapperStyle = (size: number): React.CSSProperties => ({
  width: size,
  height: size,
  display: "grid",
  placeItems: "center",
});

const defaultAvatarStyle = (size: number): React.CSSProperties => ({
  width: size,
  height: size,
  borderRadius: "50%",
  background: "",
  border: "10px solid rgba(255,255,255,1)",
});

const contentColStyle: React.CSSProperties = {
  display: "grid",
  alignContent: "center",
  rowGap: 12,
};

const dividerStyle = (ratio: number): React.CSSProperties => ({
  height: 5,
  width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
  maxWidth: 900,
  background: "rgba(255,255,255,1)",
  borderRadius: 999,
});
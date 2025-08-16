import React from "react";
import RoomSelectButton from "../buttons/RoomSelectButton";

export type Visibility = "public" | "private";

interface RoomSelectPanelProps {
  onSelect: (v: Visibility) => void;
  /** select 영역 너비를 제목 구분선 비율(69.0625vw)에 맞추고 상한 1326px */
}

const RoomSelectPanel: React.FC<RoomSelectPanelProps> = ({
  onSelect,
}) => {
  return (
    <div style={{ width: "max(320px, min(69.0625vw, 1326px))", display: "grid", rowGap: 30 }}>
      <RoomSelectButton
        title="Public"
        description="공개된 방을 생성합니다."
        onClick={() => onSelect("public")}
        // 필요시 avatarNode로 커스텀 이미지를 넣을 수 있습니다.
      />

      <RoomSelectButton
        title="Private"
        description="방 찾기에 나타나지 않는 방을 생성합니다."
        onClick={() => onSelect("private")}
      />
    </div>
  );
};

export default RoomSelectPanel;
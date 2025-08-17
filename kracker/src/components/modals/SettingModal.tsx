import React, { useEffect, useState } from "react";
import BasicModal from "./BasicModal";
import SettingPanel from "../panels/SettingPanel";

interface SettingModalProps {
  isOpen: boolean;
  onClose: () => void;   // 최종 닫기
}

const SettingModal: React.FC<SettingModalProps> = ({ isOpen, onClose }) => {
  // 슬라이더 값 (0~100)
  const [master, setMaster] = useState(70);
  const [bgm, setBgm] = useState(55);
  const [sfx, setSfx] = useState(35);

  // 모달 열릴 때마다 마지막 값 유지 (필요시 초기화 로직 추가 가능)
  useEffect(() => {
    if (!isOpen) return;
    // 초기화가 필요하면 여기서 setMaster(70) 등 실행
  }, [isOpen]);

  return (
    <BasicModal isOpen={isOpen} onClose={onClose} title="게임 설정">
      <SettingPanel
        master={master}
        bgm={bgm}
        sfx={sfx}
        onChangeMaster={setMaster}
        onChangeBgm={setBgm}
        onChangeSfx={setSfx}
      />
    </BasicModal>
  );
};

export default SettingModal;
import React, { useEffect, useMemo, useState } from "react";
import BasicModal from "./BasicModal";

export interface SettingPayload {

}

interface SettingModalProps {
  isOpen: boolean;
  onClose: () => void;   // 최종 닫기
}

const SettingModal:React.FC<SettingModalProps> = ({}) => {
    return (
        <div></div>
    )
};

export default SettingModal;
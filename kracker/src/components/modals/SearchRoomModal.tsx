import React, { useEffect, useMemo, useState } from "react";
import BasicModal from "./BasicModal";

export interface SearchRoomPayload {

}

interface SearchRoomModalProps {
  isOpen: boolean;
  onClose: () => void;   // 최종 닫기
  onCreate?: (payload: SearchRoomPayload) => void;
}

const SearchRoomModal:React.FC<SearchRoomModalProps> = ({}) => {
    return (
        <div></div>
    )
};

export default SearchRoomModal;
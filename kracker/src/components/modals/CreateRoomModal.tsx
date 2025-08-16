// src/components/CreateRoomModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import BasicModal from "./BasicModal";
import RoomSelectPanel, { Visibility } from "../panels/RoomSelectPanel";
import RoomSettingPanel from "../panels/RoomSettingPanel";

type Step = "select" | "form";

export interface CreateRoomPayload {
  roomId: string;        // 4~6자리 대문자
  roomName: string;
  maxPlayers: number;    // 2~8
  visibility: Visibility;
  gameMode: string;
}

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;   // 최종 닫기
  onCreate?: (payload: CreateRoomPayload) => void;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [step, setStep] = useState<Step>("select");
  const [visibility, setVisibility] = useState<Visibility>("public");

  // 폼 상태 (2단계)
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [gameMode, setGameMode] = useState("");

  // 방 코드
  const roomId = useMemo(() => {
    if (!isOpen) return "";
    const len = Math.floor(Math.random() * 3) + 4; // 4~6
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return Array.from({ length: len }, () => A[Math.floor(Math.random() * A.length)]).join("");
  }, [isOpen]);

  // 모달이 다시 열릴 때 항상 1단계부터 시작
  useEffect(() => {
    if (isOpen) {
      setStep("select");
      setVisibility("public");
      setRoomName("");
      setMaxPlayers(0);
      setGameMode("");
    }
  }, [isOpen]);

  // 헤더 뒤로: 2단계→1단계, 1단계→닫기
  const guardedClose = () => {
    if (step === "form") {
      setStep("select");
      return;
    }
    onClose();
  };

  const submit = () => {
    onCreate?.({
      roomId,
      roomName: roomName.trim() || "ROOM",
      maxPlayers: Math.min(8, Math.max(2, maxPlayers)),
      visibility,
      gameMode: gameMode.trim(),
    });
    onClose();
  };

  return (
    <BasicModal isOpen={isOpen} onClose={guardedClose} title="방 만들기">
      {step === "select" ? (
        <RoomSelectPanel
          onSelect={(v) => {
            setVisibility(v);
            setStep("form");
          }}
        />
      ) : (
        <RoomSettingPanel
          roomName={roomName}
          maxPlayers={maxPlayers}
          gameMode={gameMode}
          onChangeRoomName={setRoomName}
          onChangeMaxPlayers={setMaxPlayers}
          onChangeGameMode={setGameMode}
          onSubmit={submit}
        />
      )}
    </BasicModal>
  );
};

export default CreateRoomModal;
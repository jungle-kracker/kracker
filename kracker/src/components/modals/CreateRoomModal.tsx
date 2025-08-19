// src/components/CreateRoomModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import BasicModal from "./BasicModal";
import RoomSelectPanel, { Visibility } from "../panels/RoomSelectPanel";
import RoomSettingPanel from "../panels/RoomSettingPanel";
import { socket, Ack, SafeRoomState } from "../../lib/socket";

export type PlayerSummary = { id: string; nick: string; ready: boolean }; // 기존 타입 유지해도 무방
export type RoomStatus = "waiting" | "playing" | "ended";
type Step = "select" | "form";

type RoomCreateOk = { ok: true; room: SafeRoomState };
type RoomCreateErr = { ok: false; error?: string; max?: number };
type RoomCreateAck = RoomCreateOk | RoomCreateErr;

export interface CreateRoomPayload {
  roomId: string;
  roomName: string;
  maxPlayers: number;
  currentPlayers: PlayerSummary[];
  status: RoomStatus;
  createdAt: number;
  visibility: Visibility;
  gameMode: string;
}

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (payload: CreateRoomPayload) => void;
  /** 현재 로그인/닉네임(없으면 "Player") */
  nickname?: string;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  nickname = "Player",
}) => {
  const [step, setStep] = useState<Step>("select");
  const [visibility, setVisibility] = useState<Visibility>("public");

  // 폼 상태 (2단계)
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(0);
  const [gameMode, setGameMode] = useState("");

  // 방 코드 (UI용 랜덤)
  const roomId = useMemo(() => {
    if (!isOpen) return "";
    const len = Math.floor(Math.random() * 3) + 4; // 4~6
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return Array.from(
      { length: len },
      () => A[Math.floor(Math.random() * A.length)]
    ).join("");
  }, [isOpen]);

  // 모달 재오픈 시 초기화
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

  /** 서버로 방 생성 요청 */
  const submit = () => {
    const wantMax = Math.min(8, Math.max(2, maxPlayers || 4));

    socket.emit(
      "room:create",
      {
        nickname: nickname.trim() || "Player",
        max: wantMax,
        visibility,
        roomName: roomName.trim() || "ROOM",
        gameMode: gameMode.trim() || "팀전",
      },
      (res: RoomCreateAck) => {
        // 서버 ack 처리
        if (!res || !res.ok) {
          if ((res as RoomCreateErr).error === "ROOM_LIMIT") {
            alert(`현재 방은 최대 ${(res as RoomCreateErr).max ?? 5}개까지만 생성할 수 있습니다.`);
          } else {
            alert("방 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
          }
          return;
        }

        const srv = res.room;

        // 우리 UI용 payload로 매핑
        onCreate?.({
          roomId: srv.roomId,
          roomName: roomName.trim() || "ROOM",
          maxPlayers: srv.max,
          currentPlayers: srv.players.map((p) => ({
            id: p.id,
            nick: p.nickname, // 서버 필드명: nickname
            ready: p.ready,
          })),
          status: (srv.status as RoomStatus) ?? "waiting",
          createdAt: Date.now(),
          visibility,
          gameMode: gameMode.trim(),
        });

        onClose();
      }
    );
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

import React, { useState } from "react";
import Modal from "../components/modals/BasicModal";

const RoomCreatePage: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>방 만들기</button>

      <Modal
        isOpen={open}
        title="방 만들기"
        onClose={() => setOpen(false)}
      >
        {/* 여기에 Figma에서 설계한 컨텐츠(라디오: Public/Private, 입력폼 등) */}
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label>방 제목</label>
            <input
              placeholder="예: WELCOME"
              style={{
                background: "#121216",
                color: "#e8e8ea",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>

          {/* … 추가 필드들 … */}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setOpen(false)}>취소</button>
            <button>생성</button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default RoomCreatePage;

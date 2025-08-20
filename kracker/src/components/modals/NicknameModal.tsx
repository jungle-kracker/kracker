import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";

interface NicknameModalProps {
  isOpen: boolean;
  onSubmit: (nickname: string) => void;
}

const NicknameModal: React.FC<NicknameModalProps> = ({ isOpen, onSubmit }) => {
  const [nickname, setNickname] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // 페이지 로드 시 저장된 닉네임 불러오기
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      const savedNickname = localStorage.getItem("userNickname");
      if (savedNickname) {
        setNickname(savedNickname);
      }
    }
  }, [isOpen]);

  // 바디 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // 닉네임 유효성 검사
  useEffect(() => {
    const trimmed = nickname.trim();
    setIsValid(trimmed.length > 0 && trimmed.length <= 10);
  }, [nickname]);

  const handleSubmit = () => {
    if (!isValid) return;

    const trimmedNickname = nickname.trim();
    // 로컬스토리지에 저장
    localStorage.setItem("userNickname", trimmedNickname);
    
    // 사라질 때 트랜지션 적용
    setIsAnimating(false);
    setTimeout(() => {
      onSubmit(trimmedNickname);
    }, 300);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) {
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal
      aria-labelledby="modal-title"
      style={{
        position: "fixed",
        inset: 0,
        width: "100dvw",
        height: "100dvh",
        background: "rgba(28,27,27,0.82",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        zIndex: 1000,
        color: "#fff",
        touchAction: "none",
        transform: isAnimating ? "translateX(0)" : "translateX(100%)",
        transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Title 섹션 */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto auto",
          rowGap: 8,
          paddingTop: 8,
          marginTop: 20,
        }}
      >
        {/* 제목 행 */}
        <div
          style={{
            display: "grid",
            placeItems: "center",
            padding: "0 16px",
            minHeight: 120,
            transform: "translateY(10px)",
            opacity: 1,
            transition: "transform 280ms ease",
          }}
        >
          {/* 제목 */}
          <h2
            id="modal-title"
            style={{
              margin: 0,
              fontWeight: 800,
              fontSize: 90,
              lineHeight: 1,
              textAlign: "center",
              textShadow: "0 1px 1px rgba(0,0,0,0.25)",
              letterSpacing: "-0.5px",
            }}
          >
            YOUR NAME
          </h2>
        </div>

        {/* 구분선 */}
        <div
          style={{
            width: "69.0625vw",
            maxWidth: "100%",
            height: 1,
            margin: "0 auto",
            background: "rgba(255,255,255,1)",
          }}
        />
      </div>

      {/* Content 섹션 */}
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 60,
            width: "100%",
            maxWidth: 600,
            paddingBottom: 80,
            transform: "translateY(20px)",
            transition: "transform 300ms ease",
          }}
        >
          {/* 캐릭터 이미지 영역 */}
          <div
            style={{
              width: 200,
              height: 200,
              background: "linear-gradient(135deg, #ff6b6b, #ffa8a8)",
              borderRadius: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 30px rgba(255,107,107,0.3)",
              position: "relative",
              overflow: "hidden",
              marginTop: -50,
            }}
          >
            {/* 귀여운 얼굴 */}
            <div style={{ textAlign: "center", position: "relative" }}>
              {/* 눈 */}
              <div
                style={{
                  display: "flex",
                  gap: 30,
                  justifyContent: "center",
                  marginBottom: 15,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 16,
                    background: "#000",
                    borderRadius: "50%",
                  }}
                />
                <div
                  style={{
                    width: 12,
                    height: 16,
                    background: "#000",
                    borderRadius: "50%",
                  }}
                />
              </div>
              {/* 볼 */}
              <div
                style={{
                  position: "absolute",
                  left: -25,
                  top: 10,
                  width: 20,
                  height: 20,
                  background: "#ff8a8a",
                  borderRadius: "50%",
                  opacity: 0.7,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: -25,
                  top: 10,
                  width: 20,
                  height: 20,
                  background: "#ff8a8a",
                  borderRadius: "50%",
                  opacity: 0.7,
                }}
              />
              {/* 입 */}
              <div
                style={{
                  width: 25,
                  height: 12,
                  border: "2px solid #000",
                  borderTop: "none",
                  borderRadius: "0 0 25px 25px",
                  margin: "0 auto",
                }}
              />
            </div>

            {/* 장식용 도형들 */}
            <div
              style={{
                position: "absolute",
                top: 15,
                right: 15,
                width: 30,
                height: 30,
                background: "rgba(255,255,255,0.2)",
                borderRadius: "50%",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 20,
                left: 20,
                width: 20,
                height: 20,
                background: "rgba(255,255,255,0.15)",
                borderRadius: "50%",
              }}
            />
          </div>

          {/* 입력 필드와 안내 문구 */}
          <div style={{ width: "100%", textAlign: "center" }}>
            <p
              style={{
                margin: "0 0 30px 0",
                fontSize: 24,
                color: "rgba(255,255,255,0.8)",
                fontWeight: 400,
                letterSpacing: "-0.3px",
                marginBottom: -30,
              }}
            ></p>

            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="닉네임을 입력하세요"
              maxLength={20}
              style={{
                width: "100%",
                maxWidth: 400,
                height: 70,
                fontSize: 24,
                fontWeight: 500,
                textAlign: "center",
                background: "rgba(255,255,255,0.1)",
                border: `2px solid ${
                  isValid ? "rgba(107,170,255,0.8)" : "rgba(255,255,255,0.2)"
                }`,
                borderRadius: 20,
                color: "#fff",
                padding: "0 25px",
                outline: "none",
                transition: "all 0.3s ease",
                backdropFilter: "blur(10px)",
                letterSpacing: "-0.3px",
              }}
              onFocus={(e) => {
                e.target.style.background = "rgba(255,255,255,0.15)";
                e.target.style.borderColor = "rgba(107,170,255,1)";
                e.target.style.boxShadow = "0 0 20px rgba(107,170,255,0.3)";
              }}
              onBlur={(e) => {
                e.target.style.background = "rgba(255,255,255,0.1)";
                e.target.style.borderColor = isValid
                  ? "rgba(107,170,255,0.8)"
                  : "rgba(255,255,255,0.2)";
                e.target.style.boxShadow = "none";
              }}
            />

            {/* 글자 수 표시 */}
            <p
              style={{
                margin: "10px 0 0 0",
                fontSize: 16,
                color:
                  nickname.length > 7 ? "#ffaa6b" : "rgba(255,255,255,0.5)",
                textAlign: "right",
                maxWidth: 400,
                marginLeft: "auto",
                marginRight: "auto",
                marginBottom: -30,
              }}
            >
              {nickname.length}/10
            </p>
          </div>

          {/* 입장하기 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            style={{
              width: "100%",
              maxWidth: 400,
              height: 70,
              fontSize: 28,
              fontWeight: 700,
              color: "#fff",
              background: isValid
                ? "linear-gradient(135deg, #6baeff, #4a90ff)"
                : "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: 20,
              cursor: isValid ? "pointer" : "not-allowed",
              transition: "all 0.3s ease",
              opacity: isValid ? 1 : 0.5,
              letterSpacing: "-0.5px",
              boxShadow: isValid ? "0 2px 3px rgba(107,170,255,0.3)" : "none",
            }}
            onMouseEnter={(e) => {
              if (isValid) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 2px 5px rgba(107,170,255,0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (isValid) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 2px 5px rgba(107,170,255,0.3)";
              }
            }}
            onMouseDown={(e) => {
              if (isValid) {
                e.currentTarget.style.transform = "translateY(0) scale(0.98)";
              }
            }}
            onMouseUp={(e) => {
              if (isValid) {
                e.currentTarget.style.transform = "translateY(-2px) scale(1)";
              }
            }}
          >
            입장하기
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NicknameModal;

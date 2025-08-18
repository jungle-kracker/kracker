import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import BackButton from "../buttons/BackButton";

interface BasicModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children?: React.ReactNode;
}

const BasicModal: React.FC<BasicModalProps> = ({ isOpen, title, onClose, children }) => {
    // 바디 스크롤 잠금만 유지 (오버레이/ESC로 닫기 없음)
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

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
                backgroundColor: "rgba(28,27,27,0.82)", // #1C1B1B + 82%
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                display: "grid",
                gridTemplateRows: "auto 1fr", // title 섹션 / content 섹션
                zIndex: 1000,
                color: "#fff",
                touchAction: "none",
            }}
        >
            {/* ===== Title 섹션 ===== */}
            <div
                // 1) 버튼+제목 행  2) 제목 하단 선
                style={{
                    display: "grid",
                    gridTemplateRows: "auto auto",
                    rowGap: 8,
                    paddingTop: 8,
                    marginTop: 20,
                }}
            >
                {/* (1) 버튼 + 제목 행 */}
                <div
                    style={{
                        position: "relative",
                        display: "grid",
                        placeItems: "center", // 제목을 중앙 정렬
                        padding: "0 16px",
                        minHeight: 120, // 제목(90px)과 버튼(85px)이 여유 있게 들어가도록
                    }}
                >
                    {/* 좌측 정렬 뒤로가기 버튼 (85 x 85) */}
                    <BackButton
                        onClick={onClose}
                        style={{
                            width: 85,
                            height: 85,
                            marginLeft: 30,
                        }}
                    >
                        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                                d="M15 18l-6-6 6-6"
                                stroke="#FFFFFF"
                                strokeWidth="0.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </BackButton>

                    {/* 중앙 제목 (90px) */}
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
                        {title}
                    </h2>
                </div>

                {/* (2) 제목 하단 구분선: 1920px에서 1326px → 69.0625vw */}
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

            {/* ===== Content 섹션 ===== */}
            < div
                style={{
                    width: "100%",
                    height: "100%",
                    overflow: "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center", // 내용 중앙 배치
                    padding: 0,
                    WebkitOverflowScrolling: "touch",
                }}
            >
                <div style={{ display: "grid", placeItems: "center", paddingBottom: 40 }}>{children}</div>
            </div >
        </div >,
        document.body
    );
};

export default BasicModal;
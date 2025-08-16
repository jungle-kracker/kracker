import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
interface BasicButtonProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    width?: number | string;
    maxHeight?: number | string;
}

const BasicButton: React.FC<BasicButtonProps> = ({
    isOpen,
    title,
    onClose,
    children,
    width,
    maxHeight,
}) => {

    const contentRef = useRef<HTMLDivElement>(null)

    // ESC 닫기, 스크롤 잠금
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div
            aria-modal
            role="dialog"
            aria-labelledby="modal-title"
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                // #1C1B1B with 82% opacity
                backgroundColor: "rgba(28, 27, 27, 0.82)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                ref={contentRef}
                style={{
                    width: typeof width === "number" ? `${width}px` : width,
                    maxHeight,
                    overflow: "auto",
                    background: "rgba(16,16,18,0.96)",
                    borderRadius: 12,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                    padding: "20px 24px",
                    color: "#e8e8ea",
                    border: "1px solid rgba(255,255,255,0.06)",
                    backdropFilter: "blur(4px)",
                }}
            >
                {/* 헤더 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                        onClick={onClose}
                        aria-label="닫기"
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "transparent",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                        }}
                    >
                        {/* ← 아이콘 */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M15 18l-6-6 6-6" stroke="#cfd2dc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    <h2
                        id="modal-title"
                        style={{
                            margin: 0,
                            fontWeight: 800,
                            letterSpacing: ".2px",
                            fontSize: 20,
                            color: "#ffffff",
                        }}
                    >
                        {title}
                    </h2>
                </div>

                {/* 구분선 */}
                <hr
                    style={{
                        margin: "14px 0 16px",
                        border: 0,
                        height: 1,
                        background:
                            "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.16), rgba(255,255,255,0.06))",
                    }}
                />

                {/* 바디(Children) */}
                <div>{children}</div>
            </div>
        </div>,
        document.body
    );
};

export default BasicButton;
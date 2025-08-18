import React from "react";

interface BackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    //매개변수
    children: React.ReactNode;
}

const BackButton: React.FC<BackButtonProps> = ({
    children, style, type = "button", ...rest
}) => {

    const baseStyle: React.CSSProperties = {
        position: "absolute",
        left: 12,
        top: "50%",
        transform: "translateY(-50%)",
        background: "transparent",
        border: "none",
        borderRadius: 12,
        cursor: "pointer",
        padding: 0,
        WebkitTapHighlightColor: "transparent",
        display: "grid",
        placeItems: "center",
    };

    return (
        <button
        type = {type}
            aria-label="뒤로가기"
            style={{ ...baseStyle, ...style }}
            {...rest}
        >
            {children}
        </button>
    )
}

export default BackButton;
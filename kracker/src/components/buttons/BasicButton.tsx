import React from "react";

interface BasicButtonProps {
    //매개변수
    children: React.ReactNode;
}

const BasicButton: React.FC<BasicButtonProps> = ({children}) => {
    return (
        <button>
            {children}
        </button>
    )
}

export default BasicButton;
import React from "react";

interface BasicButtonProps {
    //매개변수
    children: React.ReactNode;
}

const BasicButton: React.FC<BasicButtonProps> = ({children}) => {
    return (
        <div>
            {children}
        </div>
    )
}

export default BasicButton;
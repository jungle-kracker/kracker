import React from "react";

const Main: React.FC = () => {
    return(
        <div>
            <h1>KRACKER</h1> {/*메인 타이틀*/}
            <hr/>
            <div> {/* 버튼들 */}
                <button>
                    방 만들기
                </button>
                <button>
                    게임 찾기
                </button>
                <button>
                    게임 설정
                </button>
            </div>
        </div>
    )
}

export default Main;
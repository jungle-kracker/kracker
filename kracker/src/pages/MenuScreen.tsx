import React, { useState } from 'react';
import { useEffect } from "react";
import styled from 'styled-components';
import MenuButton from '../components/buttons/MenuButton';
import { connectSocket, disconnectSocket, socket } from '../api/socket';

const Wrapper = styled.div`
  width: 100vw;
  height: 100vh;
  background-color: #0d0d2b; // 배경 컬러
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const Title = styled.h1`
  font-size: 64px;
  font-weight: 900;
  background: linear-gradient(to right, #d4af37, #aaa, #d4af37);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 60px;
  letter-spacing: 2px;
`;

const ButtonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
  gap: 20px;
`;

const buttons = ['방 만들기', '게임 찾기', '게임 설정'];

const MenuScreen: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    connectSocket();

    socket.on("connect", () => {
      console.log("connected:", socket.id);
      // 테스트로 서버로 임의 이동 이벤트 보내보기
      socket.emit("move", { x: Math.random() * 500, y: Math.random() * 500 });
    });

    socket.on("stateUpdate", (state) => {
      console.log("stateUpdate:", state);
    });

    return () => {
      socket.off("stateUpdate");
      disconnectSocket();
    };
  }, []);

  return (
    <Wrapper>
      <Title>KRACKER</Title>
      <ButtonWrapper>
        {buttons.map((text, index) => (
          <MenuButton
            key={index}
            text={text}
            isActive={activeIndex === index}
            onHover={() => setActiveIndex(index)}
            onLeave={() => setActiveIndex(null)}
          />
        ))}
      </ButtonWrapper>
    </Wrapper>
  );
};

export default MenuScreen;
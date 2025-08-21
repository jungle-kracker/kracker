import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";

import BgBase from "../assets/images/titleBackground.svg";
import TextBase from "../assets/images/textBackground.svg";

import CreateRoomModal from "../components/modals/CreateRoomModal";
import SearchRoomModal from "../components/modals/SearchRoomModal";
import SettingModal from "../components/modals/SettingModal";

import hoverSfx from "../assets/sfx/main1.mp3";
import { useAudio } from "../providers/BgmProvider";

const Home: React.FC = () => {
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [searchRoomOpen, setsearchRoomOpen] = useState(false);
  const [SettingOpen, setSettingOpen] = useState(false);

  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);

  const navigate = useNavigate();
  const { playSfx } = useAudio();
  const nickname = localStorage.getItem("userNickname") || "Player";

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 0);
    return () => clearTimeout(t);
  }, []);

  const navigateWithFade = (to: string, state?: any) => {
    setExiting(true);
    setTimeout(() => navigate(to, state ? { state } : undefined as any), 260);
  };

  return (
    <>
      <PageTransitionOverlay $entered={entered} $exiting={exiting} />
      <PageRoot $entered={entered} $exiting={exiting} $dimmed={createRoomOpen || searchRoomOpen || SettingOpen}>
        <Background>
          <Wrap>
            <Title data-text="KRACKER">KRACKER</Title>
            <Divider />
            <Menu>
              <MenuBtn
                onMouseEnter={() => playSfx(hoverSfx)}
                onClick={() => setCreateRoomOpen(true)}
              >
                방 만들기
              </MenuBtn>

              <MenuBtn
                onMouseEnter={() => playSfx(hoverSfx)}
                onClick={() => setsearchRoomOpen(true)}
              >
                게임 찾기
              </MenuBtn>

              <MenuBtn
                onMouseEnter={() => playSfx(hoverSfx)}
                onClick={() => setSettingOpen(true)}
              >
                게임 설정
              </MenuBtn>
            </Menu>
          </Wrap>
        </Background>
      </PageRoot>

      {/* 방 만들기 → 서버 ack로 받은 room 정보로 이동 */}
      <CreateRoomModal
        isOpen={createRoomOpen}
        onClose={() => setCreateRoomOpen(false)}
        nickname={nickname}
        onCreate={(data) => {
          setCreateRoomOpen(false);
          // 방 상태 최소 정보만 들고 로비로 이동
          navigateWithFade("/lobby", {
            room: {
              roomId: data.roomId,
              maxPlayers: data.maxPlayers,
              status: data.status,
              roomName: data.roomName,
              visibility: data.visibility ?? "public",
              gameMode: data.gameMode ?? "팀전",
              players: (data.currentPlayers ?? []).map(p => ({
                id: p.id,
                nickname: p.nick ?? "Player",
                ready: p.ready,
                team: 1,
                color: undefined,
              }))
            },
          });
        }}
      />

      {/* 방 찾기 → 코드/공개방 참가 성공 시 이동 */}
      <SearchRoomModal
        isOpen={searchRoomOpen}
        onClose={() => setsearchRoomOpen(false)}
        nickname={nickname}
        onJoined={(room) => {
          setsearchRoomOpen(false);
          navigateWithFade("/lobby", {
            room: {
              roomId: room.roomId,
              maxPlayers: room.max ?? room.maxPlayers,
              status: room.status,
              roomName: room.roomName ?? room.name,
              visibility:
                room.visibility ??
                (typeof room.isPublic === "boolean"
                  ? (room.isPublic ? "public" : "private")
                  : "public"),
              gameMode: room.gameMode ?? "팀전",
              players: (room.players ?? []).map((p: any) => ({
                id: p.id,
                nickname: p.nickname ?? p.nick ?? "Player",
                ready: !!p.ready,
                team: typeof p.team === "number" ? p.team : 1,
                color: p.color,
              }))
            },
          });
        }}
      />

      <SettingModal
        isOpen={SettingOpen}
        onClose={() => setSettingOpen(false)}
      />
    </>
  );
};

export default Home;

/* ---------------- 스타일 ---------------- */

const PageRoot = styled.div<{ $entered: boolean; $exiting: boolean; $dimmed: boolean }>`
  position: relative;
  min-height: 100vh;
  opacity: ${({ $entered, $exiting }) => ($entered && !$exiting ? 1 : 0)};
  /* 홈 화면에서는 모달 오픈 시 배경 블러를 적용하지 않습니다 */
  filter: none;
  transition: opacity 260ms ease;
`;

const PageTransitionOverlay = styled.div<{ $entered: boolean; $exiting: boolean }>`
  position: fixed;
  inset: 0;
  background: #000000;
  z-index: 9999;
  opacity: ${({ $entered, $exiting }) => (!$entered || $exiting ? 1 : 0)};
  transition: opacity 260ms ease;
  pointer-events: ${({ $entered, $exiting }) => (!$entered || $exiting ? "auto" : "none")};
`;

const Background = styled.main`
  position: relative;
  background: #0b092c;
  overflow: hidden;
  height: 100vh;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: url(${BgBase}) center/cover no-repeat;
    opacity: 0.1;
  }
`;

const Wrap = styled.div`
  position: relative;
  z-index: 2;
  width: 100%;
  padding-top: clamp(48px, 8vh, 96px);
  display: grid;
  place-items: center;
  align-content: start;
  row-gap: clamp(28px, 5vh, 44px);
`;

const Title = styled.h1`
  position: relative;
  margin: 60px 0 -30px 0;
  font-family: "Krafton";
  font-weight: 900;
  text-transform: uppercase;
  font-style: normal;
  font-size: clamp(48px, 12vw, 128px);
  line-height: 1;
  color: #fff;
  display: inline-block;
  transform-origin: bottom center;
  transform: scaleY(1.2);
  will-change: transform;
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.35));

  &::before {
    content: attr(data-text);
    position: absolute;
    inset: 0;
    background-image: url(${TextBase});
    opacity: 0.6;
    background-repeat: no-repeat;
    background-position: center;
    background-size: cover;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
    pointer-events: none;
  }
`;

const Divider = styled.hr`
  width: min(1000px, 120%);
  height: 3px;
  margin-bottom: 30px;
  border: 0;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 999px;
`;

const Menu = styled.nav`
  width: 100%;
  display: grid;
  justify-items: center;
  row-gap: clamp(36px, 10vh, 80px);
  margin-top: clamp(12px, 2vh, 24px);
`;

const MenuBtn = styled.button`
  position: relative;
  display: block;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  padding: clamp(10px, 2.4vh, 22px) 0;
  text-align: center;

  background: transparent;
  border: 0;
  border-radius: 0;
  color: rgba(255, 255, 255, 0.92);
  font-size: clamp(20px, 4.2vw, 44px);
  font-weight: 100;
  cursor: pointer;
  transition: transform 0.15s ease, text-shadow 0.15s ease;
  z-index: 0;
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(255, 81, 81, 0.39) 0%,
      rgba(9, 7, 49, 0.39) 100%
    );
    opacity: 0;
    transition: opacity 0.25s ease;
    pointer-events: none;
    z-index: -1;
  }

  &:hover {
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.25);
  }
  &:hover::before {
    opacity: 1;
  }

  &:active {
    transform: translateY(0);
  }
  &:focus-visible {
    outline-offset: -2px;
  }
`;

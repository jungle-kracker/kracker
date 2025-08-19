import { useState, useEffect } from "react";
import NicknameModal from "../src/components/modals/NicknameModal";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  Router,
} from "react-router-dom";
import "./App.css";
import ModalTest from "./pages/ModalTest";
import Home from "./pages/Home";
import GameLobby from "./pages/GameLobby";
import Game from "./components/RoundsGame";
import { BgmProvider } from "./providers/BgmProvider";

function App() {
  const [showModal, setShowModal] = useState(false);

  // 페이지 로드 시 닉네임 확인
  useEffect(() => {
    const savedNickname = localStorage.getItem("userNickname");
    setShowModal(true);
  }, []);
  return (
    <BrowserRouter>
      <BgmProvider>
        <div>
          <NicknameModal
            isOpen={showModal}
            onSubmit={(nickname) => {
              console.log("닉네임:", nickname);
              setShowModal(false);
            }}
          />
        </div>
        <Routes>
          <Route path="/test" element={<ModalTest />} />
          <Route path="/" element={<Home />} />
          <Route path="/lobby" element={<GameLobby />} />
          <Route path="/game" element={<Game />} />
        </Routes>
      </BgmProvider>
    </BrowserRouter>
  );
}

export default App;

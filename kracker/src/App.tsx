import React from "react";
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
  return (
    <BrowserRouter>
      <BgmProvider>
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

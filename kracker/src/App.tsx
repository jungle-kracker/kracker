import React from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Router } from 'react-router-dom';
import './App.css';
import ModalTest from './pages/ModalTest';
import Home from './pages/Home';
import GameLobby from './pages/GameLobby';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/test' element={<ModalTest/>} />
        <Route path='/' element={<Home/>}/>
        <Route path='/lobby' element={<GameLobby/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
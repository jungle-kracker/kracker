import React from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Router } from 'react-router-dom';
import logo from './logo.svg';
import './App.css';
import Home from './pages/MenuScreen';
import MenuScreen from './pages/MenuScreen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<MenuScreen/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

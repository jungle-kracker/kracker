import React from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Router } from 'react-router-dom';
import logo from './logo.svg';
import './App.css';
import ModalTest from './pages/ModalTest';
import Home from './pages/Home';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/test' element={<ModalTest/>} />
        <Route path='/' element={<Home/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
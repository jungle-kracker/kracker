import React from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, Router } from 'react-router-dom';
import logo from './logo.svg';
import './App.css';
import ModalTest from './pages/ModalTest';
import Main from './pages/Main';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/test' element={<ModalTest/>} />
        <Route path='/' element={<Main/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

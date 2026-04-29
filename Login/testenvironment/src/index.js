import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getSession } from './App';
import Login from './Login/Login';
import Home from './Home/Home';
import Assignment from './Assignment/Assignment';

function PrivateRoute({ children }) {
  return getSession() ? children : <Navigate to="/login" replace />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/assignment" element={<PrivateRoute><Assignment /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { MyOrdersPage } from './pages/MyOrdersPage.tsx';
import { AdminLoginPage } from './pages/AdminLoginPage.tsx';
import { AdminPortalPage } from './pages/AdminPortalPage.tsx';
import { AuthModal } from './components/AuthModal.tsx';

function MainLayout() {
  const { isAuthModalOpen, isMandatoryAuth, closeAuthModal, openAuthModal } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      <Routes>
        {/* Public Routes with Main Navbar */}
        <Route
          path="/"
          element={
            <>
              <Navbar onOpenAuthModal={() => openAuthModal(true)} />
              <HomePage />
            </>
          }
        />
        <Route
          path="/orders"
          element={
            <>
              <Navbar onOpenAuthModal={() => openAuthModal(true)} />
              <MyOrdersPage />
            </>
          }
        />
        <Route
          path="/my-orders"
          element={
            <>
              <Navbar onOpenAuthModal={() => openAuthModal(true)} />
              <MyOrdersPage />
            </>
          }
        />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminPortalPage />} />
        <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Full-Screen Auth Modal with Mandatory Lock Support */}
      <AuthModal
        isOpen={isAuthModalOpen}
        isMandatory={isMandatoryAuth}
        onClose={closeAuthModal}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}

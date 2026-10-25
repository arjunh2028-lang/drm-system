import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import LoginPortalHub from './pages/LoginPortalHub';
import CreatorLogin from './pages/CreatorLogin';
import BuyerLogin from './pages/BuyerLogin';
import ModeratorLogin from './pages/ModeratorLogin';
import Register from './pages/Register';

import Dashboard from './pages/Dashboard';
import Marketplace from './pages/Marketplace';
import ModeratorOverview from './pages/ModeratorOverview';
import MyContent from './pages/MyContent';
import Upload from './pages/Upload';
import ContentDetails from './pages/ContentDetails';
import AccessibleContent from './pages/AccessibleContent';
import History from './pages/History';

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Three distinct login portals + Main Gateway */}
      <Route path="/login" element={<LoginPortalHub />} />
      <Route path="/login/creator" element={<CreatorLogin />} />
      <Route path="/login/buyer" element={<BuyerLogin />} />
      <Route path="/login/moderator" element={<ModeratorLogin />} />

      {/* Account Registration with role support */}
      <Route path="/register" element={<Register />} />
      <Route path="/register/creator" element={<Register />} />
      <Route path="/register/buyer" element={<Register />} />
      <Route path="/register/moderator" element={<Register />} />

      {/* Protected DRM application pages */}
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/marketplace" element={<Protected><Marketplace /></Protected>} />
      <Route path="/moderator" element={<Protected><ModeratorOverview /></Protected>} />
      <Route path="/my-content" element={<Protected><MyContent /></Protected>} />
      <Route path="/upload" element={<Protected><Upload /></Protected>} />
      <Route path="/accessible" element={<Protected><AccessibleContent /></Protected>} />
      <Route path="/history" element={<Protected><History /></Protected>} />
      <Route path="/content/:id" element={<Protected><ContentDetails /></Protected>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

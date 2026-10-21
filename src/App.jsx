import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { FeedbackProvider } from './context/FeedbackContext';
import AccessRoute from './components/routes/AccessRoute';
import AdminRoute from './components/routes/AdminRoute';
import Home from './pages/Home/Home';
import Login from './pages/Login/Login';
import Repository from './pages/Repository/Repository';
import DocumentosAdmin from './pages/Admin/DocumentosAdmin';
import UsuariosAdmin from './pages/Admin/UsuariosAdmin';
import Register from './pages/Register/Register';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FeedbackProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Register />} />

            <Route
              path="/"
              element={
                <AccessRoute>
                  <Home />
                </AccessRoute>
              }
            />

            <Route
              path="/pops"
              element={
                <AccessRoute>
                  <Repository />
                </AccessRoute>
              }
            />

            <Route path="/repositorio" element={<Navigate to="/pops" replace />} />

            <Route path="/admin" element={<Navigate to="/admin/documentos" replace />} />

            <Route
              path="/admin/documentos"
              element={
                <AdminRoute>
                  <DocumentosAdmin />
                </AdminRoute>
              }
            />

            <Route
              path="/admin/usuarios"
              element={
                <AdminRoute>
                  <UsuariosAdmin />
                </AdminRoute>
              }
            />

            <Route path="/admin/pops" element={<Navigate to="/admin/documentos" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </FeedbackProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.js';
import Eleves from './pages/Eleves.js';
import ImportEleves from './pages/ImportEleves.js';
import Classes from './pages/Classes.js';
import Notes from './pages/Notes.js';
import Layout from './components/Layout.js';
import './index.css';

const queryClient = new QueryClient();

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/eleves" element={
                <ProtectedRoute>
                  <Layout>
                    <Eleves />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/import-eleves" element={
                <ProtectedRoute>
                  <Layout>
                    <ImportEleves />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/classes" element={
                <ProtectedRoute>
                  <Layout>
                    <Classes />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/notes" element={
                <ProtectedRoute>
                  <Layout>
                    <Notes />
                  </Layout>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';

// Loading screen
const LoadingScreen = () => (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: '1rem', background: 'var(--bg-primary)'
  }}>
    <div className="spinner" style={{ width: 40, height: 40, borderWidth: '3px' }} />
    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
      ShopMesh
    </div>
  </div>
);

// Protected route
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return children;
};

// Public only route (redirect if logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/products" replace />;
  return children;
};

// App layout with Navbar
const AppLayout = ({ children }) => (
  <div className="app-wrapper">
    <Navbar />
    {children}
  </div>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/products" replace />} />
    <Route
      path="/auth"
      element={
        <PublicRoute>
          <AuthPage />
        </PublicRoute>
      }
    />
    <Route
      path="/products"
      element={
        <PrivateRoute>
          <AppLayout>
            <ProductsPage />
          </AppLayout>
        </PrivateRoute>
      }
    />
    <Route
      path="/orders"
      element={
        <PrivateRoute>
          <AppLayout>
            <OrdersPage />
          </AppLayout>
        </PrivateRoute>
      }
    />
    <Route path="*" element={<Navigate to="/products" replace />} />
  </Routes>
);

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <CartProvider>
        <AppRoutes />
      </CartProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;

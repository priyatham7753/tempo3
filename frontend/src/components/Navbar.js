import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <nav className="navbar" role="navigation">
      <NavLink to="/" className="navbar-brand">ShopMesh</NavLink>
      <div className="navbar-links">
        <NavLink to="/products" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-products">
          Products
        </NavLink>
        <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} id="nav-orders">
          Orders {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
        </NavLink>
      </div>
      {user && (
        <div className="nav-user">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{user.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customer</span>
          </div>
          <div className="nav-avatar" title={user.name}>{getInitials(user.name)}</div>
          <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.25rem' }}></div>
          <button className="btn-logout" onClick={logout} id="logout-btn">Log out</button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

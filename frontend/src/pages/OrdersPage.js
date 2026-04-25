import React, { useState, useEffect } from 'react';
import { orderAPI } from '../services/api';

const STATUS_CLASSES = {
  pending: 'status-pending',
  confirmed: 'status-confirmed',
  shipped: 'status-shipped',
  delivered: 'status-delivered',
  cancelled: 'status-cancelled',
};

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await orderAPI.getMyOrders();

      console.log("ORDERS RESPONSE:", res.data); // 🔍 debug

      let data = res.data;

      // ✅ Normalize response safely (handles all backend formats)
      if (Array.isArray(data)) {
        setOrders(data);
      } else if (Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else if (Array.isArray(data.data)) {
        setOrders(data.data);
      } else {
        setOrders([]);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to load orders. Please check that the order service is running.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleCancel = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(orderId);
    try {
      await orderAPI.updateStatus(orderId, 'cancelled');
      setOrders(prev =>
        prev.map(o =>
          o.id === orderId ? { ...o, status: 'cancelled' } : o
        )
      );
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel order');
    } finally {
      setCancelling(null);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="main-content">
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">View and manage your purchase history.</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={fetchOrders}
          id="refresh-orders-btn"
        >
          Refresh Orders
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="orders-list">
          {[1, 2, 3].map(i => (
            <div key={i} className="order-card">
              <div className="order-header" style={{ marginBottom: '1rem' }}>
                <div>
                  <div className="skeleton skeleton-title" style={{ width: '120px', height: '1.25rem', marginBottom: '0.25rem' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '150px' }}></div>
                </div>
                <div className="skeleton" style={{ width: '80px', height: '24px', borderRadius: '12px' }}></div>
              </div>
              <div style={{ paddingBottom: '1rem' }}>
                <div className="skeleton skeleton-text" style={{ width: '100%', marginBottom: '0.5rem' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
              </div>
              <div className="order-total" style={{ marginTop: '0' }}>
                <div className="skeleton skeleton-text" style={{ width: '80px', margin: 0 }}></div>
                <div className="skeleton skeleton-title" style={{ width: '60px', height: '1.5rem', margin: 0 }}></div>
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>No orders yet</h3>
          <p>When you place an order, it will appear here.</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div>
                  <div className="order-id">
                    Order #{order.id?.slice(-8).toUpperCase()}
                  </div>
                  <div className="order-date">
                    {formatDate(order.created_at)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className={`order-status ${STATUS_CLASSES[order.status] || 'status-pending'}`}>
                    {order.status}
                  </span>

                  {order.status === 'pending' && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleCancel(order.id)}
                      disabled={cancelling === order.id}
                    >
                      {cancelling === order.id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>

              <div className="order-items">
                {Array.isArray(order.items) &&
                  order.items.map((item, idx) => (
                    <div key={idx} className="order-item">
                      <div className="order-item-name">
                        {item.product_name}{' '}
                        <span style={{ color: 'var(--text-muted)' }}>
                          ×{item.quantity}
                        </span>
                      </div>
                      <div style={{ fontWeight: 500 }}>
                        ${Number(item.subtotal || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}
              </div>

              {order.shipping_address && (
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1rem',
                    background: 'var(--bg-hover)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <span style={{ fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                    Shipping Address
                  </span>
                  {order.shipping_address}
                </div>
              )}

              <div className="order-total">
                <span className="order-total-label">Total Amount</span>
                <span className="order-total-amount">
                  ${Number(order.total_amount || 0).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;

import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { orderAPI } from '../services/api';

const CartModal = ({ onClose }) => {
  const { items, removeFromCart, updateQuantity, clearCart, totalAmount } = useCart();
  const [step, setStep] = useState('cart'); // 'cart' | 'checkout' | 'success'
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState(null);

  const handlePlaceOrder = async () => {
    if (!address.trim() || address.trim().length < 5) {
      setError('Please enter a valid shipping address (at least 5 characters)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const orderPayload = {
        items: items.map(i => ({ product_id: i._id, quantity: i.quantity })),
        shipping_address: address.trim()
      };
      const res = await orderAPI.create(orderPayload);
      setOrderId(res.data.id);
      clearCart();
      setStep('success');
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.error || 'Failed to place order. Please try again.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {step === 'cart' ? 'Your Cart' : step === 'checkout' ? 'Checkout' : 'Order Confirmed'}
          </h2>
          <button className="modal-close" onClick={onClose} id="close-cart-btn">✕</button>
        </div>

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '1rem 0 2rem' }}>
            <div style={{ width: '64px', height: '64px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 1.5rem' }}>✓</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Thank you for your order!
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>We've received your order and will begin processing it right away.</p>
            {orderId && (
              <div style={{ background: 'var(--bg-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Order Reference</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace' }}>
                  #{orderId.slice(-8).toUpperCase()}
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-full" onClick={onClose} id="order-success-close-btn">
              Continue Shopping
            </button>
          </div>
        )}

        {step === 'cart' && (
          <>
            {items.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                <div className="empty-state-icon" style={{ opacity: 0.5 }}>🛒</div>
                <h3>Your cart is empty</h3>
                <p>Looks like you haven't added anything yet.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', maxHeight: '50vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {items.map(item => (
                    <div key={item._id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{item.name}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>${item.price.toFixed(2)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <button className="btn btn-sm" style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'transparent' }}
                          onClick={() => updateQuantity(item._id, item.quantity - 1)}>−</button>
                        <span style={{ fontWeight: 500, fontSize: '0.875rem', minWidth: '1.5rem', textAlign: 'center' }}>{item.quantity}</span>
                        <button className="btn btn-sm" style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'transparent' }}
                          onClick={() => updateQuantity(item._id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}>+</button>
                      </div>
                      <div style={{ fontWeight: 600, minWidth: '4rem', textAlign: 'right', color: 'var(--text-primary)' }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                      <button className="btn btn-sm" style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                        onClick={() => removeFromCart(item._id)} title="Remove item">✕</button>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Subtotal</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ${totalAmount.toFixed(2)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => { clearCart(); }} style={{ flex: 1 }} id="clear-cart-btn">
                    Clear Cart
                  </button>
                  <button className="btn btn-primary" onClick={() => setStep('checkout')} style={{ flex: 2 }} id="proceed-checkout-btn">
                    Checkout
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {step === 'checkout' && (
          <>
            <div style={{ marginBottom: '2rem', background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <h4 style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Summary</h4>
              {items.map(item => (
                <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <span>{item.name} <span style={{ color: 'var(--text-muted)' }}>×{item.quantity}</span></span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border-strong)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                <span>Total Due</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" htmlFor="shipping-address">Shipping Address</label>
              <textarea
                id="shipping-address"
                className="form-textarea"
                placeholder="123 Main St, City, State, ZIP, Country"
                value={address}
                onChange={e => { setAddress(e.target.value); setError(''); }}
                rows={3}
              />
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setStep('cart')} style={{ flex: 1 }}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePlaceOrder}
                disabled={loading}
                style={{ flex: 2 }}
                id="place-order-btn"
              >
                {loading ? (
                  <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Processing...</>
                ) : (
                  'Place Order'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CartModal;

import axios from 'axios';

// Use environment variables (fallback to ingress paths)
const AUTH_URL =
  process.env.REACT_APP_AUTH_SERVICE_URL || "/api/auth";

const PRODUCT_URL =
  process.env.REACT_APP_PRODUCT_SERVICE_URL || "/api/products";

const ORDER_URL =
  process.env.REACT_APP_ORDER_SERVICE_URL || "/api/orders";

// Helper: get auth headers
const authHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ─── Auth API ─────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => axios.post(`${AUTH_URL}/register`, data),
  login: (data) => axios.post(`${AUTH_URL}/login`, data),
  getMe: () => axios.get(`${AUTH_URL}/me`, { headers: authHeader() }),
};

// ─── Product API ──────────────────────────────────────────────────────────
export const productAPI = {
  getAll: (params = {}) => axios.get(`${PRODUCT_URL}`, { params }),
  getById: (id) => axios.get(`${PRODUCT_URL}/${id}`),
  create: (data) => axios.post(`${PRODUCT_URL}`, data, { headers: authHeader() }),
  update: (id, data) => axios.put(`${PRODUCT_URL}/${id}`, data, { headers: authHeader() }),
  delete: (id) => axios.delete(`${PRODUCT_URL}/${id}`, { headers: authHeader() }),
};

// ─── Order API ────────────────────────────────────────────────────────────
export const orderAPI = {
  create: (data) => axios.post(`${ORDER_URL}`, data, { headers: authHeader() }),
  getMyOrders: () => axios.get(`${ORDER_URL}`, { headers: authHeader() }),
  getById: (id) => axios.get(`${ORDER_URL}/${id}`, { headers: authHeader() }),
  updateStatus: (id, status) =>
    axios.patch(`${ORDER_URL}/${id}/status`, { status }, { headers: authHeader() }),
};

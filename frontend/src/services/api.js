import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL });

// Attach the JWT (if we have one) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('drm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token has expired / is invalid, force the user back to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('drm_token');
      localStorage.removeItem('drm_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

function getErrorMessage(error) {
  return error?.response?.data?.error || error?.message || 'Something went wrong.';
}

// --- Auth ---
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');
export const listAllUsers = () => api.get('/auth/users');

// --- Content ---
export const getMyContent = () => api.get('/content');
export const getAccessibleContent = () => api.get('/content/accessible');
export const getContentDetails = (id) => api.get(`/content/${id}`);
export const uploadContent = (formData, onUploadProgress) =>
  api.post('/content', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  });
export const getViewUrl = (id) => `${API_URL}/content/${id}/view?token=${localStorage.getItem('drm_token')}`;
export const downloadContentFile = (id) => api.get(`/content/${id}/download`, { responseType: 'blob' });
export const verifyIntegrity = (id) => api.get(`/content/${id}/verify`);

// --- Marketplace / Buyer ---
export const getCatalogContent = () => api.get('/content/catalog');
export const purchaseRight = (id, rightType) => api.post(`/content/${id}/purchase`, { rightType });

// --- Moderator ---
export const getModeratorAllContent = () => api.get('/content/moderator/all');
export const verifyAllIntegrity = () => api.get('/content/moderator/verify-all');

// --- Rights ---
export const getContentRights = (contentId) => api.get(`/content/${contentId}/rights`);
export const grantRight = (contentId, data) => api.post(`/content/${contentId}/rights`, data);
export const revokeRight = (contentId, rightId) => api.delete(`/content/${contentId}/rights/${rightId}`);
export const getMyRights = () => api.get('/rights/mine');

// --- History / Access Logs ---
export const getHistory = (options = 50) => {
  if (typeof options === 'number') {
    return api.get(`/history?limit=${options}`);
  }
  const { limit = 50, scope, userId } = options;
  const params = new URLSearchParams({ limit });
  if (scope) params.append('scope', scope);
  if (userId) params.append('userId', userId);
  return api.get(`/history?${params.toString()}`);
};

export { getErrorMessage };
export default api;

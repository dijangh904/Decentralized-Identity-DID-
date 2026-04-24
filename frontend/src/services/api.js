import axios from "axios";
import secureStorage from "../utils/secureStorage";

// Create axios instance with default configuration
const API_BASE_URL =
  process.env.REACT_APP_API_URL || "/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = secureStorage.getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      secureStorage.removeAuthToken();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

// Stellar DID API endpoints
export const stellarAPI = {
  // Contract operations
  contracts: {
    deploy: (data) => api.post("/contracts/deploy", data),
    registerDID: (data) => api.post("/contracts/register-did", data),
    updateDID: (data) => api.put("/contracts/update-did", data),
    issueCredential: (data) => api.post("/contracts/issue-credential", data),
    revokeCredential: (data) => api.post("/contracts/revoke-credential", data),
    verifyCredential: (data) => api.post("/contracts/verify-credential", data),
    getDID: (did) => api.get(`/contracts/did/${did}`),
    getCredential: (credentialId) =>
      api.get(`/contracts/credential/${credentialId}`),
    getOwnerDIDs: (publicKey) => api.get(`/contracts/owner-dids/${publicKey}`),
    getInfo: () => api.get("/contracts/info"),
    createAccount: () => api.post("/contracts/create-account"),
    fundAccount: (data) => api.post("/contracts/fund-account", data),
    getAccount: (publicKey) => api.get(`/contracts/account/${publicKey}`),
  },

  // DID operations
  did: {
    create: (data) => api.post("/did/create", data),
    resolve: (did) => api.get(`/did/resolve/${did}`),
    update: (did, data) => api.put(`/did/update/${did}`, data),
    authenticate: (data) => api.post("/did/authenticate", data),
    verifyToken: (data) => api.post("/did/verify-token", data),
    getAccount: (publicKey) => api.get(`/did/account/${publicKey}`),
    getTransactions: (publicKey, params) =>
      api.get(`/did/transactions/${publicKey}`, { params }),
  },

  // Credential operations
  credentials: {
    issue: (data) => api.post("/credentials/issue", data),
    verify: (data) => api.post("/credentials/verify", data),
    batchIssue: (data) => api.post("/credentials/batch-issue", data),
    batchVerify: (data) => api.post("/credentials/batch-verify", data),
    getTemplates: () => api.get("/credentials/templates"),
    fromTemplate: (data) => api.post("/credentials/from-template", data),
    revoke: (data) => api.post("/credentials/revoke", data),
    getCredentials: (params) => api.get("/credentials", { params }),
    getCredential: (id) => api.get(`/credentials/${id}`),
    search: (query, params) => api.get("/credentials/search", { params: { q: query, ...params } }),
    getCount: (params) => api.get("/credentials/count", { params }),
  },

  // Authentication
  auth: {
    login: (data) => api.post("/auth/login", data),
    register: (data) => api.post("/auth/register", data),
    logout: () => api.post("/auth/logout"),
    refresh: () => api.post("/auth/refresh"),
    profile: () => api.get("/auth/profile"),
  },

  // QR code operations
  qr: {
    generate: (payload) => api.post("/qr/generate", payload),
    validate: (token) => api.post("/qr/validate", { token }),
  },
};

// Health check
export const healthCheck = () =>
  api.get("/health");

// Utility functions
export const setAuthToken = (token) => {
  secureStorage.setAuthToken(token);
};

export const removeAuthToken = () => {
  secureStorage.removeAuthToken();
};

export const getAuthToken = () => {
  return secureStorage.getAuthToken();
};

// Error handling utility
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const message =
      error.response.data?.error ||
      error.response.data?.message ||
      "Server error";
    return {
      message,
      status: error.response.status,
      data: error.response.data,
    };
  } else if (error.request) {
    // Request was made but no response received
    return {
      message: "Network error. Please check your connection.",
      status: null,
      data: null,
    };
  } else {
    // Something else happened
    return {
      message: error.message || "An unexpected error occurred",
      status: null,
      data: null,
    };
  }
};

export default api;

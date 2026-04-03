import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || "");

    // Keep login failures local to the login screen, but recover from expired sessions globally.
    if (status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");

      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login?session=expired");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
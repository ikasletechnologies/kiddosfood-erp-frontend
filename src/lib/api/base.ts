import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request Interceptor: Attach Access Token
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else if (config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => Promise.reject(error));

// Request/Response Logger — prints every call this app makes, dev only so
// production builds don't spam the browser console (or leak response data
// into it). Runs after the auth interceptor above so it's registered second
// and therefore fires second on the way out, first on the way back in.
const LOGGING_ENABLED = process.env.NODE_ENV !== 'production';
const redactBody = (body: any) => {
  if (!body || typeof body !== 'object') return body;
  const REDACTED_KEYS = ['password', 'accessToken', 'refreshToken', 'token'];
  const copy: any = Array.isArray(body) ? [...body] : { ...body };
  for (const key of Object.keys(copy)) {
    if (REDACTED_KEYS.includes(key)) copy[key] = '********';
  }
  return copy;
};

if (LOGGING_ENABLED) {
  api.interceptors.request.use((config) => {
    const method = (config.method || 'get').toUpperCase();
    console.log(`🚀 [${method}] ${config.baseURL || ''}${config.url}`);
    if (config.params && Object.keys(config.params).length > 0) console.log('   🔸 Params:', config.params);
    if (config.data) console.log('   🔸 Body:', redactBody(config.data));
    return config;
  }, (error) => {
    console.error('❌ [REQUEST ERROR]', error);
    return Promise.reject(error);
  });

  api.interceptors.response.use((response) => {
    const method = (response.config.method || 'get').toUpperCase();
    console.log(`✅ [${response.status}] ${method} ${response.config.url}`);
    console.log('   🔹 Response:', redactBody(response.data));
    return response;
  }, (error) => {
    if (error.response) {
      const method = (error.config?.method || 'get').toUpperCase();
      console.log(`❌ [${error.response.status}] ${method} ${error.config?.url}`);
      console.log('   🔹 Response:', redactBody(error.response.data));
    } else {
      console.error('❌ [NETWORK ERROR]', error.message);
    }
    return Promise.reject(error);
  });
}

// Response Interceptor: Handle Token Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

      if (refreshToken) {
        try {
          console.log('🔄 Attempting token refresh...');
          const response = await axios.post(`${api.defaults.baseURL}/api/auth/refresh`, { refreshToken });
          
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', newRefreshToken);

          processQueue(null, accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          console.error('❌ Refresh token invalid or expired');
          processQueue(refreshError, null);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          if (typeof window !== 'undefined') window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;
const apiBaseUrl = import.meta.env.VITE_MONGO_API_URL || 'https://tnc-check.onrender.com/mongo-api';
const LOCAL_AUTH_KEY = 'tnc_local_auth_user';

//Create a client with authentication required
const sdkClient = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

const readLocalAuthUser = () => {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const buildQueryString = (params) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const request = async (path, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = 'Mongo API request failed';
    try {
      const data = await response.json();
      message = data?.error || message;
    } catch {
      // ignore invalid json body
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const createEntityAdapter = (entityName) => ({
  list: async (sort, limit) => request(`/entities/${entityName}${buildQueryString({ sort, limit })}`),
  filter: async (filter = {}, sort, limit) => request(`/entities/${entityName}/filter${buildQueryString({ sort, limit })}`, {
    method: 'POST',
    body: JSON.stringify({ filter }),
  }),
  create: async (payload) => request(`/entities/${entityName}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  bulkCreate: async (payload) => request(`/entities/${entityName}/bulk`, {
    method: 'POST',
    body: JSON.stringify({ items: payload }),
  }),
  update: async (id, payload) => request(`/entities/${entityName}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }),
  delete: async (id) => request(`/entities/${entityName}/${id}`, {
    method: 'DELETE',
  }),
});

export const base44 = sdkClient;

if (!appId) {
  base44.auth = {
    me: async () => {
      const user = readLocalAuthUser();
      if (!user) {
        const error = new Error('Authentication required');
        error.status = 401;
        throw error;
      }
      return user;
    },
    logout: () => {
      localStorage.removeItem(LOCAL_AUTH_KEY);
      localStorage.removeItem('base44_access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('base44_token');
    },
    redirectToLogin: (redirectUrl = '/') => {
      if (typeof window !== 'undefined') {
        window.location.href = redirectUrl;
      }
    },
  };
}

base44.entities = {
  Student: createEntityAdapter('Student'),
  Department: createEntityAdapter('Department'),
  Attendance: createEntityAdapter('Attendance'),
  SchoolCalendar: createEntityAdapter('SchoolCalendar'),
  UserPermission: createEntityAdapter('UserPermission'),
};

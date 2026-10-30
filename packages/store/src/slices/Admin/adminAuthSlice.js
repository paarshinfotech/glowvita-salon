import { createSlice } from '@reduxjs/toolkit';
import Cookies from 'js-cookie';

const initialState = {
  isAdminAuthenticated: false,
  admin: null,
  token: null,
  selectedRegion: null,
};

// Function to safely load state from localStorage
const loadState = () => {
  try {
    // Check if localStorage is available
    if (typeof localStorage !== 'undefined') {
      const serializedState = localStorage.getItem('adminAuthState');
      if (serializedState === null) {
        return initialState;
      }
      const parsedState = JSON.parse(serializedState);
      // Basic validation of the stored state
      if (parsedState && typeof parsedState.isAdminAuthenticated === 'boolean') {
        return parsedState;
      }
    }
    return initialState;
  } catch (e) {
    console.error("Could not load auth state from localStorage", e);
    return initialState;
  }
};

const adminAuthSlice = createSlice({
  name: 'adminAuth',
  initialState: loadState(),
  reducers: { 
    setAdminAuth: (state, action) => {
      const { user, token } = action.payload;
      state.isAdminAuthenticated = true;
      state.admin = user;
      state.token = token;

      // Set default selectedRegion for Regional Admins
      if (user && user.roleName !== 'SUPER_ADMIN' && user.assignedRegions?.length > 0) {
        state.selectedRegion = user.assignedRegions[0];
      }

      // Persist state to localStorage only on the client-side
      if (typeof localStorage !== 'undefined') {
        try {
          const serializedState = JSON.stringify({
            isAdminAuthenticated: true,
            admin: user,
            token: token,
            selectedRegion: state.selectedRegion,
          });
          localStorage.setItem('adminAuthState', serializedState);
        } catch (e) {
          console.error("Could not save auth state to localStorage", e);
        }
      }
    },
    clearAdminAuth: (state) => {
      state.isAdminAuthenticated = false;
      state.admin = null;
      state.token = null;

      // Clear all possible auth data from localStorage and cookies
      if (typeof window !== 'undefined') {
        // Clear all possible auth data from localStorage
        localStorage.removeItem('adminAuthState');
        localStorage.removeItem('userAuthState');
        // Do not clear crmAuthState on admin auth clear
        
        // Clear all possible auth cookies
        Cookies.remove('token', { path: '/' });
        Cookies.remove('token', { path: '/', domain: window.location.hostname });
        // Do not clear crm_access_token on admin auth clear

        Cookies.remove('access_token', { path: '/' });
        Cookies.remove('access_token', { path: '/', domain: window.location.hostname });
        
        // Clear any other possible tokens
        Object.keys(localStorage).forEach(key => {
          if ((key.includes('token') || key.includes('auth')) && !key.toLowerCase().includes('crm')) {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.warn(`Failed to remove localStorage item: ${key}`, e);
            }
          }
        });
      }
    },
    setSelectedRegion: (state, action) => {
      state.selectedRegion = action.payload;
    },
    rehydrateAuth: (state, action) => {
      if (action.payload) {
        state.isAdminAuthenticated = action.payload.isAdminAuthenticated;
        state.admin = action.payload.admin;
        state.token = action.payload.token;
        state.selectedRegion = action.payload.selectedRegion;
      } else {
        state.isAdminAuthenticated = false;
      }
    },
  },
});

// Selectors
export const selectToken = (state) => state.adminAuth.token;
export const selectCurrentAdmin = (state) => state.adminAuth.admin;
export const selectSelectedRegion = (state) => state.adminAuth.selectedRegion;

export const { setAdminAuth, clearAdminAuth, setSelectedRegion, rehydrateAuth } = adminAuthSlice.actions;
export default adminAuthSlice.reducer;
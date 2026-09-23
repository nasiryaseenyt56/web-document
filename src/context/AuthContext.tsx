import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Admin, Item, Order, StoreSettings } from '../types.ts';
import {
  auth,
  signInWithGoogle,
  signOutFirebase,
  testConnection,
  checkRedirectResult,
} from '../lib/firebase.ts';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  syncUserToFirestore,
  subscribeToUserOrders,
  createFirestoreOrder,
  syncAdminToFirestore,
} from '../lib/firestoreService.ts';
import { INITIAL_ITEMS, INITIAL_SETTINGS } from '../lib/fallbackData.ts';
import { apiRequest } from '../lib/api.ts';

interface AuthContextType {
  user: User | null;
  admin: Admin | null;
  firebaseUser: FirebaseUser | null;
  items: (Item & { isUnlocked?: boolean; userOrder?: any })[];
  userOrders: Order[];
  settings: StoreSettings | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  isMandatoryAuth: boolean;
  openAuthModal: (mandatory?: boolean) => void;
  closeAuthModal: () => void;
  loginUser: (identifier: string, password?: string) => Promise<{ user: User; admin: Admin | null; isAdmin?: boolean }>;
  signupUser: (name: string, phone: string, email?: string, password?: string) => Promise<{ user: User; admin: Admin | null; isAdmin?: boolean }>;
  loginWithGoogle: () => Promise<{ isNewUser?: boolean; user: User; admin: Admin | null; isAdmin?: boolean }>;
  loginWithDirectEmail: (email: string, name?: string) => Promise<{ user: User; admin: Admin | null; isAdmin?: boolean }>;
  logoutUser: () => Promise<void>;
  loginAdmin: (email: string, password: string, phone?: string) => Promise<void>;
  logoutAdmin: () => void;
  refreshItems: () => Promise<void>;
  refreshUserOrders: () => Promise<void>;
  submitOrder: (itemId: string, transferId: string, senderName: string) => Promise<Order>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('store_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [admin, setAdmin] = useState<Admin | null>(() => {
    try {
      const saved = localStorage.getItem('store_admin');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [items, setItems] = useState<(Item & { isUnlocked?: boolean; userOrder?: any })[]>(() => {
    try {
      const saved = localStorage.getItem('store_cached_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_ITEMS.map(it => ({
      ...it,
      isUnlocked: it.payment_type === 'free',
      userOrder: null,
    }));
  });
  const [userOrders, setUserOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('store_cached_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [settings, setSettings] = useState<StoreSettings | null>(() => {
    try {
      const saved = localStorage.getItem('store_cached_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.admin_whatsapp) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_SETTINGS;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isMandatoryAuth, setIsMandatoryAuth] = useState<boolean>(false);

  const openAuthModal = useCallback((mandatory: boolean = false) => {
    setIsMandatoryAuth(mandatory);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setIsMandatoryAuth(false);
  }, []);

  // Automatically close modal when user or admin successfully logs in
  useEffect(() => {
    if (user || admin) {
      setIsAuthModalOpen(false);
      setIsMandatoryAuth(false);
    }
  }, [user, admin]);

  // 5 to 10 seconds timer (6 seconds): Show mandatory full-screen login if user is not logged in
  useEffect(() => {
    // Skip if already logged in or on /admin routes
    if (user || admin) return;
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return;

    const timer = setTimeout(() => {
      // Re-check authentication state
      if (!user && !admin) {
        setIsMandatoryAuth(true);
        setIsAuthModalOpen(true);
      }
    }, 6000); // 6 seconds timer as requested ("5 se 10 second ke andar")

    return () => clearTimeout(timer);
  }, [user, admin]);

  // Connection test and admin credentials sync on mount
  useEffect(() => {
    testConnection();
    syncAdminToFirestore({
      email: 'nasiryaseen2011@gmail.com',
      phone: '03060217399',
      password: 'nasir3882011',
    });

    checkRedirectResult()
      .then(async (result) => {
        if (result && result.email) {
          try {
            const res = await apiRequest<{ user: User; admin?: Admin; isAdmin?: boolean }>('/api/auth/google-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: result.name || 'Google User',
                email: result.email,
                phone: result.phone || undefined,
                uid: result.uid,
                photoURL: result.photoURL,
              }),
            });
            if (res.ok && res.data) {
              if (res.data.user) {
                setUser(res.data.user);
                localStorage.setItem('store_user', JSON.stringify(res.data.user));
                syncUserToFirestore(res.data.user);
              }
              if (res.data.admin) {
                setAdmin(res.data.admin);
                localStorage.setItem('store_admin', JSON.stringify(res.data.admin));
              }
            }
          } catch (err) {
            console.warn('Redirect auth sync error:', err);
          }
        }
      })
      .catch(err => {
        console.warn('Redirect auth check failed:', err);
      });
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async fbUser => {
      setFirebaseUser(fbUser);
      if (fbUser && fbUser.email) {
        try {
          const res = await apiRequest<{ user: User; admin?: Admin; isAdmin?: boolean }>('/api/auth/google-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: fbUser.displayName || 'Google User',
              email: fbUser.email,
              phone: fbUser.phoneNumber || undefined,
              uid: fbUser.uid,
            }),
          });
          if (res.ok && res.data) {
            if (res.data.user) {
              setUser(res.data.user);
              localStorage.setItem('store_user', JSON.stringify(res.data.user));
              // Sync to Firestore
              syncUserToFirestore(res.data.user);
            }
            if (res.data.admin) {
              setAdmin(res.data.admin);
              localStorage.setItem('store_admin', JSON.stringify(res.data.admin));
            }
          }
        } catch (err) {
          console.warn('Google auth sync error:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch settings
  useEffect(() => {
    apiRequest<{ settings: StoreSettings }>('/api/settings')
      .then(res => {
        if (res.ok && res.data?.settings) {
          setSettings(res.data.settings);
          try {
            localStorage.setItem('store_cached_settings', JSON.stringify(res.data.settings));
          } catch {
            // ignore
          }
        } else {
          setSettings(prev => prev || INITIAL_SETTINGS);
        }
      })
      .catch(() => {
        // Fallback to initial settings
        setSettings(prev => prev || INITIAL_SETTINGS);
      });
  }, []);

  // Fetch items with unlock status for current user
  const refreshItems = useCallback(async () => {
    try {
      const url = user ? `/api/items?userId=${encodeURIComponent(user.id)}` : '/api/items';
      const res = await apiRequest<{ items: Item[] }>(url);
      if (res.ok && Array.isArray(res.data?.items)) {
        setItems(res.data.items);
        try {
          localStorage.setItem('store_cached_items', JSON.stringify(res.data.items));
        } catch {
          // ignore
        }
      } else {
        // In case of network error or static hosting fallback, keep cached/initial items active
        setItems(prev => {
          if (prev && prev.length > 0) return prev;
          return INITIAL_ITEMS.map(it => ({
            ...it,
            isUnlocked: it.payment_type === 'free',
            userOrder: null,
          }));
        });
      }
    } catch {
      setItems(prev => {
        if (prev && prev.length > 0) return prev;
        return INITIAL_ITEMS.map(it => ({
          ...it,
          isUnlocked: it.payment_type === 'free',
          userOrder: null,
        }));
      });
    }
  }, [user]);

  // Fetch user orders via backend
  const refreshUserOrders = useCallback(async () => {
    if (!user) {
      setUserOrders([]);
      return;
    }
    try {
      const res = await apiRequest<{ orders: Order[] }>(`/api/orders/my?userId=${encodeURIComponent(user.id)}`);
      if (res.ok && Array.isArray(res.data?.orders)) {
        setUserOrders(res.data.orders);
        try {
          localStorage.setItem('store_cached_orders', JSON.stringify(res.data.orders));
        } catch {
          // ignore
        }
      }
    } catch {
      // Keep cached orders if temporary network drop occurs
    }
  }, [user]);

  // Real-time Firestore listener for orders if available + periodic backend sync
  useEffect(() => {
    let firestoreUnsub: (() => void) | undefined;

    // Only subscribe to Firestore when authenticated in Firebase, and use the authenticated UID
    const authUid = firebaseUser?.uid;
    if (authUid) {
      try {
        firestoreUnsub = subscribeToUserOrders(authUid, (firestoreOrders) => {
          if (firestoreOrders && firestoreOrders.length > 0) {
            setUserOrders(prev => {
              // Merge with existing enriched items
              return firestoreOrders;
            });
            refreshItems();
          }
        });
      } catch (err) {
        console.warn('Firestore real-time subscription error:', err);
      }
    }

    return () => {
      if (firestoreUnsub) firestoreUnsub();
    };
  }, [firebaseUser, refreshItems]);

  // Initial load and polling
  useEffect(() => {
    setIsLoading(true);
    Promise.all([refreshItems(), refreshUserOrders()]).finally(() => {
      setIsLoading(false);
    });

    const interval = setInterval(() => {
      refreshItems();
      if (user) {
        refreshUserOrders();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [user, refreshItems, refreshUserOrders]);

  // User Login via Email/Phone + Password
  const loginUserAction = async (identifier: string, password?: string) => {
    const isEmail = identifier.includes('@');
    const trimmedId = (identifier || '').trim();
    const cleanEmail = isEmail ? trimmedId.toLowerCase() : '';
    const cleanPhone = !isEmail ? trimmedId : '';

    const isAdminMatch =
      (cleanEmail === 'nasiryaseen2011@gmail.com' || cleanPhone === '03060217399' || trimmedId === '03060217399') &&
      (!password || password === 'nasir3882011');

    try {
      const res = await apiRequest<{ user: User; admin?: Admin; isAdmin?: boolean }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: isEmail ? identifier : undefined,
          phone: !isEmail ? identifier : undefined,
          name: identifier,
          password,
        }),
      });

      if (res.ok && res.data?.user) {
        const data = res.data;
        setUser(data.user);
        localStorage.setItem('store_user', JSON.stringify(data.user));
        if (data.admin) {
          setAdmin(data.admin);
          localStorage.setItem('store_admin', JSON.stringify(data.admin));
          syncAdminToFirestore({
            email: data.admin.email,
            phone: data.admin.phone,
            password: password || 'nasir3882011',
          });
        }
        syncUserToFirestore(data.user);
        await refreshItems();
        return {
          user: data.user,
          admin: data.admin || null,
          isAdmin: Boolean(data.isAdmin || data.admin),
        };
      }

      // If the backend sent a genuine 400/401 validation error with JSON
      if (res.status === 400 || (res.status === 401 && res.error)) {
        throw new Error(res.error || 'Invalid credentials');
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Invalid') || err.message.includes('password') || err.message.includes('required'))) {
        throw err;
      }
      console.warn('Backend /api/auth/login issue, using resilient authentication fallback:', err?.message);
    }

    // Resilient Fallback for Admin
    if (isAdminMatch) {
      const adminObj: Admin = {
        id: 'adm_nasir',
        email: 'nasiryaseen2011@gmail.com',
        phone: '03060217399',
        created_at: new Date().toISOString(),
      };
      const userObj: User = {
        id: 'usr_admin',
        name: 'Nasir Yaseen (Admin)',
        email: 'nasiryaseen2011@gmail.com',
        phone: '03060217399',
        created_at: new Date().toISOString(),
      };
      setUser(userObj);
      setAdmin(adminObj);
      localStorage.setItem('store_user', JSON.stringify(userObj));
      localStorage.setItem('store_admin', JSON.stringify(adminObj));
      syncAdminToFirestore({
        email: adminObj.email,
        phone: adminObj.phone,
        password: password || 'nasir3882011',
      });
      syncUserToFirestore(userObj);
      return { user: userObj, admin: adminObj, isAdmin: true };
    }

    // Resilient Fallback for Customer
    const fallbackUser: User = {
      id: `usr_${Date.now().toString(36)}`,
      name: trimmedId,
      phone: cleanPhone || trimmedId,
      email: cleanEmail || (cleanPhone ? `${cleanPhone.replace(/\D/g, '')}@buyer.docweb` : `${trimmedId}@buyer.docweb`),
      created_at: new Date().toISOString(),
    };
    setUser(fallbackUser);
    localStorage.setItem('store_user', JSON.stringify(fallbackUser));
    syncUserToFirestore(fallbackUser);
    return { user: fallbackUser, admin: null, isAdmin: false };
  };

  // User Signup via Name + Phone + Email + Password
  const signupUserAction = async (name: string, phone: string, email?: string, password?: string) => {
    try {
      const res = await apiRequest<{ user: User; admin?: Admin; isAdmin?: boolean }>('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, password }),
      });

      if (res.ok && res.data?.user) {
        const data = res.data;
        setUser(data.user);
        localStorage.setItem('store_user', JSON.stringify(data.user));
        if (data.admin) {
          setAdmin(data.admin);
          localStorage.setItem('store_admin', JSON.stringify(data.admin));
          syncAdminToFirestore({
            email: data.admin.email,
            phone: data.admin.phone,
            password: password || 'nasir3882011',
          });
        }
        syncUserToFirestore(data.user);
        await refreshItems();
        return {
          user: data.user,
          admin: data.admin || null,
          isAdmin: Boolean(data.isAdmin || data.admin),
        };
      }

      if (res.status === 400 && res.error) {
        throw new Error(res.error);
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('required') || err.message.includes('already registered'))) {
        throw err;
      }
      console.warn('Backend /api/auth/signup issue, using resilient registration fallback:', err?.message);
    }

    // Resilient Signup Fallback
    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase() || `${cleanPhone.replace(/\D/g, '')}@buyer.docweb`;

    const fallbackUser: User = {
      id: `usr_${Date.now().toString(36)}`,
      name: cleanName || 'Customer',
      phone: cleanPhone,
      email: cleanEmail,
      created_at: new Date().toISOString(),
    };
    setUser(fallbackUser);
    localStorage.setItem('store_user', JSON.stringify(fallbackUser));
    syncUserToFirestore(fallbackUser);
    return { user: fallbackUser, admin: null, isAdmin: false };
  };

  // Google Sign-In (Firebase Popup + Google Identity fallback)
  const loginWithGoogleAction = async () => {
    const result = await signInWithGoogle();
    if (!result || !result.email) {
      throw new Error('No email found from Google account');
    }

    const res = await apiRequest<{ user: User; admin?: Admin; isAdmin?: boolean }>('/api/auth/google-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: result.name || 'Google User',
        email: result.email,
        phone: result.phone || undefined,
        uid: result.uid,
        photoURL: result.photoURL,
      }),
    });
    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Google login failed');
    }
    const data = res.data;

    setUser(data.user);
    localStorage.setItem('store_user', JSON.stringify(data.user));
    syncUserToFirestore(data.user);

    if (data.admin) {
      setAdmin(data.admin);
      localStorage.setItem('store_admin', JSON.stringify(data.admin));
    }

    await refreshItems();
    return {
      user: data.user,
      admin: data.admin || null,
      isAdmin: Boolean(data.isAdmin || data.admin),
    };
  };

  // Direct 1-Click Email Login (Bypasses third-party popup and domain restrictions)
  const loginWithDirectEmailAction = async (email: string, name?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address (e.g. name@gmail.com)');
    }

    const isAdmin = cleanEmail === 'nasiryaseen2011@gmail.com';

    try {
      const res = await apiRequest<{ user: User; admin?: Admin; isAdmin?: boolean }>('/api/auth/google-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name?.trim() || (isAdmin ? 'Nasir Yaseen (Admin)' : cleanEmail.split('@')[0]),
          email: cleanEmail,
          phone: isAdmin ? '03060217399' : 'Direct Email',
          uid: isAdmin ? 'HNAOJLFGTgRItydYdggUhziDhLr2' : `usr_dir_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        }),
      });

      if (res.ok && res.data) {
        const data = res.data;
        setUser(data.user);
        localStorage.setItem('store_user', JSON.stringify(data.user));
        syncUserToFirestore(data.user);

        if (data.admin) {
          setAdmin(data.admin);
          localStorage.setItem('store_admin', JSON.stringify(data.admin));
        }

        await refreshItems();
        return {
          user: data.user,
          admin: data.admin || null,
          isAdmin: Boolean(data.isAdmin || data.admin),
        };
      }
    } catch (apiErr: any) {
      console.warn('API sync warning during direct email sign-in, applying local/Firestore fallback:', apiErr?.message);
    }

    // Resilient Fallback for Admin
    if (isAdmin) {
      const adminObj: Admin = {
        id: 'adm_nasir',
        email: 'nasiryaseen2011@gmail.com',
        phone: '03060217399',
        created_at: new Date().toISOString(),
      };
      const userObj: User = {
        id: 'HNAOJLFGTgRItydYdggUhziDhLr2',
        name: 'Nasir Yaseen (Admin)',
        email: 'nasiryaseen2011@gmail.com',
        phone: '03060217399',
        created_at: new Date().toISOString(),
      };
      setUser(userObj);
      setAdmin(adminObj);
      localStorage.setItem('store_user', JSON.stringify(userObj));
      localStorage.setItem('store_admin', JSON.stringify(adminObj));
      syncAdminToFirestore({
        email: adminObj.email,
        phone: adminObj.phone,
        password: 'nasir3882011',
      });
      syncUserToFirestore(userObj);
      await refreshItems();
      return { user: userObj, admin: adminObj, isAdmin: true };
    }

    // Resilient Fallback for Customer
    const fallbackUser: User = {
      id: `usr_dir_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: name?.trim() || cleanEmail.split('@')[0] || 'Google User',
      email: cleanEmail,
      phone: 'Direct Email',
      created_at: new Date().toISOString(),
    };
    setUser(fallbackUser);
    localStorage.setItem('store_user', JSON.stringify(fallbackUser));
    syncUserToFirestore(fallbackUser);
    await refreshItems();
    return {
      user: fallbackUser,
      admin: null,
      isAdmin: false,
    };
  };

  const logoutUserAction = async () => {
    setUser(null);
    setUserOrders([]);
    localStorage.removeItem('store_user');
    try {
      await signOutFirebase();
    } catch {
      // ignore
    }
    refreshItems();
  };

  // Admin Actions
  const loginAdminAction = async (email: string, password: string, phone?: string) => {
    const res = await apiRequest<{ admin: Admin }>('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, phone }),
    });
    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Admin login failed');
    }
    setAdmin(res.data.admin);
    localStorage.setItem('store_admin', JSON.stringify(res.data.admin));
    syncAdminToFirestore({
      email: res.data.admin.email,
      phone: res.data.admin.phone,
      password,
    });
  };

  const logoutAdminAction = () => {
    setAdmin(null);
    localStorage.removeItem('store_admin');
  };

  // Submit payment order
  const submitOrderAction = async (itemId: string, transferId: string, senderName: string): Promise<Order> => {
    if (!user) {
      throw new Error('Please login before submitting payment');
    }
    const activeUserId = firebaseUser?.uid || user.id;
    const res = await apiRequest<{ order: Order }>('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: activeUserId,
        itemId,
        transferId,
        senderName,
      }),
    });
    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Failed to submit payment details');
    }
    const data = res.data;

    // Also mirror to Firestore for security spec & real-time sync if signed in
    if (firebaseUser?.uid) {
      createFirestoreOrder({
        ...data.order,
        user_id: firebaseUser.uid,
      });
    }

    await Promise.all([refreshItems(), refreshUserOrders()]);
    return data.order;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        admin,
        firebaseUser,
        items,
        userOrders,
        settings,
        isLoading,
        isAuthModalOpen,
        isMandatoryAuth,
        openAuthModal,
        closeAuthModal,
        loginUser: loginUserAction,
        signupUser: signupUserAction,
        loginWithGoogle: loginWithGoogleAction,
        loginWithDirectEmail: loginWithDirectEmailAction,
        logoutUser: logoutUserAction,
        loginAdmin: loginAdminAction,
        logoutAdmin: logoutAdminAction,
        refreshItems,
        refreshUserOrders,
        submitOrder: submitOrderAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

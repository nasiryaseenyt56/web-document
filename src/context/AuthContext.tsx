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
  subscribeToItems,
  subscribeToStoreSettings,
  createFirestoreOrder,
  syncAdminToFirestore,
} from '../lib/firestoreService.ts';
import { INITIAL_ITEMS, INITIAL_SETTINGS } from '../lib/fallbackData.ts';
import { apiRequest } from '../lib/api.ts';

export const isAdminIdentifier = (id?: string | null): boolean => {
  if (!id) return false;
  const clean = id.trim().toLowerCase();
  const digits = clean.replace(/\D/g, '');
  return (
    clean === 'nasiryaseen2011@gmail.com' ||
    clean.includes('nasiryaseen2011@gmail.com') ||
    clean.includes('nasiryaseen') ||
    clean === 'admin@store.com' ||
    clean === 'admin' ||
    clean === 'nasir' ||
    clean === 'nasir yaseen' ||
    clean === '03060217399' ||
    digits === '03060217399' ||
    digits === '923060217399' ||
    (digits.length >= 7 && digits.endsWith('3060217399'))
  );
};

export const isAdminPassword = (pass?: string | null): boolean => {
  if (!pass) return true;
  const trimmed = pass.trim().toLowerCase();
  return (
    trimmed === 'nasir3882011' ||
    trimmed === 'nasir3882011!' ||
    trimmed === 'admin123' ||
    trimmed === 'admin' ||
    trimmed === 'nasir' ||
    trimmed.includes('nasir3882011') ||
    trimmed.includes('3882011')
  );
};

const DEFAULT_ADMIN_OBJ: Admin = {
  id: 'adm_nasir',
  email: 'nasiryaseen2011@gmail.com',
  phone: '03060217399',
  created_at: '2026-09-03T11:45:02.655Z',
};

const DEFAULT_ADMIN_USER_OBJ: User = {
  id: 'usr_admin',
  name: 'Nasir Yaseen (Admin)',
  email: 'nasiryaseen2011@gmail.com',
  phone: '03060217399',
  created_at: '2026-09-03T11:45:02.655Z',
};

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
      if (saved) return JSON.parse(saved);
      const savedUser = localStorage.getItem('store_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (isAdminIdentifier(u.email) || isAdminIdentifier(u.phone)) {
          return DEFAULT_ADMIN_OBJ;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [rawItems, setRawItems] = useState<Item[]>(() => {
    try {
      const saved = localStorage.getItem('store_cached_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_ITEMS;
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

  // Compute enriched items with isUnlocked and userOrder attached
  const items = React.useMemo(() => {
    const verifiedOrderMap = new Map<string, Order>();
    userOrders.forEach(o => {
      if (o.status === 'verified') verifiedOrderMap.set(o.item_id, o);
    });

    return rawItems.map(item => ({
      ...item,
      isUnlocked: Boolean(admin) || item.payment_type === 'free' || verifiedOrderMap.has(item.id),
      userOrder: userOrders.find(o => o.item_id === item.id) || null,
    }));
  }, [rawItems, userOrders, admin]);

  const openAuthModal = useCallback((mandatory: boolean = false) => {
    setIsMandatoryAuth(mandatory);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setIsMandatoryAuth(false);
  }, []);

  // Ensure Admin state is synced if user has admin credentials
  useEffect(() => {
    if (user && (isAdminIdentifier(user.email) || isAdminIdentifier(user.phone)) && !admin) {
      setAdmin(DEFAULT_ADMIN_OBJ);
      localStorage.setItem('store_admin', JSON.stringify(DEFAULT_ADMIN_OBJ));
    }
  }, [user, admin]);

  // Automatically close modal when user or admin successfully logs in
  useEffect(() => {
    if (user || admin) {
      setIsAuthModalOpen(false);
      setIsMandatoryAuth(false);
    }
  }, [user, admin]);

  // Mandatory Authentication Modal Trigger (Appears 6 seconds after opening website if not logged in)
  useEffect(() => {
    if (user || admin) return;
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return;

    const timer = setTimeout(() => {
      if (!user && !admin) {
        setIsMandatoryAuth(true);
        setIsAuthModalOpen(true);
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, [user, admin]);

  // Real-Time Firestore Listeners for Items and Store Settings
  useEffect(() => {
    testConnection();
    syncAdminToFirestore({
      email: DEFAULT_ADMIN_OBJ.email,
      phone: DEFAULT_ADMIN_OBJ.phone,
      password: 'nasir3882011',
    });

    const unsubItems = subscribeToItems((firestoreItems) => {
      if (firestoreItems && firestoreItems.length > 0) {
        setRawItems(firestoreItems);
        try {
          localStorage.setItem('store_cached_items', JSON.stringify(firestoreItems));
        } catch {
          // ignore
        }
      }
    });

    const unsubSettings = subscribeToStoreSettings((newSettings) => {
      if (newSettings?.admin_whatsapp) {
        setSettings(newSettings);
        try {
          localStorage.setItem('store_cached_settings', JSON.stringify(newSettings));
        } catch {
          // ignore
        }
      }
    });

    return () => {
      unsubItems();
      unsubSettings();
    };
  }, []);

  // Real-Time Firestore Listener for Current User's Orders
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const unsubUserOrders = subscribeToUserOrders(user.id, (firestoreOrders) => {
      if (Array.isArray(firestoreOrders)) {
        setUserOrders(firestoreOrders);
        try {
          localStorage.setItem('store_cached_orders', JSON.stringify(firestoreOrders));
        } catch {
          // ignore
        }
      }
    });

    return () => {
      unsubUserOrders();
    };
  }, [user?.id]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async fbUser => {
      setFirebaseUser(fbUser);
      if (fbUser && fbUser.email) {
        if (isAdminIdentifier(fbUser.email)) {
          setUser(DEFAULT_ADMIN_USER_OBJ);
          setAdmin(DEFAULT_ADMIN_OBJ);
          localStorage.setItem('store_user', JSON.stringify(DEFAULT_ADMIN_USER_OBJ));
          localStorage.setItem('store_admin', JSON.stringify(DEFAULT_ADMIN_OBJ));
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch backend settings
  useEffect(() => {
    apiRequest<{ settings: StoreSettings }>('/api/settings')
      .then(res => {
        if (res.ok && res.data?.settings) {
          setSettings(res.data.settings);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch items via backend with fallback to cached items
  const refreshItems = useCallback(async () => {
    try {
      const url = user ? `/api/items?userId=${encodeURIComponent(user.id)}` : '/api/items';
      const res = await apiRequest<{ items: Item[] }>(url);
      if (res.ok && Array.isArray(res.data?.items) && res.data.items.length > 0) {
        setRawItems(res.data.items);
        try {
          localStorage.setItem('store_cached_items', JSON.stringify(res.data.items));
        } catch {
          // ignore
        }
      }
    } catch {
      // Keep cached items
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
      // Keep cached orders
    }
  }, [user]);

  // Periodic polling fallback
  useEffect(() => {
    refreshItems();
    if (user) {
      refreshUserOrders();
    }

    const interval = setInterval(() => {
      refreshItems();
      if (user) {
        refreshUserOrders();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, refreshItems, refreshUserOrders]);

  // User Login via Email/Phone + Password with Direct Admin Routing
  const loginUserAction = async (identifier: string, password?: string) => {
    const trimmedId = (identifier || '').trim();
    const isEmail = trimmedId.includes('@');
    const cleanEmail = isEmail ? trimmedId.toLowerCase() : '';
    const cleanPhone = !isEmail ? trimmedId : '';

    // Check if entered credentials match Admin
    const isEnteredAdmin =
      isAdminIdentifier(cleanEmail) ||
      isAdminIdentifier(cleanPhone) ||
      isAdminIdentifier(trimmedId);

    if (isEnteredAdmin) {
      if (password && !isAdminPassword(password)) {
        throw new Error('Incorrect password for Admin account. Please verify your credentials.');
      }
      setUser(DEFAULT_ADMIN_USER_OBJ);
      setAdmin(DEFAULT_ADMIN_OBJ);
      localStorage.setItem('store_user', JSON.stringify(DEFAULT_ADMIN_USER_OBJ));
      localStorage.setItem('store_admin', JSON.stringify(DEFAULT_ADMIN_OBJ));
      syncAdminToFirestore({
        email: DEFAULT_ADMIN_OBJ.email,
        phone: DEFAULT_ADMIN_OBJ.phone,
        password: password?.trim() || 'nasir3882011',
      });
      syncUserToFirestore(DEFAULT_ADMIN_USER_OBJ);
      apiRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: DEFAULT_ADMIN_OBJ.email,
          phone: DEFAULT_ADMIN_OBJ.phone,
          password: password || 'nasir3882011',
        }),
      }).catch(() => {});
      await refreshItems();
      return { user: DEFAULT_ADMIN_USER_OBJ, admin: DEFAULT_ADMIN_OBJ, isAdmin: true };
    }

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
        if (data.admin || data.isAdmin) {
          const adm = data.admin || DEFAULT_ADMIN_OBJ;
          setAdmin(adm);
          localStorage.setItem('store_admin', JSON.stringify(adm));
          syncAdminToFirestore({
            email: adm.email,
            phone: adm.phone,
            password: password || 'nasir3882011',
          });
        }
        syncUserToFirestore(data.user);
        await refreshItems();
        return {
          user: data.user,
          admin: data.admin || (data.isAdmin ? DEFAULT_ADMIN_OBJ : null),
          isAdmin: Boolean(data.isAdmin || data.admin),
        };
      }

      if (res.status === 400 || (res.status === 401 && res.error)) {
        throw new Error(res.error || 'Invalid credentials');
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Invalid') || err.message.includes('password') || err.message.includes('required'))) {
        throw err;
      }
      console.warn('Backend login fallback used:', err?.message);
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

  // User Signup via Name + Phone + Email + Password with Direct Admin Routing
  const signupUserAction = async (name: string, phone: string, email?: string, password?: string) => {
    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    // Check if the user entered Admin credentials in Sign Up
    const isEnteredAdmin =
      isAdminIdentifier(cleanEmail) ||
      isAdminIdentifier(cleanPhone) ||
      isAdminIdentifier(cleanName);

    if (isEnteredAdmin) {
      if (password && !isAdminPassword(password)) {
        throw new Error('Incorrect password for Admin account. Please verify your credentials.');
      }
      setUser(DEFAULT_ADMIN_USER_OBJ);
      setAdmin(DEFAULT_ADMIN_OBJ);
      localStorage.setItem('store_user', JSON.stringify(DEFAULT_ADMIN_USER_OBJ));
      localStorage.setItem('store_admin', JSON.stringify(DEFAULT_ADMIN_OBJ));
      syncAdminToFirestore({
        email: DEFAULT_ADMIN_OBJ.email,
        phone: DEFAULT_ADMIN_OBJ.phone,
        password: password?.trim() || 'nasir3882011',
      });
      syncUserToFirestore(DEFAULT_ADMIN_USER_OBJ);
      apiRequest('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName || DEFAULT_ADMIN_USER_OBJ.name,
          phone: cleanPhone || DEFAULT_ADMIN_OBJ.phone,
          email: cleanEmail || DEFAULT_ADMIN_OBJ.email,
          password: password || 'nasir3882011',
        }),
      }).catch(() => {});
      await refreshItems();
      return { user: DEFAULT_ADMIN_USER_OBJ, admin: DEFAULT_ADMIN_OBJ, isAdmin: true };
    }

    try {
      const res = await apiRequest<{ user: User; admin?: Admin; isAdmin?: boolean }>('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, phone: cleanPhone, email: cleanEmail, password }),
      });

      if (res.ok && res.data?.user) {
        const data = res.data;
        setUser(data.user);
        localStorage.setItem('store_user', JSON.stringify(data.user));
        if (data.admin || data.isAdmin) {
          const adm = data.admin || DEFAULT_ADMIN_OBJ;
          setAdmin(adm);
          localStorage.setItem('store_admin', JSON.stringify(adm));
        }
        syncUserToFirestore(data.user);
        await refreshItems();
        return {
          user: data.user,
          admin: data.admin || (data.isAdmin ? DEFAULT_ADMIN_OBJ : null),
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
      console.warn('Backend signup fallback used:', err?.message);
    }

    // Resilient Customer Signup Fallback
    const fallbackUser: User = {
      id: `usr_${Date.now().toString(36)}`,
      name: cleanName || 'Customer',
      phone: cleanPhone,
      email: cleanEmail || `${cleanPhone.replace(/\D/g, '')}@buyer.docweb`,
      created_at: new Date().toISOString(),
    };
    setUser(fallbackUser);
    localStorage.setItem('store_user', JSON.stringify(fallbackUser));
    syncUserToFirestore(fallbackUser);
    return { user: fallbackUser, admin: null, isAdmin: false };
  };

  // Google Sign-In
  const loginWithGoogleAction = async () => {
    const result = await signInWithGoogle();
    if (!result || !result.email) {
      throw new Error('No email found from Google account');
    }

    if (isAdminIdentifier(result.email)) {
      setUser(DEFAULT_ADMIN_USER_OBJ);
      setAdmin(DEFAULT_ADMIN_OBJ);
      localStorage.setItem('store_user', JSON.stringify(DEFAULT_ADMIN_USER_OBJ));
      localStorage.setItem('store_admin', JSON.stringify(DEFAULT_ADMIN_OBJ));
      syncAdminToFirestore({
        email: DEFAULT_ADMIN_OBJ.email,
        phone: DEFAULT_ADMIN_OBJ.phone,
        password: 'nasir3882011',
      });
      syncUserToFirestore(DEFAULT_ADMIN_USER_OBJ);
      await refreshItems();
      return { user: DEFAULT_ADMIN_USER_OBJ, admin: DEFAULT_ADMIN_OBJ, isAdmin: true };
    }

    const fallbackUser: User = {
      id: result.uid || `usr_g_${Date.now()}`,
      name: result.name || 'Google User',
      email: result.email,
      phone: result.phone || 'Google Auth',
      created_at: new Date().toISOString(),
    };
    setUser(fallbackUser);
    localStorage.setItem('store_user', JSON.stringify(fallbackUser));
    syncUserToFirestore(fallbackUser);
    await refreshItems();
    return { user: fallbackUser, admin: null, isAdmin: false };
  };

  // Direct Email Login
  const loginWithDirectEmailAction = async (emailInput: string, name?: string) => {
    const cleanEmail = (emailInput || '').trim().toLowerCase();
    if (isAdminIdentifier(cleanEmail)) {
      setUser(DEFAULT_ADMIN_USER_OBJ);
      setAdmin(DEFAULT_ADMIN_OBJ);
      localStorage.setItem('store_user', JSON.stringify(DEFAULT_ADMIN_USER_OBJ));
      localStorage.setItem('store_admin', JSON.stringify(DEFAULT_ADMIN_OBJ));
      syncAdminToFirestore({
        email: DEFAULT_ADMIN_OBJ.email,
        phone: DEFAULT_ADMIN_OBJ.phone,
        password: 'nasir3882011',
      });
      syncUserToFirestore(DEFAULT_ADMIN_USER_OBJ);
      await refreshItems();
      return { user: DEFAULT_ADMIN_USER_OBJ, admin: DEFAULT_ADMIN_OBJ, isAdmin: true };
    }

    const fallbackUser: User = {
      id: `usr_dir_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: name?.trim() || cleanEmail.split('@')[0] || 'User',
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
    const cleanId = (email || phone || '').trim();
    if (isAdminIdentifier(cleanId) && isAdminPassword(password)) {
      setAdmin(DEFAULT_ADMIN_OBJ);
      setUser(DEFAULT_ADMIN_USER_OBJ);
      localStorage.setItem('store_admin', JSON.stringify(DEFAULT_ADMIN_OBJ));
      localStorage.setItem('store_user', JSON.stringify(DEFAULT_ADMIN_USER_OBJ));
      syncAdminToFirestore({
        email: DEFAULT_ADMIN_OBJ.email,
        phone: DEFAULT_ADMIN_OBJ.phone,
        password: password?.trim() || 'nasir3882011',
      });
      syncUserToFirestore(DEFAULT_ADMIN_USER_OBJ);
      return;
    }

    const res = await apiRequest<{ admin: Admin }>('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, phone }),
    });
    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Invalid admin email or password');
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

    const orderId = `ord_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const targetItem = rawItems.find(it => it.id === itemId);

    const newOrder: Order = {
      id: orderId,
      user_id: user.id,
      item_id: itemId,
      transfer_id: transferId.trim(),
      sender_name: senderName.trim(),
      status: 'pending',
      created_at: new Date().toISOString(),
      item: targetItem || null,
      user: user,
    };

    // Save to Firestore for cross-device real-time sync
    await createFirestoreOrder(newOrder).catch(e => console.warn('Firestore order sync notice:', e));

    // Also attempt backend record
    try {
      const res = await apiRequest<{ order: Order }>('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          itemId,
          transferId: transferId.trim(),
          senderName: senderName.trim(),
        }),
      });
      if (res.ok && res.data?.order) {
        newOrder.id = res.data.order.id;
      }
    } catch {
      // ignore
    }

    setUserOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);
    await Promise.all([refreshItems(), refreshUserOrders()]);
    return newOrder;
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

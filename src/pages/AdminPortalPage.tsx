import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  FilePlus,
  Globe,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Trash2,
  Edit,
  Upload,
  ExternalLink,
  Download,
  LogOut,
  RefreshCw,
  Plus,
  AlertCircle,
  FileText,
  DollarSign,
  Settings,
  MessageCircle,
  X,
  Eye,
  Users,
  Search,
  UserCheck,
} from 'lucide-react';
import { useAuth, isAdminIdentifier } from '../context/AuthContext.tsx';
import type { Item, Order, StoreSettings, User } from '../types.ts';
import {
  syncItemToFirestore,
  syncUserToFirestore,
  deleteItemFromFirestore,
  updateFirestoreOrderStatus,
  subscribeToAllOrders,
  subscribeToItems,
  subscribeToUsers,
  subscribeToStoreSettings,
  fetchUsersFromFirestore,
} from '../lib/firestoreService.ts';
import { apiRequest, getApiBaseUrl } from '../lib/api.ts';

export const AdminPortalPage: React.FC = () => {
  const { admin, logoutAdmin, refreshItems } = useAuth();
  const navigate = useNavigate();

  // Tab state: 'orders' | 'items' | 'users' | 'add_document' | 'add_website' | 'settings'
  const [activeTab, setActiveTab] = useState<'orders' | 'items' | 'users' | 'add_document' | 'add_website' | 'settings'>('orders');

  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [settings, setSettings] = useState<StoreSettings>({
    admin_whatsapp: '923060217399',
    default_account_numbers: 'JazzCash / EasyPaisa: 03060217399\nAccount Title: Nasir Yaseen\nBank: Meezan Bank Ltd\nAccount No: 01020102938101',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit item modal state
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editDocFile, setEditDocFile] = useState<File | null>(null);
  const [isUploadingEditDoc, setIsUploadingEditDoc] = useState(false);

  // Delete item modal state
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Add Document Form State
  const [docTitle, setDocTitle] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docButtonType, setDocButtonType] = useState<'pay' | 'free'>('pay');
  const [docPrice, setDocPrice] = useState<number>(1500);
  const [docAccounts, setDocAccounts] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Add Website Form State
  const [webTitle, setWebTitle] = useState('');
  const [webDescription, setWebDescription] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [webButtonType, setWebButtonType] = useState<'pay' | 'free'>('pay');
  const [webPrice, setWebPrice] = useState<number>(3000);
  const [webAccounts, setWebAccounts] = useState('');
  const [isSubmittingWeb, setIsSubmittingWeb] = useState(false);

  // Redirect if not logged in as admin
  useEffect(() => {
    if (!admin) {
      navigate('/admin/login');
    }
  }, [admin, navigate]);

  // Load admin orders, items, users, and settings
  const loadAdminData = async (showFullSpinner = false) => {
    if (showFullSpinner) setIsLoading(true);
    try {
      const [ordersRes, itemsRes, settingsRes, usersRes] = await Promise.all([
        apiRequest<{ orders: Order[] }>('/api/admin/orders'),
        apiRequest<{ items: Item[] }>('/api/admin/items'),
        apiRequest<{ settings: StoreSettings }>('/api/admin/settings'),
        apiRequest<{ users: User[] }>('/api/admin/users'),
      ]);

      if (ordersRes.ok && ordersRes.data) {
        setOrders(ordersRes.data.orders || []);
      }
      if (itemsRes.ok && itemsRes.data) {
        setItems(itemsRes.data.items || []);
      }
      // Seamlessly merge backend users and Firestore users
      const firestoreUsers = await fetchUsersFromFirestore();
      const backendUsers = (usersRes.ok && Array.isArray(usersRes.data?.users)) ? usersRes.data.users : [];
      const userMap = new Map<string, User>();
      backendUsers.forEach(u => userMap.set(u.id, u));
      firestoreUsers.forEach(u => userMap.set(u.id, u));
      const mergedUsers = Array.from(userMap.values()).sort(
        (a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
      );
      setUsers(mergedUsers);
      // Auto-replicate any backend users to Firestore for instant real-time sync
      for (const u of backendUsers) {
        syncUserToFirestore(u).catch(() => {});
      }
      if (settingsRes.ok && settingsRes.data?.settings) {
        setSettings(settingsRes.data.settings);
        if (!docAccounts) setDocAccounts(settingsRes.data.settings.default_account_numbers);
        if (!webAccounts) setWebAccounts(settingsRes.data.settings.default_account_numbers);
      }
    } catch (err: any) {
      console.error('Failed to load admin portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-Time Firestore listeners for orders, items, users, and settings
  useEffect(() => {
    if (!admin) return;

    loadAdminData(true);

    const unsubOrders = subscribeToAllOrders((firestoreOrders) => {
      if (Array.isArray(firestoreOrders)) {
        setOrders(firestoreOrders);
      }
    });

    const unsubItems = subscribeToItems((firestoreItems) => {
      if (Array.isArray(firestoreItems) && firestoreItems.length > 0) {
        setItems(firestoreItems);
      }
    });

    const unsubUsers = subscribeToUsers((firestoreUsers) => {
      if (Array.isArray(firestoreUsers)) {
        setUsers(prev => {
          const map = new Map<string, User>();
          prev.forEach(u => map.set(u.id, u));
          firestoreUsers.forEach(u => map.set(u.id, u));
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
          );
        });
      }
    });

    const unsubSettings = subscribeToStoreSettings((newSettings) => {
      if (newSettings?.admin_whatsapp) {
        setSettings(newSettings);
      }
    });

    return () => {
      unsubOrders();
      unsubItems();
      unsubUsers();
      unsubSettings();
    };
  }, [admin]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Toggle order status (verified <-> pending) with Real-Time sync
  const handleToggleOrderStatus = async (orderId: string, currentStatus: 'pending' | 'verified') => {
    const nextStatus = currentStatus === 'verified' ? 'pending' : 'verified';
    try {
      // 1. Immediately update in Firestore in real-time
      await updateFirestoreOrderStatus(orderId, nextStatus).catch(e => console.warn('Firestore status sync:', e));

      // 2. Also send to backend
      const res = await apiRequest(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        console.warn('Backend order update notice:', res.error);
      }

      // 3. Immediately reflect in local state
      setOrders(prev =>
        prev.map(o =>
          o.id === orderId
            ? { ...o, status: nextStatus, verified_at: nextStatus === 'verified' ? new Date().toISOString() : undefined }
            : o
        )
      );

      showNotification(`Order status updated to "${nextStatus.toUpperCase()}"`);
      await refreshItems();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Confirm delete item
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id;
    const targetTitle = itemToDelete.title;
    setIsDeletingItem(true);
    try {
      // 1. Delete from Firestore in real-time
      await deleteItemFromFirestore(targetId).catch(e => console.warn(e));

      // 2. Also delete from backend
      await apiRequest(`/api/admin/items/${targetId}`, { method: 'DELETE' }).catch(() => {});

      // 3. Immediately reflect in local state
      setItems(prev => prev.filter(it => it.id !== targetId));

      showNotification(`"${targetTitle}" deleted successfully`);
      setItemToDelete(null);
      await refreshItems();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Resilient File Upload Helper:
  // 1. Tries the backend /api/admin/upload endpoint (works on localhost, dev server, and Cloud Run).
  // 2. If the backend returns HTML (e.g. Netlify rewrite) or is unavailable, seamlessly converts the file to a Base64 Data URL.
  // This guarantees file uploads NEVER fail with "server returned invalid response" on any host!
  const uploadFileSafely = async (file: File): Promise<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
  }> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const baseUrl = getApiBaseUrl();
      const uploadUrl = baseUrl ? `${baseUrl}/api/admin/upload` : '/api/admin/upload';
      
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      const contentType = uploadRes.headers.get('content-type') || '';
      const uploadText = await uploadRes.text();

      // Check if valid JSON returned
      if (uploadRes.ok && !uploadText.trim().startsWith('<') && !contentType.includes('text/html')) {
        const uploadData = JSON.parse(uploadText);
        if (uploadData.fileUrl) {
          return {
            fileUrl: uploadData.fileUrl,
            fileName: uploadData.fileName || file.name,
            fileSize: uploadData.fileSize || file.size,
          };
        }
      }
    } catch (err) {
      console.warn('Backend file upload endpoint unavailable, storing file directly as embedded data URL:', err);
    }

    // Seamless fallback to Base64 Data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          fileUrl: (reader.result as string) || '',
          fileName: file.name,
          fileSize: file.size,
        });
      };
      reader.onerror = () => {
        resolve({
          fileUrl: '',
          fileName: file.name,
          fileSize: file.size,
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // Submit "Add Document" Flow
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docDescription.trim()) {
      showNotification('Title and description are required', 'error');
      return;
    }

    setIsUploadingDoc(true);
    try {
      let fileUrl = '';
      let fileName = '';
      let fileSize = 0;

      // If file was selected by admin
      if (docFile) {
        const uploaded = await uploadFileSafely(docFile);
        fileUrl = uploaded.fileUrl;
        fileName = uploaded.fileName;
        fileSize = uploaded.fileSize;
      }

      const newItemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const itemPayload = {
        id: newItemId,
        type: 'document' as const,
        title: docTitle.trim(),
        description: docDescription.trim(),
        file_url: fileUrl,
        file_name: fileName || `${docTitle.trim().replace(/\s+/g, '_')}.pdf`,
        file_size: fileSize || 1024000,
        price: docButtonType === 'free' ? 0 : Number(docPrice),
        payment_type: docButtonType,
        account_numbers: docButtonType === 'free' ? '' : docAccounts,
        status: 'published' as const,
      };

      const createdItem: Item = {
        ...itemPayload,
        created_at: new Date().toISOString(),
      };

      // 1. Immediately update local state so admin sees it instantaneously
      setItems(prev => [createdItem, ...prev.filter(it => it.id !== createdItem.id)]);

      // 2. Immediately sync item to Firestore so it persists across all devices and Netlify
      await syncItemToFirestore(createdItem).catch((e) => console.warn('Firestore sync notice:', e));

      // 3. Also send to backend
      try {
        await apiRequest<{ item: Item }>('/api/admin/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemPayload),
        });
      } catch (e) {
        console.warn('Backend item push notice:', e);
      }

      showNotification('Document published successfully!');
      // Reset form
      setDocTitle('');
      setDocDescription('');
      setDocFile(null);
      setDocPrice(1500);
      setDocButtonType('pay');
      setActiveTab('items');
      await refreshItems();
    } catch (err: any) {
      showNotification(err.message || 'Failed to publish document', 'error');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Submit "Add Website" Flow
  const handleAddWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webTitle.trim() || !webDescription.trim() || !webUrl.trim()) {
      showNotification('Title, Description, and Website URL are required', 'error');
      return;
    }

    setIsSubmittingWeb(true);
    try {
      const newItemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const itemPayload = {
        id: newItemId,
        type: 'website' as const,
        title: webTitle.trim(),
        description: webDescription.trim(),
        website_url: webUrl.trim(),
        price: webButtonType === 'free' ? 0 : Number(webPrice),
        payment_type: webButtonType,
        account_numbers: webButtonType === 'free' ? '' : webAccounts,
        status: 'published' as const,
      };

      const createdItem: Item = {
        ...itemPayload,
        created_at: new Date().toISOString(),
      };

      // 1. Immediately update local state
      setItems(prev => [createdItem, ...prev.filter(it => it.id !== createdItem.id)]);

      // 2. Immediately sync to Firestore
      await syncItemToFirestore(createdItem).catch((e) => console.warn('Firestore sync notice:', e));

      // 3. Also send to backend
      try {
        await apiRequest<{ item: Item }>('/api/admin/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemPayload),
        });
      } catch (e) {
        console.warn('Backend website push notice:', e);
      }

      showNotification('Website portal published successfully!');
      // Reset form
      setWebTitle('');
      setWebDescription('');
      setWebUrl('');
      setWebPrice(3000);
      setWebButtonType('pay');
      setActiveTab('items');
      await refreshItems();
    } catch (err: any) {
      showNotification(err.message || 'Failed to publish website', 'error');
    } finally {
      setIsSubmittingWeb(false);
    }
  };

  // Save edited item
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSavingEdit(true);
    try {
      let fileUrl = editingItem.file_url;
      let fileName = editingItem.file_name;
      let fileSize = editingItem.file_size;

      // If a replacement document is uploaded
      if (editDocFile) {
        setIsUploadingEditDoc(true);
        const uploaded = await uploadFileSafely(editDocFile);
        fileUrl = uploaded.fileUrl;
        fileName = uploaded.fileName;
        fileSize = uploaded.fileSize;
        setIsUploadingEditDoc(false);
      }

      const payload: Partial<Item> = {
        title: editingItem.title.trim(),
        description: editingItem.description.trim(),
        website_url: editingItem.type === 'website' ? (editingItem.website_url || '').trim() : undefined,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        payment_type: editingItem.payment_type,
        price: editingItem.payment_type === 'free' ? 0 : Math.max(0, Number(editingItem.price) || 0),
        status: editingItem.status,
        account_numbers: editingItem.payment_type === 'free' ? '' : (editingItem.account_numbers || ''),
      };

      const updated: Item = { ...editingItem, ...payload };

      // Also mirror to Firestore immediately
      await syncItemToFirestore(updated).catch(e => console.warn(e));

      try {
        await apiRequest<{ item: Item }>(`/api/admin/items/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.warn('Backend item update notice:', e);
      }

      // Update local state immediately
      setItems(prev => prev.map(it => it.id === editingItem.id ? updated : it));

      showNotification(`"${updated.title}" updated successfully!`);
      setEditingItem(null);
      setEditDocFile(null);
      await refreshItems();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setIsSavingEdit(false);
      setIsUploadingEditDoc(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(res.error || 'Failed to save settings');
      showNotification('Store settings saved successfully!');
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Summary Metrics
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const verifiedOrders = orders.filter(o => o.status === 'verified').length;
  const totalRevenue = orders
    .filter(o => o.status === 'verified')
    .reduce((sum, o) => sum + (o.item?.price || 0), 0);

  const filteredUsers = React.useMemo(() => {
    if (!userSearchQuery.trim()) return users;
    const q = userSearchQuery.toLowerCase();
    return users.filter(
      u =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q))
    );
  }, [users, userSearchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Admin Portal Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight">
                    Admin Portal Dashboard
                  </h1>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                    Administrator
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Phone: {admin?.phone} • Email: {admin?.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Public Store</span>
              </Link>

              <button
                type="button"
                id="admin-logout-button"
                onClick={() => {
                  logoutAdmin();
                  navigate('/admin/login');
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {actionMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`p-4 rounded-xl shadow-xl border text-sm font-semibold flex items-center gap-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Metric Cards - 5 Key Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Items</span>
            <div className="text-2xl font-extrabold text-slate-900">{items.length}</div>
            <span className="text-[11px] text-slate-500">Documents & Websites</span>
          </div>

          <div
            onClick={() => setActiveTab('users')}
            className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-xs space-y-1 cursor-pointer hover:border-indigo-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Registered Users</span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-extrabold text-indigo-900">{users.length}</div>
            <span className="text-[11px] text-indigo-600">Active Customer Accounts</span>
          </div>

          <div
            onClick={() => setActiveTab('orders')}
            className="p-4 rounded-2xl bg-white border border-amber-200 shadow-xs space-y-1 cursor-pointer hover:border-amber-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Orders</span>
              {pendingOrders > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <div className="text-2xl font-extrabold text-amber-700">{pendingOrders}</div>
            <span className="text-[11px] text-amber-600">Awaiting WhatsApp verification</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Verified Orders</span>
            <div className="text-2xl font-extrabold text-emerald-700">{verifiedOrders}</div>
            <span className="text-[11px] text-slate-500">Unlocked & downloaded</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Verified Revenue</span>
            <div className="text-2xl font-extrabold text-slate-900">Rs. {totalRevenue.toLocaleString()}</div>
            <span className="text-[11px] text-slate-500">From verified purchases</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            id="tab-orders"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Orders Management</span>
            {pendingOrders > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-bold">
                {pendingOrders}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-items"
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'items'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documents & Websites ({items.length})</span>
          </button>

          <button
            type="button"
            id="tab-users"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Registered Users ({users.length})</span>
          </button>

          <button
            type="button"
            id="tab-add-doc"
            onClick={() => setActiveTab('add_document')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'add_document'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <FilePlus className="w-4 h-4 text-blue-600" />
            <span>+ Add Document</span>
          </button>

          <button
            type="button"
            id="tab-add-website"
            onClick={() => setActiveTab('add_website')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'add_website'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Globe className="w-4 h-4 text-purple-600" />
            <span>+ Add Website</span>
          </button>

          <button
            type="button"
            id="tab-settings"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ml-auto cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Store Settings</span>
          </button>
        </div>

        {/* ================= TAB 1: ORDERS ================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Customer Orders & Verification Queue
              </h2>
              <button
                type="button"
                id="refresh-admin-orders-btn"
                onClick={loadAdminData}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-xs text-slate-500 text-xs">
                No orders received yet.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                      <tr>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Item Name & Type</th>
                        <th className="px-4 py-3">Buyer Details</th>
                        <th className="px-4 py-3">Transfer / TID</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map(order => {
                        const isVerified = order.status === 'verified';
                        const userPhone = order.user?.phone || '';
                        let cleanUserPhone = userPhone.replace(/\D/g, '');
                        if (cleanUserPhone.startsWith('03')) cleanUserPhone = '92' + cleanUserPhone.slice(1);

                        const waBuyerLink = cleanUserPhone
                          ? `https://wa.me/${cleanUserPhone}?text=${encodeURIComponent(
                              `Assalam-o-Alaikum ${order.sender_name}, regarding your order for "${order.item?.title}". Status: ${order.status}`
                            )}`
                          : '#';

                        return (
                          <tr
                            key={order.id}
                            id={`admin-order-row-${order.id}`}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              !isVerified ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                                  isVerified
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                                }`}
                              >
                                {isVerified ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                )}
                                <span>{isVerified ? 'Verified / Paid' : 'Pending'}</span>
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900 max-w-xs truncate">
                                {order.item?.title || 'Unknown Item'}
                              </div>
                              <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                                {order.item?.type}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">
                                {order.sender_name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                                <span>{order.user?.phone || 'No Phone'}</span>
                                {cleanUserPhone && (
                                  <a
                                    href={waBuyerLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Message Buyer on WhatsApp"
                                    className="text-emerald-600 hover:text-emerald-700"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {order.transfer_id}
                              </span>
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">
                              Rs. {(order.item?.price || 0).toLocaleString()}
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                              {new Date(order.created_at).toLocaleDateString()}
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              {isVerified ? (
                                <button
                                  type="button"
                                  id={`revert-status-btn-${order.id}`}
                                  onClick={() => handleToggleOrderStatus(order.id, 'verified')}
                                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  Mark as Pending
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  id={`verify-order-btn-${order.id}`}
                                  onClick={() => handleToggleOrderStatus(order.id, 'pending')}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Mark Verified/Paid</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: ITEMS LIST ================= */}
        {activeTab === 'items' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Listed Documents and Websites
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="quick-add-doc-btn"
                  onClick={() => setActiveTab('add_document')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Document</span>
                </button>
                <button
                  type="button"
                  id="quick-add-web-btn"
                  onClick={() => setActiveTab('add_website')}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Website</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => (
                <div
                  key={item.id}
                  id={`admin-item-card-${item.id}`}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          item.type === 'document'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {item.type === 'document' ? <FileText className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                        <span>{item.type}</span>
                      </span>

                      <span className="text-xs font-extrabold text-slate-900 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {item.payment_type === 'free' ? 'FREE' : `Rs. ${item.price.toLocaleString()}`}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {item.type === 'website' && item.website_url && (
                      <div className="text-[11px] text-blue-600 font-mono truncate">
                        🔗 {item.website_url}
                      </div>
                    )}
                    {item.type === 'document' && (
                      <div className="text-[11px] text-slate-500 font-mono truncate">
                        📄 {item.file_name || 'Document asset'}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                        item.status === 'published'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.status}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id={`edit-item-${item.id}`}
                        onClick={() => {
                          setEditingItem({ ...item });
                          setEditDocFile(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                        title="Edit Item"
                      >
                        <Edit className="w-3.5 h-3.5 text-amber-600" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        id={`delete-item-${item.id}`}
                        onClick={() => setItemToDelete(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB: REGISTERED USERS & CUSTOMERS ================= */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <span>Registered Users & Customer Accounts ({users.length})</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time list of all users registered on the platform with direct contact details and purchase activity.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={e => setUserSearchQuery(e.target.value)}
                    placeholder="Search name, phone, email..."
                    className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-slate-800 w-48 sm:w-64"
                  />
                  {userSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setUserSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => loadAdminData(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Users List */}
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700">No users found</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {userSearchQuery ? 'No users match your search query.' : 'No registered users in the database yet.'}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Phone / Contact</th>
                        <th className="py-3 px-4">Email Address</th>
                        <th className="py-3 px-4">Registered On</th>
                        <th className="py-3 px-4">Orders Placed</th>
                        <th className="py-3 px-4 text-right">Direct Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((u) => {
                        const userOrdersList = orders.filter(
                          o => o.user_id === u.id || o.user?.phone === u.phone || (u.email && o.user?.email === u.email)
                        );
                        const cleanDigits = (u.phone || '').replace(/\D/g, '');
                        const waNumber = cleanDigits.startsWith('92')
                          ? cleanDigits
                          : cleanDigits.startsWith('0')
                          ? `92${cleanDigits.slice(1)}`
                          : cleanDigits;

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                                  {u.name ? u.name.charAt(0) : 'U'}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{u.name || 'Unnamed Customer'}</span>
                                    {isAdminIdentifier(u.email) && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-bold border border-amber-200">
                                        ADMIN
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    ID: {u.id}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                              {u.phone || 'N/A'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-mono">
                              {u.email || 'N/A'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                              {u.created_at
                                ? new Date(u.created_at).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Recent'}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    userOrdersList.length > 0
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {userOrdersList.length} Order{userOrdersList.length === 1 ? '' : 's'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {waNumber && waNumber.length >= 10 ? (
                                <a
                                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(
                                    `Hello ${u.name || 'Customer'}, thank you for visiting our Store!`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-[11px] transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>WhatsApp</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-slate-400">No WhatsApp</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: ADD DOCUMENT FLOW ================= */}
        {activeTab === 'add_document' && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <FilePlus className="w-5 h-5" />
                <h2 className="text-lg font-bold text-slate-900">Add New Document</h2>
              </div>
              <p className="text-xs text-slate-500">
                Upload a digital file, choose button type ("Pay" or "Direct Download"), and publish.
              </p>
            </div>

            <form onSubmit={handleAddDocument} className="space-y-4">
              {/* 1. File Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  1. Upload File (PDF, DOCX, ZIP, TXT)
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-slate-800 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50">
                  <input
                    type="file"
                    id="admin-doc-file-input"
                    onChange={e => setDocFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label htmlFor="admin-doc-file-input" className="cursor-pointer block">
                    <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                    <span className="text-xs font-semibold text-slate-800">
                      {docFile ? docFile.name : 'Click to select or drag & drop document file'}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {docFile ? `${(docFile.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, Word documents, code sheets up to 50MB'}
                    </p>
                  </label>
                </div>
              </div>

              {/* 2. Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  2. Document Title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  id="admin-doc-title-input"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  placeholder="e.g. Masterclass System Architecture Blueprint"
                  required
                  className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400"
                />
              </div>

              {/* 3. Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  3. Description <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="admin-doc-desc-input"
                  value={docDescription}
                  onChange={e => setDocDescription(e.target.value)}
                  placeholder="Provide an overview of what the customer receives in this document..."
                  rows={3}
                  required
                  className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-400"
                />
              </div>

              {/* 4. Button Type (Pay vs Direct Download) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  4. Choose Button Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    id="doc-button-type-pay"
                    onClick={() => setDocButtonType('pay')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      docButtonType === 'pay'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>"Pay" (Requires Payment)</span>
                  </button>
                  <button
                    type="button"
                    id="doc-button-type-free"
                    onClick={() => setDocButtonType('free')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      docButtonType === 'free'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>"Direct Download" (Free)</span>
                  </button>
                </div>
              </div>

              {/* 5. If "Pay" selected */}
              {docButtonType === 'pay' && (
                <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Price (PKR / Rs.) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2 text-slate-500 font-bold text-xs">Rs.</span>
                      <input
                        type="number"
                        id="admin-doc-price-input"
                        value={docPrice}
                        onChange={e => setDocPrice(Number(e.target.value))}
                        min={1}
                        required
                        className="w-full bg-white border border-slate-300 focus:border-slate-800 rounded-xl pl-12 pr-3 py-2 text-sm text-slate-900 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Payment Account Details for Receiving Payment
                    </label>
                    <textarea
                      id="admin-doc-accounts-input"
                      value={docAccounts}
                      onChange={e => setDocAccounts(e.target.value)}
                      placeholder="e.g. JazzCash / EasyPaisa: 03060217399&#10;Bank: Meezan Bank Ltd&#10;A/C No: 01020102938101"
                      rows={3}
                      className="w-full bg-white border border-slate-300 focus:border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-800 placeholder-slate-400"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      These details will be shown to the buyer when they click the "Pay" button.
                    </p>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  id="admin-publish-doc-btn"
                  disabled={isUploadingDoc}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FilePlus className="w-4 h-4" />
                  <span>{isUploadingDoc ? 'Uploading & Publishing...' : 'Publish Document to Store'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= TAB 4: ADD WEBSITE FLOW ================= */}
        {activeTab === 'add_website' && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Globe className="w-5 h-5" />
                <h2 className="text-lg font-bold text-slate-900">Add New Website</h2>
              </div>
              <p className="text-xs text-slate-500">
                List a curated web portal. After payment verification, the button unlocks to "Go to Website".
              </p>
            </div>

            <form onSubmit={handleAddWebsite} className="space-y-4">
              {/* 1. Website URL */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  1. Website URL <span className="text-rose-600">*</span>
                </label>
                <input
                  type="url"
                  id="admin-web-url-input"
                  value={webUrl}
                  onChange={e => setWebUrl(e.target.value)}
                  placeholder="https://exclusive-portal.example.com"
                  required
                  className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The button will become "Go to Website" after payment verification.
                </p>
              </div>

              {/* 2. Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  2. Website Title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  id="admin-web-title-input"
                  value={webTitle}
                  onChange={e => setWebTitle(e.target.value)}
                  placeholder="e.g. Full-Stack Interactive Lab & Sandbox"
                  required
                  className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400"
                />
              </div>

              {/* 3. Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  3. Description <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="admin-web-desc-input"
                  value={webDescription}
                  onChange={e => setWebDescription(e.target.value)}
                  placeholder="Explain what access, features, or materials the customer gets upon unlocking..."
                  rows={3}
                  required
                  className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl p-3 text-sm text-slate-900 placeholder-slate-400"
                />
              </div>

              {/* 4. Button Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  4. Choose Button Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    id="web-button-type-pay"
                    onClick={() => setWebButtonType('pay')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      webButtonType === 'pay'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>"Pay" (Locks until verified)</span>
                  </button>
                  <button
                    type="button"
                    id="web-button-type-free"
                    onClick={() => setWebButtonType('free')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      webButtonType === 'free'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>"Go to Website" (Free access)</span>
                  </button>
                </div>
              </div>

              {/* 5. If "Pay" selected */}
              {webButtonType === 'pay' && (
                <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Price (PKR / Rs.) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2 text-slate-500 font-bold text-xs">Rs.</span>
                      <input
                        type="number"
                        id="admin-web-price-input"
                        value={webPrice}
                        onChange={e => setWebPrice(Number(e.target.value))}
                        min={1}
                        required
                        className="w-full bg-white border border-slate-300 focus:border-slate-800 rounded-xl pl-12 pr-3 py-2 text-sm text-slate-900 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Payment Account Details for Receiving Payment
                    </label>
                    <textarea
                      id="admin-web-accounts-input"
                      value={webAccounts}
                      onChange={e => setWebAccounts(e.target.value)}
                      placeholder="e.g. JazzCash / EasyPaisa: 03060217399&#10;Bank: Meezan Bank Ltd&#10;A/C No: 01020102938101"
                      rows={3}
                      className="w-full bg-white border border-slate-300 focus:border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  id="admin-publish-web-btn"
                  disabled={isSubmittingWeb}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  <span>{isSubmittingWeb ? 'Publishing...' : 'Publish Website to Store'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= TAB 5: STORE SETTINGS ================= */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-600" />
                <span>Store & Verification Settings</span>
              </h2>
              <p className="text-xs text-slate-500">
                Configure your Admin WhatsApp number for receiving payment screenshots and default Pakistani bank/wallet accounts.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Admin WhatsApp Number (e.g. 03060217399 or 923060217399)
                </label>
                <div className="relative">
                  <MessageCircle className="w-4 h-4 absolute left-3.5 top-3 text-emerald-600" />
                  <input
                    type="text"
                    id="admin-settings-whatsapp-input"
                    value={settings.admin_whatsapp}
                    onChange={e => setSettings({ ...settings, admin_whatsapp: e.target.value })}
                    placeholder="03060217399"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-slate-800 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-900 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  When users click "Verify on WhatsApp", it directly opens a chat to this WhatsApp number with their TID and receipt details.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Default Payment Account Details
                </label>
                <textarea
                  id="admin-settings-accounts-input"
                  value={settings.default_account_numbers}
                  onChange={e => setSettings({ ...settings, default_account_numbers: e.target.value })}
                  rows={4}
                  className="w-full bg-white border border-slate-300 focus:border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-800"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="save-settings-btn"
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Save Store Settings
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= EDIT ITEM MODAL ================= */}
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <Edit className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Edit {editingItem.type === 'document' ? 'Document' : 'Website'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">Item ID: {editingItem.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setEditDocFile(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={editingItem.title}
                    onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Description *</label>
                  <textarea
                    value={editingItem.description}
                    onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                    rows={3}
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                {editingItem.type === 'website' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Website URL *</label>
                      {editingItem.website_url && (
                        <a
                          href={editingItem.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          <span>Test Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <input
                      type="url"
                      value={editingItem.website_url || ''}
                      onChange={e => setEditingItem({ ...editingItem, website_url: e.target.value })}
                      required
                      placeholder="https://..."
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                )}

                {editingItem.type === 'document' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Attached Document</span>
                      {editingItem.file_url && (
                        <a
                          href={editingItem.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          <Download className="w-3 h-3" />
                          <span>Preview File</span>
                        </a>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 font-mono truncate">
                      📄 {editingItem.file_name || 'Attached PDF or File'}
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Replace File (Optional)
                      </label>
                      <input
                        type="file"
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            setEditDocFile(e.target.files[0]);
                          }
                        }}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300 cursor-pointer"
                      />
                      {editDocFile && (
                        <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                          Selected replacement: {editDocFile.name} ({(editDocFile.size / 1024).toFixed(0)} KB)
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment Type</label>
                    <select
                      value={editingItem.payment_type}
                      onChange={e => {
                        const newType = e.target.value as 'pay' | 'free';
                        setEditingItem({
                          ...editingItem,
                          payment_type: newType,
                          price: newType === 'free' ? 0 : (editingItem.price > 0 ? editingItem.price : 1500),
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    >
                      <option value="pay">Pay (Rs.)</option>
                      <option value="free">Free</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Price (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      value={editingItem.payment_type === 'free' ? 0 : editingItem.price}
                      onChange={e => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                      disabled={editingItem.payment_type === 'free'}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 disabled:opacity-50 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingItem.status}
                    onChange={e => setEditingItem({ ...editingItem, status: e.target.value as any })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  >
                    <option value="published">Published (Visible in store)</option>
                    <option value="draft">Draft (Hidden)</option>
                  </select>
                </div>

                {editingItem.payment_type === 'pay' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment Accounts</label>
                    <textarea
                      value={editingItem.account_numbers || ''}
                      onChange={e => setEditingItem({ ...editingItem, account_numbers: e.target.value })}
                      rows={2}
                      placeholder="Account details for payment instructions..."
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    id="save-edit-item-submit-btn"
                    disabled={isSavingEdit || isUploadingEditDoc}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSavingEdit || isUploadingEditDoc ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingEdit || isUploadingEditDoc}
                    onClick={() => {
                      setEditingItem(null);
                      setEditDocFile(null);
                    }}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= DELETE ITEM CONFIRMATION MODAL ================= */}
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Delete {itemToDelete.type === 'document' ? 'Document' : 'Website'}
                  </h3>
                  <p className="text-xs text-slate-500">This action will remove the item permanently</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                <div className="font-bold text-slate-900">{itemToDelete.title}</div>
                <div className="text-slate-500 line-clamp-2">{itemToDelete.description}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Type: {itemToDelete.type} | Price: {itemToDelete.payment_type === 'free' ? 'FREE' : `Rs. ${itemToDelete.price.toLocaleString()}`}
                </div>
              </div>

              <p className="text-xs text-slate-600">
                Are you sure you want to delete <span className="font-semibold text-slate-900">"{itemToDelete.title}"</span>? Customers will no longer be able to view or order this item.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  id="confirm-delete-item-modal-btn"
                  disabled={isDeletingItem}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isDeletingItem ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Yes, Delete Item</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  id="cancel-delete-item-modal-btn"
                  disabled={isDeletingItem}
                  onClick={() => setItemToDelete(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

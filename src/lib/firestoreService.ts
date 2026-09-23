import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase.ts';
import type { Item, Order, User, StoreSettings } from '../types.ts';

// Collection references
const USERS_COL = 'users';
const ITEMS_COL = 'items';
const ORDERS_COL = 'orders';
const SETTINGS_COL = 'settings';

/**
 * Save or update user profile in Firestore
 */
export async function syncUserToFirestore(userData: User): Promise<void> {
  if (!userData?.id) return;
  const path = `${USERS_COL}/${userData.id}`;
  try {
    const userRef = doc(db, USERS_COL, userData.id);
    await setDoc(userRef, {
      id: userData.id,
      name: userData.name || 'Store User',
      phone: userData.phone || '',
      email: userData.email || '',
      role: 'customer',
      created_at: userData.created_at || new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore user sync notice:', err);
  }
}

/**
 * Fetch all registered users from Firestore
 */
export async function fetchUsersFromFirestore(): Promise<User[]> {
  try {
    const snap = await getDocs(collection(db, USERS_COL));
    const users: User[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      users.push({
        id: docSnap.id,
        name: data.name || 'User',
        phone: data.phone || '',
        email: data.email || '',
        created_at: data.created_at || new Date().toISOString(),
      });
    });
    return users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.warn('Firestore fetch users notice:', err);
    return [];
  }
}

/**
 * Real-time listener for all registered users (for Admin Portal)
 */
export function subscribeToUsers(onUpdate: (users: User[]) => void): Unsubscribe {
  try {
    const q = collection(db, USERS_COL);
    return onSnapshot(
      q,
      snapshot => {
        const users: User[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          users.push({
            id: docSnap.id,
            name: data.name || 'User',
            phone: data.phone || '',
            email: data.email || '',
            created_at: data.created_at || new Date().toISOString(),
          });
        });
        users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        onUpdate(users);
      },
      error => {
        console.warn('Users subscription notice:', error);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Real-time listener for marketplace items (documents and websites)
 */
export function subscribeToItems(onUpdate: (items: Item[]) => void): Unsubscribe {
  try {
    const q = collection(db, ITEMS_COL);
    return onSnapshot(
      q,
      snapshot => {
        const items: Item[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          items.push({
            id: docSnap.id,
            type: data.type || 'document',
            title: data.title || '',
            description: data.description || '',
            file_url: data.file_url || null,
            file_name: data.file_name || null,
            file_size: data.file_size || null,
            website_url: data.website_url || null,
            price: Number(data.price) || 0,
            payment_type: data.payment_type || 'pay',
            account_numbers: data.account_numbers || '',
            status: data.status || 'published',
            created_at: data.created_at || new Date().toISOString(),
          });
        });
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        onUpdate(items);
      },
      error => {
        console.warn('Items subscription notice:', error);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Real-time listener for customer orders
 */
export function subscribeToUserOrders(
  userId: string,
  onUpdate: (orders: Order[]) => void
): Unsubscribe {
  if (!userId) return () => {};

  try {
    const q = query(collection(db, ORDERS_COL), where('user_id', '==', userId));
    return onSnapshot(
      q,
      snapshot => {
        const orders: Order[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          orders.push({
            id: docSnap.id,
            user_id: data.user_id,
            item_id: data.item_id,
            transfer_id: data.transfer_id,
            sender_name: data.sender_name,
            status: data.status,
            created_at: data.created_at || new Date().toISOString(),
            verified_at: data.verified_at,
            item: data.item,
            user: data.user,
          });
        });
        orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        onUpdate(orders);
      },
      error => {
        console.warn('Orders subscription notice:', error);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Real-time listener for all orders across the entire store (for Admin Portal)
 */
export function subscribeToAllOrders(
  onUpdate: (orders: Order[]) => void
): Unsubscribe {
  try {
    const q = collection(db, ORDERS_COL);
    return onSnapshot(
      q,
      snapshot => {
        const orders: Order[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          orders.push({
            id: docSnap.id,
            user_id: data.user_id,
            item_id: data.item_id,
            transfer_id: data.transfer_id,
            sender_name: data.sender_name,
            status: data.status,
            created_at: data.created_at || new Date().toISOString(),
            verified_at: data.verified_at,
            item: data.item,
            user: data.user,
          });
        });
        orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        onUpdate(orders);
      },
      error => {
        console.warn('All orders subscription notice:', error);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Real-time listener for store settings
 */
export function subscribeToStoreSettings(
  onUpdate: (settings: StoreSettings) => void
): Unsubscribe {
  try {
    const settingsDocRef = doc(db, SETTINGS_COL, 'global');
    return onSnapshot(
      settingsDocRef,
      docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          onUpdate({
            admin_whatsapp: data.admin_whatsapp || '923060217399',
            default_account_numbers: data.default_account_numbers || '',
          });
        }
      },
      error => {
        console.warn('Settings subscription notice:', error);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Save order to Firestore
 */
export async function createFirestoreOrder(order: Order): Promise<void> {
  const path = `${ORDERS_COL}/${order.id}`;
  try {
    const orderRef = doc(db, ORDERS_COL, order.id);
    await setDoc(orderRef, {
      id: order.id,
      user_id: order.user_id,
      item_id: order.item_id,
      transfer_id: order.transfer_id,
      sender_name: order.sender_name,
      status: order.status || 'pending',
      created_at: order.created_at || new Date().toISOString(),
      item: order.item || null,
      user: order.user || null,
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore order sync notice:', err);
  }
}

/**
 * Update order verification status in Firestore (Admin action)
 */
export async function updateFirestoreOrderStatus(
  orderId: string,
  status: 'pending' | 'verified'
): Promise<void> {
  const path = `${ORDERS_COL}/${orderId}`;
  try {
    const orderRef = doc(db, ORDERS_COL, orderId);
    await setDoc(orderRef, {
      status,
      verified_at: status === 'verified' ? new Date().toISOString() : null,
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore order status notice:', err);
  }
}

/**
 * Sync (create or update) item in Firestore
 */
export async function syncItemToFirestore(item: Item): Promise<void> {
  const path = `${ITEMS_COL}/${item.id}`;
  try {
    const itemRef = doc(db, ITEMS_COL, item.id);
    let safeFileUrl = item.file_url || null;
    // Firestore has a strict 1MB document size limit. Prevent huge base64 strings from failing write.
    if (safeFileUrl && safeFileUrl.startsWith('data:') && safeFileUrl.length > 700000) {
      safeFileUrl = null;
    }
    await setDoc(itemRef, {
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      file_url: safeFileUrl,
      file_name: item.file_name || null,
      file_size: item.file_size || null,
      website_url: item.website_url || null,
      price: Number(item.price) || 0,
      payment_type: item.payment_type,
      account_numbers: item.account_numbers || '',
      status: item.status,
      created_at: item.created_at || new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore item sync notice:', err);
  }
}

/**
 * Delete item from Firestore
 */
export async function deleteItemFromFirestore(itemId: string): Promise<void> {
  const path = `${ITEMS_COL}/${itemId}`;
  try {
    const itemRef = doc(db, ITEMS_COL, itemId);
    await deleteDoc(itemRef);
  } catch (err) {
    console.warn('Firestore item delete notice:', err);
  }
}

/**
 * Store Admin credentials and profile in Firebase Firestore
 */
export async function syncAdminToFirestore(adminData: {
  email: string;
  phone: string;
  password?: string;
}): Promise<void> {
  try {
    const adminRef = doc(db, 'admins', 'adm_nasir');
    await setDoc(adminRef, {
      id: 'adm_nasir',
      name: 'Nasir Yaseen (Admin)',
      email: adminData.email.trim().toLowerCase(),
      phone: adminData.phone.trim(),
      password: adminData.password || 'nasir3882011',
      role: 'admin',
      updated_at: new Date().toISOString(),
    }, { merge: true });

    // Also ensure global store settings exist in Firestore
    const settingsRef = doc(db, SETTINGS_COL, 'global');
    await setDoc(settingsRef, {
      admin_whatsapp: '923060217399',
      default_account_numbers: 'JazzCash / EasyPaisa: 03060217399\nAccount Title: Nasir Yaseen\nBank: Meezan Bank Ltd\nAccount No: 01020102938101\nIBAN: PK72MEZN0001020102938101',
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore admin credentials sync notice:', err);
  }
}



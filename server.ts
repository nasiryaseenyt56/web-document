import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  registerUser,
  loginUser,
  findUserById,
  verifyAdmin,
  checkAdminByCredentials,
  syncAdminUser,
  getAdminSettings,
  updateAdminSettings,
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  createOrder,
  getAllOrders,
  getOrdersForUser,
  updateOrderStatus,
  isItemUnlockedForUser,
  getUserOrderForItem,
  syncGoogleUser,
  readDatabase,
} from './server/db.ts';

const app = express();
const PORT = 3000;
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage for uploaded documents
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS headers for resilient API communication across reverse proxies & preview domains
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// User Registration / Admin Direct Login
app.post('/api/auth/signup', (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and Phone Number are required' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim();

    // Check if entered credentials match Admin
    const adminMatch = verifyAdmin(cleanEmail || cleanPhone, password, cleanPhone) || checkAdminByCredentials(name, phone, email);
    if (adminMatch) {
      const user = syncAdminUser(adminMatch);
      return res.json({
        user,
        admin: adminMatch,
        isAdmin: true,
        message: 'Admin login successful',
      });
    }

    const cleanName = name.trim();
    const effectiveEmail = cleanEmail || (cleanName.includes('@') ? cleanName : `${cleanPhone.replace(/\D/g, '')}@buyer.docweb`);
    const user = registerUser(cleanName, cleanPhone, effectiveEmail);
    return res.status(201).json({ user, message: 'Registration successful' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

// User Login (Email / Phone + Password) / Admin Direct Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    const identifier = (email || phone || name || '').trim();
    if (!identifier) {
      return res.status(400).json({ error: 'Email or Phone Number is required' });
    }

    // 1. Check if entered credentials match Admin (Email/Phone + Password)
    const adminMatch = verifyAdmin(identifier, password, phone) || checkAdminByCredentials(identifier, phone || identifier, email);
    if (adminMatch) {
      const user = syncAdminUser(adminMatch);
      return res.json({
        user,
        admin: adminMatch,
        isAdmin: true,
        message: 'Admin login successful',
      });
    }

    const user = loginUser(name || identifier, phone || identifier);
    return res.json({ user, message: 'Login successful' });
  } catch (error: any) {
    return res.status(401).json({ error: error.message || 'Login failed' });
  }
});

// GET status handler for /api/auth/login
app.get('/api/auth/login', (_req, res) => {
  return res.json({ status: 'ok', endpoint: '/api/auth/login', method: 'POST required' });
});

// Firebase / Google Auth Sync
app.post('/api/auth/google-sync', (req, res) => {
  try {
    const { name, email, phone, uid } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const user = syncGoogleUser(name, email, phone, uid);
    const cleanEmail = email.trim().toLowerCase();

    // Check against all registered admins or primary admin
    const db = readDatabase();
    const adminFromDb = db.admins.find(a => a.email.trim().toLowerCase() === cleanEmail);
    const isPrimaryAdmin = cleanEmail === 'nasiryaseen2011@gmail.com';

    let adminRecord = adminFromDb || null;
    if (!adminRecord && isPrimaryAdmin) {
      adminRecord = {
        id: 'adm_nasir',
        phone: '03060217399',
        email: cleanEmail,
        created_at: new Date().toISOString(),
      };
      db.admins.push(adminRecord);
    }

    return res.json({
      user,
      admin: adminRecord,
      isAdmin: Boolean(adminRecord),
      message: 'Google authentication successful',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Google sync failed' });
  }
});

// Check current user session
app.get('/api/auth/me', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user });
});

// Admin Login (Email + Password)
app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password, phone } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Admin Email and Password are required' });
    }
    const admin = verifyAdmin(email, password, phone);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid admin credentials. Please check your email and password.' });
    }
    return res.json({ admin, message: 'Admin login successful' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Admin authentication failed' });
  }
});

// Public Items list (with unlock status calculated per user)
app.get('/api/items', (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const items = getAllItems(false);

    const enriched = items.map(item => {
      const isFree = item.payment_type === 'free';
      const isUnlocked = isFree || isItemUnlockedForUser(userId, item.id);
      const userOrder = getUserOrderForItem(userId, item.id);

      return {
        ...item,
        isUnlocked,
        userOrder: userOrder ? {
          id: userOrder.id,
          status: userOrder.status,
          transfer_id: userOrder.transfer_id,
          created_at: userOrder.created_at,
        } : null,
      };
    });

    return res.json({ items: enriched });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch items' });
  }
});

// Single Item Detail
app.get('/api/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string | undefined;
    const item = getItemById(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const isFree = item.payment_type === 'free';
    const isUnlocked = isFree || isItemUnlockedForUser(userId, item.id);
    const userOrder = getUserOrderForItem(userId, item.id);

    return res.json({
      item: {
        ...item,
        isUnlocked,
        userOrder,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch item' });
  }
});

// Public store settings (e.g. WhatsApp number for payment verification)
app.get('/api/settings', (_req, res) => {
  return res.json({ settings: getAdminSettings() });
});

// File Upload for Admin Document Creation
app.post('/api/admin/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/api/download/file/${req.file.filename}`;
    return res.json({
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      storedName: req.file.filename,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'File upload failed' });
  }
});

// Admin: Get All Items (including drafts)
app.get('/api/admin/items', (_req, res) => {
  try {
    const items = getAllItems(true);
    return res.json({ items });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch items' });
  }
});

// Admin: Create Item (Document or Website)
app.post('/api/admin/items', (req, res) => {
  try {
    const {
      type,
      title,
      description,
      file_url,
      file_name,
      file_size,
      website_url,
      price,
      payment_type,
      account_numbers,
      status,
    } = req.body;

    if (!type || !title || !description) {
      return res.status(400).json({ error: 'Type, Title, and Description are required' });
    }
    if (type === 'website' && !website_url) {
      return res.status(400).json({ error: 'Website URL is required for websites' });
    }
    if (payment_type === 'pay' && (price === undefined || price < 0)) {
      return res.status(400).json({ error: 'Valid price is required for paid items' });
    }

    const newItem = createItem({
      type,
      title,
      description,
      file_url: file_url || undefined,
      file_name: file_name || undefined,
      file_size: file_size ? Number(file_size) : undefined,
      website_url: website_url || undefined,
      price: payment_type === 'free' ? 0 : Number(price),
      payment_type: payment_type || 'pay',
      account_numbers: account_numbers || '',
      status: status || 'published',
    });

    return res.status(201).json({ item: newItem, message: 'Item created successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create item' });
  }
});

// Admin: Update Item
app.put('/api/admin/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updated = updateItem(id, req.body);
    return res.json({ item: updated, message: 'Item updated successfully' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to update item' });
  }
});

// Admin: Delete Item
app.delete('/api/admin/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteItem(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Item not found' });
    }
    return res.json({ message: 'Item deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete item' });
  }
});

// Create Order (User submits payment details)
app.post('/api/orders', (req, res) => {
  try {
    const { userId, itemId, transferId, senderName } = req.body;
    if (!userId || !itemId || !transferId || !senderName) {
      return res.status(400).json({ error: 'User ID, Item ID, Transfer ID, and Sender Name are all required' });
    }
    const user = findUserById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Please log in or create an account before making a purchase.' });
    }
    const order = createOrder({
      userId,
      itemId,
      transferId,
      senderName,
    });
    return res.status(201).json({ order, message: 'Payment details submitted successfully' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to submit order' });
  }
});

// User: Get My Orders
app.get('/api/orders/my', (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    const orders = getOrdersForUser(userId);
    return res.json({ orders });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch user orders' });
  }
});

// Admin: Get All Orders
app.get('/api/admin/orders', (_req, res) => {
  try {
    const orders = getAllOrders();
    return res.json({ orders });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch orders' });
  }
});

// Admin: Update Order Status (Verified / Pending)
app.put('/api/admin/orders/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['pending', 'verified'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "pending" or "verified"' });
    }
    const updated = updateOrderStatus(id, status);
    return res.json({ order: updated, message: `Order marked as ${status}` });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to update order status' });
  }
});

// Admin Settings
app.get('/api/admin/settings', (_req, res) => {
  return res.json({ settings: getAdminSettings() });
});

app.put('/api/admin/settings', (req, res) => {
  try {
    const settings = updateAdminSettings(req.body);
    return res.json({ settings, message: 'Settings updated successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update settings' });
  }
});

// Secure Document Download
app.get('/api/download/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.query.userId as string | undefined;
    const isAdmin = req.query.admin === 'true';

    const item = getItemById(itemId);
    if (!item || item.type !== 'document') {
      return res.status(404).send('Document not found');
    }

    // Check authorization: Admin, free document (requires user login), or verified order
    if (!userId && !isAdmin) {
      return res.status(401).send('Please sign in to download this document.');
    }

    const isAuthorized = isAdmin || item.payment_type === 'free' || isItemUnlockedForUser(userId, itemId);
    if (!isAuthorized) {
      return res.status(403).send('Access denied. Please purchase and wait for payment verification to download this document.');
    }

    // Find actual file
    const sampleDoc = path.join(UPLOADS_DIR, `${itemId}.txt`);
    let targetFilePath = '';
    let downloadFileName = item.file_name || `${item.title.replace(/\s+/g, '_')}.txt`;

    if (item.file_url && item.file_url.includes('/api/download/file/')) {
      const storedFileName = item.file_url.split('/api/download/file/')[1];
      const uploadedFile = path.join(UPLOADS_DIR, storedFileName);
      if (fs.existsSync(uploadedFile)) {
        targetFilePath = uploadedFile;
      }
    }

    if (!targetFilePath && fs.existsSync(sampleDoc)) {
      targetFilePath = sampleDoc;
    }

    if (!targetFilePath) {
      // Fallback: create dynamic content file for demonstration
      targetFilePath = path.join(UPLOADS_DIR, `${itemId}-content.txt`);
      fs.writeFileSync(
        targetFilePath,
        `=== Document: ${item.title} ===\n\n${item.description}\n\nDownloaded by authorized user at: ${new Date().toISOString()}\nLicense: Authorized Single-User Copy.`
      );
    }

    res.download(targetFilePath, downloadFileName);
  } catch (error: any) {
    return res.status(500).send('Error processing download');
  }
});

// Direct uploaded file serving helper
app.get('/api/download/file/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Serve uploads statically
app.use('/uploads', express.static(UPLOADS_DIR));

// ==================== VITE & SPA FALLBACK SETUP ====================
async function startServer() {
  // Explicit 404 JSON handler for any unmatched /api routes
  // Mounted BEFORE Vite or static middleware so missing API calls return JSON error, not HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      ok: false,
      error: `API endpoint '${req.method} ${req.path}' not found on backend server`,
      path: req.path,
      method: req.method,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    // Catch-all route to serve and transform index.html for client-side routing on reload
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl || req.url || '';
      // Strictly prevent API and uploads routes from returning HTML
      if (url.startsWith('/api') || url.startsWith('/uploads')) {
        return res.status(404).json({
          ok: false,
          error: `Endpoint '${url}' not found`,
        });
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        if (!fs.existsSync(indexPath)) {
          return next();
        }
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        if (vite) {
          vite.ssrFixStacktrace(e);
        }
        next(e);
      }
    });
  } else {
    // Robustly locate production dist directory
    let distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath) && fs.existsSync(path.join(__dirname, 'index.html'))) {
      distPath = __dirname;
    } else if (!fs.existsSync(distPath) && fs.existsSync(path.join(process.cwd(), 'index.html'))) {
      distPath = process.cwd();
    }

    // Serve static files from production build
    app.use(express.static(distPath));

    // Ensure all client-side routes (SPA) fall back to index.html on refresh
    app.get('*', (req, res) => {
      // Exclude API routes and uploads from SPA fallback to avoid confusing errors
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }

      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }

      const fallbackIndex = path.join(process.cwd(), 'index.html');
      if (fs.existsSync(fallbackIndex)) {
        return res.sendFile(fallbackIndex);
      }

      return res.status(404).send('Application index.html could not be located.');
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Goods Store Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

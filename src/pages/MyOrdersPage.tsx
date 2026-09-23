import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Download,
  ExternalLink,
  MessageCircle,
  FileText,
  Globe,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getApiBaseUrl } from '../lib/api.ts';

export const MyOrdersPage: React.FC = () => {
  const { user, userOrders, settings, refreshUserOrders, refreshItems, openAuthModal } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl bg-white border border-slate-200 shadow-xl">
          <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Login to View Purchases</h2>
          <p className="text-xs text-slate-600">
            Sign in with your phone number or email to access your purchased documents, order status, and unlocked portals.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
            <button
              type="button"
              id="my-orders-login-btn"
              onClick={() => openAuthModal(true)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Sign In to Continue
            </button>
            <Link
              to="/"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors inline-block"
            >
              Go to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleRefresh = async () => {
    await Promise.all([refreshUserOrders(), refreshItems()]);
  };

  const rawWhatsapp = settings?.admin_whatsapp || '03060217399';
  let cleanWhatsapp = rawWhatsapp.replace(/\D/g, '');
  if (cleanWhatsapp.startsWith('03')) {
    cleanWhatsapp = '92' + cleanWhatsapp.slice(1);
  } else if (!cleanWhatsapp.startsWith('92') && cleanWhatsapp.length === 10) {
    cleanWhatsapp = '92' + cleanWhatsapp;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Marketplace</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              My Orders & Downloads
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Account: <strong className="text-slate-800">{user.name}</strong> • Phone: <strong className="text-slate-800">{user.phone}</strong>
            </p>
          </div>

          <button
            type="button"
            id="refresh-orders-btn"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Status</span>
          </button>
        </div>

        {/* Orders List */}
        {userOrders.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">No orders placed yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Explore the marketplace to find curated documents and exclusive web portals.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              Browse Items
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {userOrders.map(order => {
              const isVerified = order.status === 'verified';
              const itemType = order.item?.type || 'document';
              const waMessage = `Assalam-o-Alaikum, following up on payment verification for "${order.item?.title || 'Purchase'}".
Sender Name: ${order.sender_name}
Phone: ${user.phone}
Transfer TID: ${order.transfer_id}
Please verify my payment. Screenshot attached.`;

              const waLink = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(waMessage)}`;

              return (
                <div
                  key={order.id}
                  id={`order-card-${order.id}`}
                  className={`p-6 rounded-2xl bg-white border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xs ${
                    isVerified
                      ? 'border-emerald-300'
                      : 'border-amber-300'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Status & Type */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
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
                        <span>{isVerified ? 'Verified & Paid' : 'Verification Pending'}</span>
                      </span>

                      <span className="text-xs text-slate-300">•</span>

                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold">
                        {itemType === 'document' ? (
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-purple-600" />
                        )}
                        <span className="capitalize">{itemType}</span>
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        {order.item?.title || 'Digital Item'}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                        <span>Price: <strong className="text-slate-800">Rs. {(order.item?.price || 0).toLocaleString()}</strong></span>
                        <span>•</span>
                        <span>Sender: <strong className="text-slate-800">{order.sender_name}</strong></span>
                        <span>•</span>
                        <span>TID: <strong className="font-mono text-slate-800">{order.transfer_id}</strong></span>
                        <span>•</span>
                        <span>Date: {new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {isVerified ? (
                      itemType === 'document' ? (
                        <a
                          id={`download-order-${order.id}`}
                          href={order.item?.file_url?.startsWith('data:') ? order.item.file_url : `${getApiBaseUrl()}/api/download/${order.item_id}?userId=${user.id}`}
                          download={order.item?.file_name || 'document.pdf'}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download File</span>
                        </a>
                      ) : (
                        <a
                          id={`visit-website-${order.id}`}
                          href={order.item?.website_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Open Website</span>
                        </a>
                      )
                    ) : (
                      <a
                        id={`whatsapp-followup-${order.id}`}
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Send WhatsApp Screenshot</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

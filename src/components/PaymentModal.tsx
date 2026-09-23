import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  CheckCircle2,
  Clock,
  MessageCircle,
  Copy,
  Check,
  Download,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import type { Item, Order } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { getApiBaseUrl } from '../lib/api.ts';

interface PaymentModalProps {
  item: Item | null;
  isOpen: boolean;
  onClose: () => void;
  existingOrder?: Order | null;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  item,
  isOpen,
  onClose,
  existingOrder,
}) => {
  const { user, settings, submitOrder, userOrders, openAuthModal } = useAuth();

  const [senderName, setSenderName] = useState(user?.name || '');
  const [transferId, setTransferId] = useState('');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(existingOrder || null);

  // Enforce authentication: without login, payment modal cannot be used
  useEffect(() => {
    if (isOpen && !user) {
      onClose();
      openAuthModal(true);
    }
  }, [isOpen, user, onClose, openAuthModal]);

  // Sync sender name when user changes
  useEffect(() => {
    if (user?.name && !senderName) {
      setSenderName(user.name);
    }
  }, [user, senderName]);

  // Sync order if changed
  useEffect(() => {
    if (existingOrder) {
      setSubmittedOrder(existingOrder);
    } else {
      setSubmittedOrder(null);
      setTransferId('');
    }
  }, [existingOrder, isOpen]);

  // Check if this item became verified through live context polling
  const liveOrder = item
    ? userOrders.find(o => o.item_id === item.id)
    : undefined;

  const currentOrder = liveOrder || submittedOrder;
  const isVerified = currentOrder?.status === 'verified';

  if (!isOpen || !item) return null;

  const handleCopyAccounts = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in first to submit your payment details.');
      return;
    }
    if (!senderName.trim() || !transferId.trim()) {
      setError('Please provide both Sender Name and Account/Transfer ID / TID');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const order = await submitOrder(item.id, transferId, senderName);
      setSubmittedOrder(order);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format WhatsApp number for Pakistan
  const rawWhatsapp = settings?.admin_whatsapp || '03060217399';
  let cleanWhatsapp = rawWhatsapp.replace(/\D/g, '');
  if (cleanWhatsapp.startsWith('03')) {
    cleanWhatsapp = '92' + cleanWhatsapp.slice(1);
  } else if (!cleanWhatsapp.startsWith('92') && cleanWhatsapp.length === 10) {
    cleanWhatsapp = '92' + cleanWhatsapp;
  }

  const waMessage = `Assalam-o-Alaikum, I have submitted payment for "${item.title}" (Amount: Rs. ${item.price.toLocaleString()}).
Sender Name: ${currentOrder?.sender_name || senderName}
Buyer Phone: ${user?.phone || 'N/A'}
Transfer / Transaction ID (TID): ${currentOrder?.transfer_id || transferId}

I am attaching my payment receipt screenshot here. Please verify and unlock access. Thank you!`;

  const waLink = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(waMessage)}`;

  // Payment instructions
  const accountInfo =
    item.account_numbers ||
    settings?.default_account_numbers ||
    'JazzCash / EasyPaisa: 03060217399\nAccount Title: Nasir Yaseen\nBank: Meezan Bank Ltd';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        id="payment-process-modal"
        className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-900 max-h-[92vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 line-clamp-1">
                {isVerified
                  ? 'Payment Verified & Unlocked'
                  : currentOrder
                  ? 'Verification Pending'
                  : `Pay Rs. ${item.price.toLocaleString()} to Unlock`}
              </h2>
              <p className="text-xs text-slate-500 line-clamp-1">
                {item.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-payment-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Order Verified State (Instant Access) */}
          {isVerified ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Payment Verified!</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Your payment has been verified by Admin. You now have full lifetime access.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-600 space-y-1">
                <div><span className="text-slate-900 font-semibold">Item:</span> {item.title}</div>
                <div><span className="text-slate-900 font-semibold">Transfer / TID:</span> {currentOrder?.transfer_id}</div>
                <div><span className="text-slate-900 font-semibold">Verified On:</span> {currentOrder?.verified_at ? new Date(currentOrder.verified_at).toLocaleString() : 'Just now'}</div>
              </div>

              <div className="pt-2">
                {item.type === 'document' ? (
                  <a
                    id="modal-verified-download-btn"
                    href={`${getApiBaseUrl()}/api/download/${item.id}?userId=${user?.id || ''}`}
                    download
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download Document File</span>
                  </a>
                ) : (
                  <a
                    id="modal-verified-website-btn"
                    href={item.website_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-5 h-5" />
                    <span>Go to Website Now</span>
                  </a>
                )}
              </div>
            </div>
          ) : currentOrder ? (
            /* Order Submitted / Pending State */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm text-amber-900">
                  <Clock className="w-4 h-4 text-amber-700 animate-spin-slow" />
                  <span>Order Status: Pending Admin Verification</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-800">
                  We have recorded your transfer reference <strong className="text-slate-900 font-mono bg-amber-100 px-1.5 py-0.5 rounded">{currentOrder.transfer_id}</strong>.
                  Please send your payment screenshot on WhatsApp to Admin (03060217399) for quick approval.
                </p>
              </div>

              {/* Step 2: WhatsApp Button */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  Send Screenshot to Admin on WhatsApp:
                </p>
                <a
                  id="whatsapp-verify-button"
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Verify on WhatsApp (03060217399)</span>
                </a>
                <p className="text-[11px] text-slate-500 text-center">
                  Opens WhatsApp with pre-filled item name, amount (Rs. {item.price.toLocaleString()}), and TID.
                </p>
              </div>

              {/* Live polling status indicator */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                  </span>
                  <span>Auto-detecting approval from admin...</span>
                </div>
                <span className="text-[11px] text-slate-400">Live status</span>
              </div>
            </div>
          ) : (
            /* Normal Payment Form */
            <div className="space-y-5">
              {/* Pricing breakdown */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">Total Amount to Pay</span>
                  <span className="text-2xl font-extrabold text-slate-900">
                    Rs. {item.price.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-emerald-800 font-semibold px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200">
                    {item.type === 'document' ? 'Document Unlock' : 'Portal Access'}
                  </span>
                </div>
              </div>

              {/* Admin Payment Account Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    1. Send Payment to Account Details:
                  </label>
                  <button
                    type="button"
                    id="copy-account-info-btn"
                    onClick={() => handleCopyAccounts(accountInfo)}
                    className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    {copiedAccount ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAccount ? 'Copied!' : 'Copy Info'}</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-line leading-relaxed select-all">
                  {accountInfo}
                </div>
                <p className="text-[11px] text-slate-500">
                  Pay using JazzCash, EasyPaisa, SadaPay, NayaPay, or Bank Transfer to the details above.
                </p>
              </div>

              {/* Form for Submission */}
              <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Submit Your Transfer Details:
                </label>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sender Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="payment-sender-name-input"
                    value={senderName}
                    onChange={e => setSenderName(e.target.value)}
                    placeholder="Name appearing on payment receipt"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transaction ID / TID / Ref No. <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="payment-transfer-id-input"
                    value={transferId}
                    onChange={e => setTransferId(e.target.value)}
                    placeholder="e.g. TID-123456789 or Bank Ref Number"
                    required
                    className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Found on your JazzCash, EasyPaisa, or banking receipt (TID / Reference Number).
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    id="submit-payment-btn"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>Submitting details...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Submit Details & Continue to WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

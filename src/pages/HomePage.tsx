import React, { useState } from 'react';
import {
  FileText,
  Globe,
  Download,
  ExternalLink,
  CreditCard,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { Item } from '../types.ts';
import { PaymentModal } from '../components/PaymentModal.tsx';
import { getApiBaseUrl } from '../lib/api.ts';

export const HomePage: React.FC = () => {
  const { user, items, isLoading, openAuthModal } = useAuth();

  const [selectedItemForPayment, setSelectedItemForPayment] = useState<Item | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'document' | 'website' | 'free' | 'unlocked'>('all');

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'document') return item.type === 'document';
    if (filterType === 'website') return item.type === 'website';
    if (filterType === 'free') return item.payment_type === 'free';
    if (filterType === 'unlocked') return item.isUnlocked;
    return true;
  });

  const handleItemAction = (item: Item & { isUnlocked?: boolean; userOrder?: any }) => {
    // Strict requirement: User must be logged in before purchasing or downloading anything
    if (!user) {
      openAuthModal(true);
      return;
    }

    const baseUrl = getApiBaseUrl();
    const downloadUrl = `${baseUrl}/api/download/${item.id}?userId=${user.id}`;

    if (item.payment_type === 'free' || item.isUnlocked) {
      if (item.type === 'document') {
        if (item.file_url && item.file_url.startsWith('data:')) {
          const a = document.createElement('a');
          a.href = item.file_url;
          a.download = item.file_name || `${item.title.replace(/\s+/g, '_')}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          window.location.href = downloadUrl;
        }
      } else if (item.website_url) {
        window.open(item.website_url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // Open payment modal
    setSelectedItemForPayment(item);
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header Banner */}
      <section className="border-b border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8 shadow-xs">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Instant Access & WhatsApp Verification</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
            Digital Documents & Premium Portals
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Browse verified architecture guides, toolkits, and curated web platforms. Easy payment via JazzCash, EasyPaisa, or Bank transfer with fast WhatsApp confirmation.
          </p>

          {!user && (
            <div className="pt-2">
              <button
                type="button"
                id="hero-quick-login-btn"
                onClick={() => openAuthModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <span>Login with Phone Number / Email to Purchase</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Controls: Search & Filter Chips */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              id="search-items-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title, keywords..."
              className="w-full bg-white border border-slate-300 focus:border-slate-800 focus:ring-1 focus:ring-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-xs transition-colors"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              type="button"
              id="filter-all-btn"
              onClick={() => setFilterType('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              type="button"
              id="filter-docs-btn"
              onClick={() => setFilterType('document')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                filterType === 'document'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Documents</span>
            </button>
            <button
              type="button"
              id="filter-websites-btn"
              onClick={() => setFilterType('website')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                filterType === 'website'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-purple-600" />
              <span>Websites</span>
            </button>
            <button
              type="button"
              id="filter-free-btn"
              onClick={() => setFilterType('free')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                filterType === 'free'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Free
            </button>
            {user && (
              <button
                type="button"
                id="filter-unlocked-btn"
                onClick={() => setFilterType('unlocked')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                  filterType === 'unlocked'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Unlocked</span>
              </button>
            )}
          </div>
        </div>

        {/* Items Listing */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-64 rounded-2xl bg-white border border-slate-200 shadow-xs animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <Filter className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">No items found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search keywords or switching categories.
            </p>
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => {
              const isFree = item.payment_type === 'free';
              const isUnlocked = item.isUnlocked;
              const isPending = item.userOrder?.status === 'pending';

              return (
                <div
                  key={item.id}
                  id={`item-card-${item.id}`}
                  className={`flex flex-col justify-between rounded-2xl bg-white border transition-all duration-200 overflow-hidden group shadow-xs hover:shadow-md ${
                    isUnlocked
                      ? 'border-emerald-300'
                      : isPending
                      ? 'border-amber-300'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Top / Header */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Type Icon & Badge */}
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            item.type === 'document'
                              ? 'bg-blue-50 text-blue-600 border border-blue-200'
                              : 'bg-purple-50 text-purple-600 border border-purple-200'
                          }`}
                        >
                          {item.type === 'document' ? (
                            <FileText className="w-5 h-5" />
                          ) : (
                            <Globe className="w-5 h-5" />
                          )}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {item.type}
                        </span>
                      </div>

                      {/* Status / Price Pill */}
                      <div>
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isFree ? 'Free' : 'Unlocked ✓'}</span>
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              isFree
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-900 border border-slate-200'
                            }`}
                          >
                            {isFree ? 'Free' : `Rs. ${item.price.toLocaleString()}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title and Description */}
                    <div>
                      <h2 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2">
                        {item.title}
                      </h2>
                      <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom / Action Footer */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                    {/* Condition 1: Free or Unlocked Item */}
                    {isUnlocked ? (
                      item.type === 'document' ? (
                        <button
                          type="button"
                          id={`download-btn-${item.id}`}
                          onClick={() => handleItemAction(item)}
                          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download Document</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          id={`go-website-btn-${item.id}`}
                          onClick={() => handleItemAction(item)}
                          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Go to Website</span>
                        </button>
                      )
                    ) : isPending ? (
                      /* Condition 2: Order submitted and pending admin verification */
                      <button
                        type="button"
                        id={`check-status-btn-${item.id}`}
                        onClick={() => handleItemAction(item)}
                        className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Clock className="w-4 h-4 text-amber-700" />
                        <span>Pending • Verify on WhatsApp</span>
                      </button>
                    ) : (
                      /* Condition 3: Not yet unlocked - Pay button */
                      <button
                        type="button"
                        id={`pay-btn-${item.id}`}
                        onClick={() => handleItemAction(item)}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Pay Rs. {item.price.toLocaleString()} to Unlock</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Payment Process Modal */}
      <PaymentModal
        item={selectedItemForPayment}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedItemForPayment(null);
        }}
        existingOrder={selectedItemForPayment?.userOrder}
      />
    </div>
  );
};

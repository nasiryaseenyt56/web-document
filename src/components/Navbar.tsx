import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FileText,
  ShoppingBag,
  ShieldCheck,
  LogOut,
  LogIn,
  KeyRound,
  Flame,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface NavbarProps {
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuthModal }) => {
  const { user, admin, logoutUser, logoutAdmin, userOrders, firebaseUser } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    logoutAdmin();
    await logoutUser();
  };

  const verifiedCount = userOrders.filter(o => o.status === 'verified').length;
  const pendingCount = userOrders.filter(o => o.status === 'pending').length;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 text-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <Link
            to="/"
            id="brand-logo-link"
            className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-slate-900 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm group-hover:bg-slate-800 transition-colors">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-slate-900 flex items-center gap-1.5">
                doc_web_store
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-1 border border-emerald-200">
                  <Flame className="w-3 h-3 text-emerald-600" />
                  Live Store
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal leading-none hidden sm:block">
                Documents & Web Portals
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/"
              id="nav-explore-link"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Marketplace
            </Link>

            {user && (
              <Link
                to="/orders"
                id="nav-orders-link"
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  location.pathname === '/orders'
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>My Purchases</span>
                {userOrders.length > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {verifiedCount > 0 ? verifiedCount : pendingCount}
                  </span>
                )}
              </Link>
            )}

            {/* Admin Badge/Link - Only displayed when admin is authenticated */}
            {admin && (
              <Link
                to="/admin"
                id="nav-admin-dashboard-link"
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-sm transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>Admin Portal</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </Link>
            )}

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            {/* User Session State */}
            {user ? (
              <div className="flex items-center gap-2">
                {firebaseUser?.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full border border-slate-200 object-cover shadow-sm"
                  />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                    admin ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {admin ? '👑' : user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-900 leading-tight flex items-center justify-end gap-1">
                    {admin && <span className="text-[10px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">Admin</span>}
                    {user.name}
                  </span>
                  <span className="text-[11px] text-slate-500 leading-tight">
                    {user.phone}
                  </span>
                </div>
                <button
                  type="button"
                  id="user-logout-btn"
                  onClick={handleLogout}
                  title="Log out"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="open-auth-modal-btn"
                  onClick={onOpenAuthModal}
                  className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

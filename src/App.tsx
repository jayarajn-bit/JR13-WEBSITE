import React, { useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Compass,
  CreditCard,
  LayoutDashboard,
  LogOut,
  RotateCcw,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SavingsProvider, useSavings } from './context/SavingsContext';
import { AuthPortal } from './components/AuthPortal';
import { DashboardView, type WorkspaceTab } from './components/DashboardView';
import { ChallengeSelectorView } from './components/ChallengeSelectorView';
import { CalendarStreakView } from './components/CalendarStreakView';
import { LedgerSettlementView } from './components/LedgerSettlementView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { AdminConsoleView } from './components/AdminConsoleView';
import { PaymentAccountsView } from './components/PaymentAccountsView';

function WorkspaceShell() {
  const {
    authMode,
    authReady,
    currentUid,
    currentUser,
    isAdmin,
    state,
    statusBanner,
    clearBanner,
    enterDemoSession,
    logout,
    resetDemoWorkspace,
  } = useSavings();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [showLanding, setShowLanding] = useState<boolean>(false);

  const unreadCount = useMemo(
    () =>
      state.notifications.filter((n) => n.userId === currentUid && !n.read).length,
    [state.notifications, currentUid]
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#060B16] text-slate-100 flex items-center justify-center p-6">
        <p className="text-sm text-slate-400">Initializing live JR13 SAVINGS workspace...</p>
      </div>
    );
  }

  if (showLanding || authMode === 'unauthenticated' || !currentUid) {
    return (
      <AuthPortal
        onNavigateWorkspace={() => {
          setShowLanding(false);
          setActiveTab('dashboard');
        }}
      />
    );
  }

  const navItems: { id: WorkspaceTab; label: string; icon: React.ReactNode; show?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'challenges', label: 'Challenges', icon: <Compass className="w-4 h-4" /> },
    { id: 'calendar', label: 'Calendar', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'ledger', label: 'Ledger', icon: <Wallet className="w-4 h-4" /> },
    { id: 'accounts', label: 'Payment Accounts', icon: <CreditCard className="w-4 h-4" /> },
    {
      id: 'notifications',
      label: unreadCount > 0 ? `Alerts (${unreadCount})` : 'Alerts',
      icon: <Bell className="w-4 h-4" />,
    },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    {
      id: 'admin',
      label: 'Admin',
      icon: <ShieldCheck className="w-4 h-4" />,
      show: isAdmin,
    },
  ];

  const visibleNav = navItems.filter((item) => item.show !== false);

  return (
    <div className="min-h-screen bg-[#060B16] text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#03060D] border-r border-slate-800/80 z-30">
        <div className="h-16 px-6 flex items-center border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => setShowLanding(true)}
            className="font-display text-lg font-bold tracking-tight text-[#E5C158] whitespace-nowrap"
          >
            JR13 SAVINGS
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {visibleNav.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#101B33] text-[#E5C158] border border-[#D4AF37]/30'
                    : 'text-slate-300 hover:bg-[#0B1324] hover:text-white border border-transparent'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80 space-y-3">
          {authMode === 'demo' && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-400">Demo Persona Switcher</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    enterDemoSession('saver');
                    setActiveTab('dashboard');
                  }}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border ${
                    !isAdmin
                      ? 'bg-[#D4AF37] text-[#060B16] border-[#D4AF37]'
                      : 'bg-[#0B1324] text-slate-300 border-slate-800'
                  }`}
                >
                  Saver
                </button>
                <button
                  type="button"
                  onClick={() => {
                    enterDemoSession('admin');
                    setActiveTab('admin');
                  }}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border ${
                    isAdmin
                      ? 'bg-[#D4AF37] text-[#060B16] border-[#D4AF37]'
                      : 'bg-[#0B1324] text-slate-300 border-slate-800'
                  }`}
                >
                  Admin
                </button>
              </div>
              <button
                type="button"
                onClick={resetDemoWorkspace}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B1324] border border-slate-800 text-[11px] text-slate-300 hover:border-slate-700 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Demo Data</span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-100 truncate">
                {currentUser?.displayName || 'Saver'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {authMode === 'firebase' ? 'Google OAuth' : 'Demo Mode'}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-2 rounded-lg bg-[#0B1324] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-20 lg:pb-8">
        {/* Top Bar (Compact 54px on mobile, 64px on desktop) */}
        <header className="sticky top-0 z-20 h-14 lg:h-16 bg-[#060B16]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setShowLanding(true)}
              className="lg:hidden font-display text-base font-bold text-[#E5C158] whitespace-nowrap shrink-0"
            >
              JR13 SAVINGS
            </button>
            <span className="hidden lg:inline text-xs text-slate-400 truncate">
              JR13 SAVINGS / {visibleNav.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {authMode === 'demo' && (
              <button
                type="button"
                onClick={() => {
                  if (isAdmin) {
                    enterDemoSession('saver');
                    setActiveTab('dashboard');
                  } else {
                    enterDemoSession('admin');
                    setActiveTab('admin');
                  }
                }}
                className="lg:hidden px-3 py-1.5 rounded-lg bg-[#0B1324] border border-slate-700 text-xs font-medium text-[#E5C158] whitespace-nowrap shrink-0"
              >
                {isAdmin ? 'Switch Saver' : 'Admin Demo'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowLanding(true)}
              className="px-3.5 py-2 rounded-lg bg-[#0B1324] border border-slate-700 text-xs font-medium text-slate-200 hover:border-[#D4AF37] whitespace-nowrap shrink-0"
            >
              {authMode === 'firebase' ? 'Account Portal' : 'Auth & Portal'}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {statusBanner && (
            <div
              role="status"
              className={`rounded-xl px-4 py-3 text-xs border flex items-center justify-between gap-4 ${
                statusBanner.type === 'error'
                  ? 'bg-red-950/50 border-red-500/40 text-red-200'
                  : 'bg-[#0B1324] border-[#D4AF37]/40 text-slate-200'
              }`}
            >
              <span>{statusBanner.text}</span>
              <button
                type="button"
                onClick={clearBanner}
                className="text-slate-400 hover:text-white font-medium whitespace-nowrap shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === 'challenges' && (
            <ChallengeSelectorView onEnrolled={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === 'calendar' && <CalendarStreakView onNavigate={setActiveTab} />}
          {activeTab === 'ledger' && <LedgerSettlementView onNavigate={setActiveTab} />}
          {activeTab === 'accounts' && <PaymentAccountsView />}
          {activeTab === 'notifications' && <NotificationsView />}
          {activeTab === 'profile' && <ProfileView onNavigate={setActiveTab} />}
          {activeTab === 'admin' && <AdminConsoleView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed Thumb Zone) */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-[#03060D]/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-5 items-center"
      >
        {[
          { id: 'dashboard' as WorkspaceTab, label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
          { id: 'challenges' as WorkspaceTab, label: 'Plans', icon: <Compass className="w-5 h-5" /> },
          { id: 'calendar' as WorkspaceTab, label: 'Streak', icon: <CalendarDays className="w-5 h-5" /> },
          { id: 'ledger' as WorkspaceTab, label: 'Ledger', icon: <Wallet className="w-5 h-5" /> },
          {
            id: (isAdmin ? 'admin' : 'profile') as WorkspaceTab,
            label: isAdmin ? 'Admin' : 'Profile',
            icon: isAdmin ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />,
          },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium transition-colors ${
                active ? 'text-[#E5C158]' : 'text-slate-400'
              }`}
            >
              {tab.icon}
              <span className="mt-1">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SavingsProvider>
        <WorkspaceShell />
      </SavingsProvider>
    </ErrorBoundary>
  );
}

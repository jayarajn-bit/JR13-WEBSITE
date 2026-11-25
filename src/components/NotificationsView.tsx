import React, { useMemo } from 'react';
import { Bell, Check } from 'lucide-react';
import { useSavings } from '../context/SavingsContext';

export function NotificationsView() {
  const { currentUid, state, markNotificationRead } = useSavings();

  const notifications = useMemo(
    () =>
      state.notifications
        .filter((n) => n.userId === currentUid)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.notifications, currentUid]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-400">
          Alerts & Milestones · {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 mt-0.5">
          Notifications
        </h1>
      </div>

      <div className="bg-[#0B1324] border border-slate-800 rounded-2xl divide-y divide-slate-800/80">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No notifications recorded yet. Deposit reminders, streak milestones, and settlement
            updates appear here.
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                notif.read ? 'opacity-75' : 'bg-[#101B33]/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#060B16] border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4 text-[#E5C158]" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">
                    {notif.category} · <span className="font-mono">{notif.createdAt.slice(0, 16).replace('T', ' ')}</span> ·{' '}
                    {notif.read ? 'Read' : 'Unread'}
                  </p>
                  <h2 className="text-sm font-semibold text-slate-100">{notif.title}</h2>
                  <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                </div>
              </div>

              {!notif.read && (
                <button
                  type="button"
                  onClick={() => markNotificationRead(notif.id)}
                  className="px-3.5 py-2 rounded-xl bg-[#060B16] border border-slate-700 text-xs font-medium text-[#E5C158] hover:border-[#D4AF37] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[40px]"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark Read</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

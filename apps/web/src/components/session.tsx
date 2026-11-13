'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, API_BASE, type User } from '../lib/api';

export type IncomingNotification = {
  conversationId: string;
  text?: string;
  createdAt?: string;
};

type Session = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  latestNotification: IncomingNotification | null;
  clearNotification: () => void;
};

const Context = createContext<Session>({
  user: null,
  loading: true,
  refresh: async () => {},
  unreadCount: 0,
  setUnreadCount: () => {},
  latestNotification: null,
  clearNotification: () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotification, setLatestNotification] = useState<IncomingNotification | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await api<{ unreadCount: number }>('/conversations/unread-count');
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Ignored if unauthorized or networking fails
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ user: User }>('/auth/me');
      setUser(result.user);
      if (result.user?.verificationStatus === 'verified' && result.user?.status === 'active') {
        void refreshUnread();
      }
    } catch {
      setUser(null);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [refreshUnread]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Real-time socket connection for unread messages and notifications
  useEffect(() => {
    if (!API_BASE || !user?.id || user.verificationStatus !== 'verified' || user.status !== 'active') {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(API_BASE, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      void refreshUnread();
    });

    socket.on('notification:message', (payload: { conversationId: string; message?: { text?: string; createdAt?: string } }) => {
      setUnreadCount(prev => prev + 1);
      setLatestNotification({
        conversationId: payload.conversationId,
        text: payload.message?.text || 'New message received',
        createdAt: payload.message?.createdAt || new Date().toISOString(),
      });
    });

    socket.on('notification:read', () => {
      void refreshUnread();
    });

    // Periodic backup poll every 30s
    const timer = setInterval(() => {
      void refreshUnread();
    }, 30000);

    return () => {
      clearInterval(timer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, user?.verificationStatus, user?.status, refreshUnread]);

  const clearNotification = useCallback(() => {
    setLatestNotification(null);
  }, []);

  return (
    <Context.Provider
      value={{
        user,
        loading,
        refresh,
        unreadCount,
        setUnreadCount,
        latestNotification,
        clearNotification,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export const useSession = () => useContext(Context);

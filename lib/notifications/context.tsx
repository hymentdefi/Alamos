import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

/**
 * Estado mínimo de notificaciones nuevas. La idea: el icono de la
 * campanita en el home muestra un dot rojo cuando hasUnread === true.
 * Cuando el usuario abre /(app)/activity (la pantalla de actividad y
 * notificaciones), llamamos markAllRead() y el dot desaparece.
 *
 * Mock: arranca en true (tenemos notifs no leídas en el seed). En
 * producción esto vendría de la API o de un push topic suscrito.
 */
interface NotificationsContextValue {
  hasUnread: boolean;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  hasUnread: true,
  markAllRead: () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [hasUnread, setHasUnread] = useState(true);
  const markAllRead = useCallback(() => setHasUnread(false), []);
  return (
    <NotificationsContext.Provider value={{ hasUnread, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);

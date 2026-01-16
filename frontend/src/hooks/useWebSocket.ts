import { useEffect, useState, useRef, useCallback } from 'react';
import { MatchUpdate } from '../types';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: MatchUpdate) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
}

export const useWebSocket = ({
  url,
  onMessage,
  onError,
  reconnectInterval = 5000,
}: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<MatchUpdate | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('WebSocket connecté');
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: MatchUpdate = JSON.parse(event.data);
          setLastUpdate(data);
          onMessage?.(data);
        } catch (error) {
          console.error('Erreur parsing message WebSocket:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Erreur WebSocket:', error);
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('WebSocket déconnecté');
        setIsConnected(false);

        // Tentative de reconnexion
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Tentative de reconnexion...');
          connect();
        }, reconnectInterval);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Erreur création WebSocket:', error);
      reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
    }
  }, [url, onMessage, onError, reconnectInterval]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    isConnected,
    lastUpdate,
    sendMessage,
  };
};

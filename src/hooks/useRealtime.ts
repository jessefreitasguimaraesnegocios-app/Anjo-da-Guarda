import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase';
import { Device } from '@/hooks/useDevices';
import { Recording } from '@/hooks/useRecordings';

export interface RealtimeUpdate {
  type: 'device_status' | 'recording_start' | 'recording_stop' | 'panic_alert';
  deviceId: string;
  data: any;
  timestamp: string;
}

export const useRealtime = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [updates, setUpdates] = useState<RealtimeUpdate[]>([]);

  useEffect(() => {
    // Subscribe to device status changes
    const deviceChannel = supabase
      .channel('device-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
        },
        (payload) => {
          const update: RealtimeUpdate = {
            type: 'device_status',
            deviceId: payload.new.id,
            data: payload.new,
            timestamp: new Date().toISOString(),
          };
          setUpdates(prev => [update, ...prev.slice(0, 9)]); // Keep last 10 updates
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Subscribe to recording changes
    const recordingChannel = supabase
      .channel('recordings')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recordings',
        },
        (payload) => {
          const update: RealtimeUpdate = {
            type: 'recording_start',
            deviceId: payload.new.device_id,
            data: payload.new,
            timestamp: new Date().toISOString(),
          };
          setUpdates(prev => [update, ...prev.slice(0, 9)]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recordings',
        },
        (payload) => {
          if (payload.new.type === 'panic') {
            const update: RealtimeUpdate = {
              type: 'panic_alert',
              deviceId: payload.new.device_id,
              data: payload.new,
              timestamp: new Date().toISOString(),
            };
            setUpdates(prev => [update, ...prev.slice(0, 9)]);
          }
        }
      )
      .subscribe();

    return () => {
      deviceChannel.unsubscribe();
      recordingChannel.unsubscribe();
    };
  }, []);

  const sendDeviceCommand = async (deviceId: string, command: string, data?: any) => {
    try {
      // Em produção, isso seria enviado via WebSocket ou push notification
      const update: RealtimeUpdate = {
        type: 'device_status',
        deviceId,
        data: { command, ...data },
        timestamp: new Date().toISOString(),
      };
      setUpdates(prev => [update, ...prev.slice(0, 9)]);
      
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  };

  const simulatePanicAlert = async (deviceId: string) => {
    const update: RealtimeUpdate = {
      type: 'panic_alert',
      deviceId,
      data: { 
        message: 'Alerta de pânico ativado!',
        location: 'São Paulo, SP',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
    };
    setUpdates(prev => [update, ...prev.slice(0, 9)]);
  };

  return {
    isConnected,
    updates,
    sendDeviceCommand,
    simulatePanicAlert,
  };
};

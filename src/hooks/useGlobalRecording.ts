import { useState, useRef, useCallback, useEffect } from 'react';

interface GlobalRecordingState {
  videoRecorder: MediaRecorder | null;
  audioRecorder: MediaRecorder | null;
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  locationWatchId: number | null;
  isRecording: boolean;
  recordingType: 'video' | 'audio' | 'location' | 'panic' | null;
  isPanicActive: boolean;
  activeFeatures: {
    camera: boolean;
    audio: boolean;
    location: boolean;
  };
  recordingTimeLimit: number;
  recordingTimeout: NodeJS.Timeout | null;
  isPersistent: boolean;
}

// Estado global persistente
let globalRecordingState: GlobalRecordingState = {
  videoRecorder: null,
  audioRecorder: null,
  videoStream: null,
  audioStream: null,
  locationWatchId: null,
  isRecording: false,
  recordingType: null,
  isPanicActive: false,
  activeFeatures: {
    camera: false,
    audio: false,
    location: false,
  },
  recordingTimeLimit: 1,
  recordingTimeout: null,
  isPersistent: false,
};

// Listeners para mudanças de estado
const stateListeners = new Set<(state: GlobalRecordingState) => void>();

export const useGlobalRecording = () => {
  const [state, setState] = useState<GlobalRecordingState>(globalRecordingState);

  // Registrar listener
  useEffect(() => {
    const listener = (newState: GlobalRecordingState) => {
      setState(newState);
    };
    
    stateListeners.add(listener);
    
    return () => {
      stateListeners.delete(listener);
    };
  }, []);

  // Função para atualizar estado global
  const updateGlobalState = useCallback((updates: Partial<GlobalRecordingState>) => {
    globalRecordingState = { ...globalRecordingState, ...updates };
    
    // Notificar todos os listeners
    stateListeners.forEach(listener => {
      listener(globalRecordingState);
    });
  }, []);

  // Função para obter estado atual
  const getCurrentState = useCallback(() => {
    return globalRecordingState;
  }, []);

  // Função para iniciar gravação persistente
  const startPersistentRecording = useCallback(async (type: 'panic' | 'video' | 'audio' | 'location', timeLimit: number) => {
    try {
      // Parar qualquer gravação anterior
      if (globalRecordingState.isRecording) {
        await stopAllRecordings();
      }

      // Configurar estado persistente
      updateGlobalState({
        isRecording: true,
        recordingType: type,
        recordingTimeLimit: timeLimit,
        isPersistent: true,
        isPanicActive: type === 'panic',
        activeFeatures: type === 'panic' 
          ? { camera: true, audio: true, location: true }
          : { 
              camera: type === 'video', 
              audio: type === 'audio', 
              location: type === 'location' 
            }
      });

      // Iniciar gravação baseada no tipo
      if (type === 'panic') {
        await startVideoWithAudioRecording();
        await startLocationTracking();
      } else if (type === 'video') {
        await startVideoOnlyRecording();
      } else if (type === 'audio') {
        await startAudioRecording();
      } else if (type === 'location') {
        await startLocationTracking();
      }

      // Configurar timer automático
      const timeout = setTimeout(() => {
        stopPersistentRecording();
      }, timeLimit * 60 * 1000);

      updateGlobalState({
        recordingTimeout: timeout
      });

      return true;
    } catch (error) {
      console.error('Erro ao iniciar gravação persistente:', error);
      updateGlobalState({
        isRecording: false,
        isPersistent: false,
        isPanicActive: false,
        activeFeatures: { camera: false, audio: false, location: false }
      });
      return false;
    }
  }, [updateGlobalState]);

  // Função para parar gravação persistente
  const stopPersistentRecording = useCallback(async () => {
    await stopAllRecordings();
    
    if (globalRecordingState.recordingTimeout) {
      clearTimeout(globalRecordingState.recordingTimeout);
    }

    updateGlobalState({
      isRecording: false,
      isPersistent: false,
      isPanicActive: false,
      activeFeatures: { camera: false, audio: false, location: false },
      recordingTimeout: null,
      recordingType: null
    });
  }, [updateGlobalState]);

  // Função para parar todas as gravações
  const stopAllRecordings = useCallback(async () => {
    // Parar video recorder
    if (globalRecordingState.videoRecorder && globalRecordingState.videoRecorder.state === 'recording') {
      globalRecordingState.videoRecorder.stop();
    }

    // Parar audio recorder
    if (globalRecordingState.audioRecorder && globalRecordingState.audioRecorder.state === 'recording') {
      globalRecordingState.audioRecorder.stop();
    }

    // Parar streams
    if (globalRecordingState.videoStream) {
      globalRecordingState.videoStream.getTracks().forEach(track => track.stop());
    }
    if (globalRecordingState.audioStream) {
      globalRecordingState.audioStream.getTracks().forEach(track => track.stop());
    }

    // Parar localização
    if (globalRecordingState.locationWatchId) {
      navigator.geolocation.clearWatch(globalRecordingState.locationWatchId);
    }

    updateGlobalState({
      videoRecorder: null,
      audioRecorder: null,
      videoStream: null,
      audioStream: null,
      locationWatchId: null
    });
  }, [updateGlobalState]);

  // Funções específicas de gravação
  const startVideoWithAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Garantir tipo MIME correto para vídeo
        const blob = new Blob(chunks, { type: 'video/webm' });
        console.log('🎥 Blob de vídeo criado:', blob.size, 'bytes', 'Tipo:', blob.type);
        
        // Salvar gravação no banco de dados com o blob
        if ((window as any).createRecordingMutation) {
          (window as any).createRecordingMutation.mutate({
            type: globalRecordingState.recordingType || 'video',
            device_id: (window as any).currentDeviceId || 'default',
            duration: globalRecordingState.recordingTimeLimit * 60,
            size: blob.size, // Tamanho em bytes
            blob: blob, // Passar o blob para upload
          });
        }

        // Parar stream
        stream.getTracks().forEach(track => track.stop());
        
        if ((window as any).showNotification) {
          (window as any).showNotification('success', `Gravação finalizada! Arquivo: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        }
      };

      recorder.start(1000); // Gravar em chunks de 1 segundo

      updateGlobalState({
        videoRecorder: recorder,
        videoStream: stream
      });

      return true;
    } catch (error) {
      console.error('Erro ao iniciar gravação de vídeo com áudio:', error);
      return false;
    }
  }, [updateGlobalState]);

  const startVideoOnlyRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 }
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Garantir tipo MIME correto
        const blob = new Blob(chunks, { type: 'video/webm' });
        console.log('🎥 Blob de vídeo criado:', blob.size, 'bytes', 'Tipo:', blob.type);
        
        // Salvar gravação no banco de dados com o blob
        if ((window as any).createRecordingMutation) {
          (window as any).createRecordingMutation.mutate({
            type: globalRecordingState.recordingType || 'video',
            device_id: (window as any).currentDeviceId || 'default',
            duration: globalRecordingState.recordingTimeLimit * 60,
            size: blob.size, // Tamanho em bytes
            blob: blob, // Passar o blob para upload
          });
        }

        // Parar stream
        stream.getTracks().forEach(track => track.stop());
        
        if ((window as any).showNotification) {
          (window as any).showNotification('success', `Gravação de vídeo finalizada! Arquivo: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        }
      };

      recorder.start(1000);

      updateGlobalState({
        videoRecorder: recorder,
        videoStream: stream
      });

      return true;
    } catch (error) {
      console.error('Erro ao iniciar gravação de vídeo:', error);
      return false;
    }
  }, [updateGlobalState]);

  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Garantir tipo MIME correto
        const blob = new Blob(chunks, { type: 'audio/webm' });
        console.log('🎵 Blob de áudio criado:', blob.size, 'bytes', 'Tipo:', blob.type);
        
        // Salvar gravação no banco de dados com o blob
        if ((window as any).createRecordingMutation) {
          (window as any).createRecordingMutation.mutate({
            type: globalRecordingState.recordingType || 'audio',
            device_id: (window as any).currentDeviceId || 'default',
            duration: globalRecordingState.recordingTimeLimit * 60,
            size: blob.size, // Tamanho em bytes
            blob: blob, // Passar o blob para upload
          });
        }

        // Parar stream
        stream.getTracks().forEach(track => track.stop());
        
        if ((window as any).showNotification) {
          (window as any).showNotification('success', `Gravação de áudio finalizada! Arquivo: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        }
      };

      recorder.start(1000);

      updateGlobalState({
        audioRecorder: recorder,
        audioStream: stream
      });

      return true;
    } catch (error) {
      console.error('Erro ao iniciar gravação de áudio:', error);
      return false;
    }
  }, [updateGlobalState]);

  const startLocationTracking = useCallback(async () => {
    try {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Salvar dados de localização periodicamente
          if ((window as any).createRecordingMutation) {
            (window as any).createRecordingMutation.mutate({
              type: 'location',
              device_id: (window as any).currentDeviceId || 'default',
              duration: globalRecordingState.recordingTimeLimit * 60,
              size: 0.001, // KB para localização
              location_data: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
              }
            });
          }
        },
        (error) => {
          console.error('Erro de geolocalização:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );

      updateGlobalState({
        locationWatchId: watchId
      });

      return true;
    } catch (error) {
      console.error('Erro ao iniciar rastreamento de localização:', error);
      return false;
    }
  }, [updateGlobalState]);

  return {
    state,
    updateGlobalState,
    getCurrentState,
    startPersistentRecording,
    stopPersistentRecording,
    stopAllRecordings
  };
};

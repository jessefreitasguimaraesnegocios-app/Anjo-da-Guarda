import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertCircle, Camera, Mic, MapPin, Activity, Square, Play } from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';
import { useRecordings } from '@/hooks/useRecordings';
import { ConnectionMonitor } from '@/components/ConnectionMonitor';
// import { useGlobalRecording } from '@/hooks/useGlobalRecording';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface RecordingState {
  videoRecorder: MediaRecorder | null;
  audioRecorder: MediaRecorder | null;
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  locationWatchId: number | null;
  isRecording: boolean;
  recordingType: 'video' | 'audio' | 'location' | 'panic' | null;
}

export default function Home() {
  const [isPanicActive, setIsPanicActive] = useState(false);
  const [activeFeatures, setActiveFeatures] = useState({
    camera: false,
    audio: false,
    location: false,
  });
  const [recordingState, setRecordingState] = useState<RecordingState>({
    videoRecorder: null,
    audioRecorder: null,
    videoStream: null,
    audioStream: null,
    locationWatchId: null,
    isRecording: false,
    recordingType: null,
  });
  const [locationData, setLocationData] = useState<GeolocationPosition | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingTimeLimit, setRecordingTimeLimit] = useState(1); // Tempo limite em minutos
  const [locationHistory, setLocationHistory] = useState<Array<{
    position: GeolocationPosition;
    address: string;
    timestamp: string;
  }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // const isRecordingPersistentRef = useRef(false);
  
  // const { state: globalState, startPersistentRecording } = useGlobalRecording();

  const { getDevices } = useDevices();
  const { createRecording, updateRecording } = useRecordings();
  const queryClient = useQueryClient();

  // Fetch devices with error handling
  const { data: devices = [], isLoading: devicesLoading, error: devicesError } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    retry: false,
    onError: (error) => {
      console.error('Erro ao carregar dispositivos:', error);
    }
  });

  // Configurar persistência de gravações
  // useEffect(() => {
  //   const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  //     if (isRecordingPersistentRef.current) {
  //       event.preventDefault();
  //       event.returnValue = 'Uma gravação está em andamento. Tem certeza que deseja sair?';
  //       return 'Uma gravação está em andamento. Tem certeza que deseja sair?';
  //     }
  //   };

  //   const handleVisibilityChange = () => {
  //     if (document.hidden && isRecordingPersistentRef.current) {
  //       // App foi minimizado, mas gravação continua
  //       console.log('App minimizado, gravação continua em background');
  //     }
  //   };

  //   const handlePageHide = () => {
  //     if (isRecordingPersistentRef.current) {
  //       // Tentar manter gravação ativa
  //       console.log('Página sendo fechada, tentando manter gravação');
  //     }
  //   };

  //   // Adicionar listeners
  //   window.addEventListener('beforeunload', handleBeforeUnload);
  //   document.addEventListener('visibilitychange', handleVisibilityChange);
  //   window.addEventListener('pagehide', handlePageHide);

  //   // Cleanup
  //   return () => {
  //     window.removeEventListener('beforeunload', handleBeforeUnload);
  //     document.removeEventListener('visibilitychange', handleVisibilityChange);
  //     window.removeEventListener('pagehide', handlePageHide);
  //   };
  // }, []);

  // Create recording mutation
  const createRecordingMutation = useMutation({
    mutationFn: createRecording,
    onSuccess: (recording) => {
      console.log('✅ Gravação criada com sucesso:', recording);
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      if ((window as any).showNotification) {
        (window as any).showNotification('success', 'Gravação iniciada com sucesso!');
      }
    },
    onError: (error: any) => {
      console.error('❌ Erro ao criar gravação:', error);
      if ((window as any).showNotification) {
        (window as any).showNotification('error', error.message || 'Erro ao iniciar gravação');
      }
    },
  });

  // Expor mutation globalmente para o hook de gravação
  // useEffect(() => {
  //   (window as any).createRecordingMutation = createRecordingMutation;
  //   (window as any).currentDeviceId = devices.length > 0 ? devices[0].id : 'default-device';
    
  //   return () => {
  //     delete (window as any).createRecordingMutation;
  //     delete (window as any).currentDeviceId;
  //   };
  // }, [createRecordingMutation, devices]);

  const handlePanicButton = async () => {
    if (isPanicActive) {
      // Não permitir cancelar - gravação deve completar o tempo definido
      if ((window as any).showNotification) {
        (window as any).showNotification('warning', `Gravação em andamento! Aguarde ${recordingTimeLimit} minutos para completar.`);
      }
      return;
    }

    try {
      // Ativar modo pânico
      setIsPanicActive(true);
      setActiveFeatures({ camera: true, audio: true, location: true });
      
      // Marcar gravação como persistente
      // isRecordingPersistentRef.current = true;
      
      // Iniciar vídeo COM áudio + localização
      await Promise.all([
        startVideoWithAudioRecording(),
        startLocationTracking()
      ]);

      // Criar registro no banco será feito quando o vídeo for finalizado
      // O arquivo será salvo automaticamente pela função startVideoWithAudioRecording
      console.log('🚨 Modo pânico ativado - gravação de vídeo com áudio iniciada');
      
      if ((window as any).showNotification) {
        (window as any).showNotification('success', `Modo pânico ativado! Gravação por ${recordingTimeLimit} minutos iniciada.`);
      }
      
      // Parar automaticamente após o tempo definido
      recordingTimeoutRef.current = setTimeout(() => {
        stopPanicRecording();
      }, recordingTimeLimit * 60 * 1000); // Converter minutos para milissegundos
      
    } catch (error) {
      if ((window as any).showNotification) {
        (window as any).showNotification('error', 'Erro ao ativar modo pânico');
      }
      setIsPanicActive(false);
      setActiveFeatures({ camera: false, audio: false, location: false });
      // isRecordingPersistentRef.current = false;
    }
  };

  const handleFeatureToggle = async (feature: 'camera' | 'audio' | 'location') => {
    const newState = !activeFeatures[feature];
    
    if (activeFeatures[feature]) {
      // Não permitir cancelar - gravação deve completar o tempo definido
      if ((window as any).showNotification) {
        (window as any).showNotification('warning', `Gravação de ${feature} em andamento! Aguarde ${recordingTimeLimit} minutos para completar.`);
      }
      return;
    }

    setActiveFeatures(prev => ({ ...prev, [feature]: newState }));

    if (newState) {
      try {
        // Marcar gravação como persistente
        // isRecordingPersistentRef.current = true;
        
        if (feature === 'camera') {
          await startVideoOnlyRecording();
        } else if (feature === 'audio') {
          await startAudioRecording();
        } else if (feature === 'location') {
          await startLocationTracking();
        }

        // Criar registro no banco
        const recordingType = feature === 'camera' ? 'video' : 
                            feature === 'audio' ? 'audio' : 'location';
        const deviceId = devices.length > 0 ? devices[0].id : 'default-device';
        
        createRecordingMutation.mutate({
          device_id: deviceId,
          type: recordingType,
          duration: recordingTimeLimit * 60, // Duração em segundos
          size: 0, // Será calculado quando o arquivo for criado
        });
        
        if ((window as any).showNotification) {
          (window as any).showNotification('success', `Gravação de ${feature} iniciada por ${recordingTimeLimit} minutos!`);
        }
        
        // Parar automaticamente após o tempo definido
        recordingTimeoutRef.current = setTimeout(() => {
          stopFeatureRecording(feature);
        }, recordingTimeLimit * 60 * 1000);
        
      } catch (error) {
        if ((window as any).showNotification) {
          (window as any).showNotification('error', `Erro ao ativar ${feature}`);
        }
        setActiveFeatures(prev => ({ ...prev, [feature]: false }));
        // isRecordingPersistentRef.current = false;
      }
    }
  };

  // Update recording mutation
  const updateRecordingMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      updateRecording(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      if ((window as any).showNotification) {
        (window as any).showNotification('success', 'Gravação atualizada com sucesso!');
      }
    },
    onError: (error: any) => {
      if ((window as any).showNotification) {
        (window as any).showNotification('error', error.message || 'Erro ao atualizar gravação');
      }
    },
  });

  // Contador de duração da gravação
  useEffect(() => {
    if (recordingState.isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingDuration(0);
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, [recordingState.isRecording]);

  // Atualizar vídeo quando o stream mudar
  useEffect(() => {
    if (videoRef.current && recordingState.videoStream) {
      videoRef.current.srcObject = recordingState.videoStream;
      console.log('Vídeo atualizado via useEffect:', recordingState.videoStream);
    }
  }, [recordingState.videoStream]);

  // Função para obter endereço a partir das coordenadas
  const getAddressFromCoordinates = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`
      );
      const data = await response.json();
      
      if (data.localityInfo && data.localityInfo.administrative) {
        const admin = data.localityInfo.administrative;
        const address = `${admin[0]?.name || ''} ${admin[1]?.name || ''} ${admin[2]?.name || ''}`.trim();
        return address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
      
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.error('Erro ao obter endereço:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  // Iniciar gravação de vídeo COM áudio (para modo pânico)
  const startVideoWithAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: { 
          echoCancellation: true,
          noiseSuppression: true 
        }
      });

      // Verificar se MediaRecorder é suportado
      if (!MediaRecorder.isTypeSupported('video/webm')) {
        throw new Error('Gravação de vídeo não suportada neste navegador');
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });

      videoChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Aguardar um pouco para garantir que todos os chunks foram processados
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        
        // Verificar se o blob tem conteúdo válido
        if (blob.size === 0) {
          if ((window as any).showNotification) {
            (window as any).showNotification('error', 'Erro: Arquivo de vídeo vazio');
          }
          return;
        }
        
        // Salvar gravação no banco de dados
        // Se estiver em modo pânico, salvar como tipo 'panic'
        const recordingType = isPanicActive ? 'panic' : 'video';
        
        console.log('📤 Salvando gravação de vídeo:', {
          type: recordingType,
          device_id: devices[0]?.id || 'default',
          duration: recordingDuration,
          size: Math.round(blob.size / 1024 / 1024),
          blobSize: blob.size,
          isPanicActive
        });
        
        createRecordingMutation.mutate({
          type: recordingType,
          device_id: devices[0]?.id || 'default',
          duration: recordingDuration,
          size: Math.round(blob.size / 1024 / 1024), // MB
          blob: blob, // Passar o blob real
        });
        
        // Parar stream
        stream.getTracks().forEach(track => track.stop());
        
        if ((window as any).showNotification) {
          const message = isPanicActive 
            ? `Modo pânico gravado! Arquivo criado: ${(blob.size / 1024 / 1024).toFixed(2)} MB`
            : `Vídeo com áudio gravado! Arquivo criado: ${(blob.size / 1024 / 1024).toFixed(2)} MB`;
          (window as any).showNotification('success', message);
        }
      };

      recorder.start();
      
      setRecordingState(prev => ({
        ...prev,
        videoRecorder: recorder,
        videoStream: stream,
        isRecording: true,
        recordingType: 'panic'
      }));

      // Mostrar vídeo na tela
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      return recorder;
    } catch (error) {
      if ((window as any).showNotification) {
        (window as any).showNotification('error', 'Erro ao iniciar gravação de vídeo com áudio');
      }
      throw error;
    }
  };

  // Iniciar gravação de vídeo SEM áudio (botão câmera individual)
  const startVideoOnlyRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false 
      });

      // Verificar se MediaRecorder é suportado
      if (!MediaRecorder.isTypeSupported('video/webm')) {
        throw new Error('Gravação de vídeo não suportada neste navegador');
      }

      // Usar configuração mais simples e compatível
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });

      videoChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Aguardar um pouco para garantir que todos os chunks foram processados
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        
        // Verificar se o blob tem conteúdo válido
        if (blob.size === 0) {
          if ((window as any).showNotification) {
            (window as any).showNotification('error', 'Erro: Arquivo de vídeo vazio');
          }
          return;
        }
        
        // Salvar gravação no banco de dados
        console.log('📤 Salvando gravação de vídeo:', {
          type: 'video',
          device_id: devices[0]?.id || 'default',
          duration: recordingDuration,
          size: Math.round(blob.size / 1024 / 1024),
          blobSize: blob.size,
        });
        
        createRecordingMutation.mutate({
          type: 'video',
          device_id: devices[0]?.id || 'default',
          duration: recordingDuration,
          size: Math.round(blob.size / 1024 / 1024), // MB
          blob: blob, // Passar o blob real
        });
        
        // Parar stream
        stream.getTracks().forEach(track => track.stop());
        
        if ((window as any).showNotification) {
          (window as any).showNotification('success', `Vídeo gravado! Arquivo criado: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        }
      };

      recorder.start();
      
      setRecordingState(prev => ({
        ...prev,
        videoRecorder: recorder,
        videoStream: stream,
        isRecording: true,
        recordingType: 'video'
      }));

      // Mostrar vídeo na tela IMEDIATAMENTE
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('Vídeo definido para preview:', stream);
      }

      return recorder;
    } catch (error) {
      if ((window as any).showNotification) {
        (window as any).showNotification('error', 'Erro ao iniciar gravação de vídeo');
      }
      throw error;
    }
  };

  // Iniciar gravação de áudio
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true 
        } 
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Salvar gravação no banco de dados
        createRecordingMutation.mutate({
          type: 'audio',
          device_id: devices[0]?.id || 'default',
          duration: recordingDuration,
          size: Math.round(blob.size / 1024 / 1024), // MB
          blob: blob, // Passar o blob real
        });
        
        // Parar stream
        stream.getTracks().forEach(track => track.stop());
        
        if ((window as any).showNotification) {
          (window as any).showNotification('success', `Áudio gravado! Arquivo criado: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        }
      };

      recorder.start();
      
      setRecordingState(prev => ({
        ...prev,
        audioRecorder: recorder,
        audioStream: stream,
        isRecording: true,
        recordingType: 'audio'
      }));

      return recorder;
    } catch (error) {
      if ((window as any).showNotification) {
        (window as any).showNotification('error', 'Erro ao iniciar gravação de áudio');
      }
      throw error;
    }
  };

  // Iniciar monitoramento de localização
  const startLocationTracking = async () => {
    try {
      // Limpar histórico anterior
      setLocationHistory([]);
      
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          setLocationData(position);
          console.log('Localização atualizada:', position);
          
          // Obter endereço das coordenadas
          const address = await getAddressFromCoordinates(
            position.coords.latitude, 
            position.coords.longitude
          );
          setLocationAddress(address);
          
          // Adicionar ao histórico de localização
          setLocationHistory(prev => [...prev, {
            position,
            address,
            timestamp: new Date().toISOString()
          }]);
        },
        (error) => {
          console.error('Erro na localização:', error);
          if ((window as any).showNotification) {
            (window as any).showNotification('error', 'Erro ao obter localização');
          }
        },
        { 
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 1000
        }
      );

      setRecordingState(prev => ({
        ...prev,
        locationWatchId: watchId,
        isRecording: true,
        recordingType: 'location'
      }));

      return watchId;
    } catch (error) {
      if ((window as any).showNotification) {
        (window as any).showNotification('error', 'Erro ao iniciar monitoramento de localização');
      }
      throw error;
    }
  };

  // Parar todas as gravações
  const stopAllRecordings = () => {
    if (recordingState.videoRecorder && recordingState.videoRecorder.state === 'recording') {
      recordingState.videoRecorder.stop();
    }
    if (recordingState.audioRecorder && recordingState.audioRecorder.state === 'recording') {
      recordingState.audioRecorder.stop();
    }
    if (recordingState.locationWatchId) {
      navigator.geolocation.clearWatch(recordingState.locationWatchId);
    }

    // Parar streams
    if (recordingState.videoStream) {
      recordingState.videoStream.getTracks().forEach(track => track.stop());
    }
    if (recordingState.audioStream) {
      recordingState.audioStream.getTracks().forEach(track => track.stop());
    }

    // Limpar vídeo
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setRecordingState({
      videoRecorder: null,
      audioRecorder: null,
      videoStream: null,
      audioStream: null,
      locationWatchId: null,
      isRecording: false,
      recordingType: null,
    });
    setLocationData(null);
    setLocationAddress('');
    setLocationHistory([]);
  };

  // Parar gravação específica
  const stopSpecificRecording = (type: 'video' | 'audio' | 'location') => {
    if (type === 'video' && recordingState.videoRecorder) {
      recordingState.videoRecorder.stop();
    }
    if (type === 'audio' && recordingState.audioRecorder) {
      recordingState.audioRecorder.stop();
    }
    if (type === 'location' && recordingState.locationWatchId) {
      navigator.geolocation.clearWatch(recordingState.locationWatchId);
    }

    // Parar streams específicos
    if (type === 'video' && recordingState.videoStream) {
      recordingState.videoStream.getTracks().forEach(track => track.stop());
      // Limpar vídeo imediatamente
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    if (type === 'audio' && recordingState.audioStream) {
      recordingState.audioStream.getTracks().forEach(track => track.stop());
    }

    // Atualizar estado
    setRecordingState(prev => ({
      ...prev,
      videoRecorder: type === 'video' ? null : prev.videoRecorder,
      audioRecorder: type === 'audio' ? null : prev.audioRecorder,
      videoStream: type === 'video' ? null : prev.videoStream,
      audioStream: type === 'audio' ? null : prev.audioStream,
      locationWatchId: type === 'location' ? null : prev.locationWatchId,
      isRecording: false,
      recordingType: null,
    }));

    if (type === 'location') {
      setLocationData(null);
      setLocationAddress('');
      setLocationHistory([]);
    }
  };

  const stopPanicRecording = async () => {
    setIsPanicActive(false);
    setActiveFeatures({ camera: false, audio: false, location: false });
    
    // Se há dados de localização coletados, salvar como arquivo JSON
    if (locationHistory.length > 0) {
      try {
        // Criar dados estruturados para o arquivo JSON
        const locationData = {
          type: 'panic_location_recording',
          device_id: devices.length > 0 ? devices[0].id : 'default-device',
          duration: recordingTimeLimit * 60,
          start_time: locationHistory[0]?.timestamp,
          end_time: new Date().toISOString(),
          total_points: locationHistory.length,
          locations: locationHistory.map(item => ({
            timestamp: item.timestamp,
            latitude: item.position.coords.latitude,
            longitude: item.position.coords.longitude,
            accuracy: item.position.coords.accuracy,
            altitude: item.position.coords.altitude,
            heading: item.position.coords.heading,
            speed: item.position.coords.speed,
            address: item.address
          }))
        };
        
        // Criar blob JSON
        const jsonBlob = new Blob([JSON.stringify(locationData, null, 2)], { 
          type: 'application/json' 
        });
        
        console.log('📤 Salvando dados de localização do pânico:', locationData);
        
        // Salvar gravação de localização no banco de dados com o blob JSON
        createRecordingMutation.mutate({
          type: 'location',
          device_id: devices[0]?.id || 'default',
          duration: recordingTimeLimit * 60,
          size: Math.round(jsonBlob.size / 1024), // KB
          blob: jsonBlob, // Passar o blob JSON
          location_data: locationData // Também salvar os dados estruturados
        });
        
        if ((window as any).showNotification) {
          (window as any).showNotification('success', `Dados de localização do pânico salvos! ${locationHistory.length} pontos coletados.`);
        }
      } catch (error) {
        console.error('Erro ao salvar dados de localização do pânico:', error);
        if ((window as any).showNotification) {
          (window as any).showNotification('error', 'Erro ao salvar dados de localização do pânico');
        }
      }
    }
    
    stopAllRecordings();
    
    // Limpar timeout e estado persistente
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    // isRecordingPersistentRef.current = false;
    
    if ((window as any).showNotification) {
      (window as any).showNotification('success', `Modo pânico finalizado! Gravação de ${recordingTimeLimit} minutos concluída.`);
    }
  };

  const stopFeatureRecording = async (feature: 'camera' | 'audio' | 'location') => {
    setActiveFeatures(prev => ({ ...prev, [feature]: false }));
    
    // Se for gravação de localização, salvar dados como arquivo JSON
    if (feature === 'location' && locationHistory.length > 0) {
      try {
        // Criar dados estruturados para o arquivo JSON
        const locationData = {
          type: 'location_recording',
          device_id: devices.length > 0 ? devices[0].id : 'default-device',
          duration: recordingTimeLimit * 60,
          start_time: locationHistory[0]?.timestamp,
          end_time: new Date().toISOString(),
          total_points: locationHistory.length,
          locations: locationHistory.map(item => ({
            timestamp: item.timestamp,
            latitude: item.position.coords.latitude,
            longitude: item.position.coords.longitude,
            accuracy: item.position.coords.accuracy,
            altitude: item.position.coords.altitude,
            heading: item.position.coords.heading,
            speed: item.position.coords.speed,
            address: item.address
          }))
        };
        
        // Criar blob JSON
        const jsonBlob = new Blob([JSON.stringify(locationData, null, 2)], { 
          type: 'application/json' 
        });
        
        console.log('📤 Salvando dados de localização:', locationData);
        
        // Salvar gravação no banco de dados com o blob JSON
        createRecordingMutation.mutate({
          type: 'location',
          device_id: devices[0]?.id || 'default',
          duration: recordingTimeLimit * 60,
          size: Math.round(jsonBlob.size / 1024), // KB
          blob: jsonBlob, // Passar o blob JSON
          location_data: locationData // Também salvar os dados estruturados
        });
        
        if ((window as any).showNotification) {
          (window as any).showNotification('success', `Dados de localização salvos! ${locationHistory.length} pontos coletados.`);
        }
      } catch (error) {
        console.error('Erro ao salvar dados de localização:', error);
        if ((window as any).showNotification) {
          (window as any).showNotification('error', 'Erro ao salvar dados de localização');
        }
      }
    }
    
    stopSpecificRecording(feature);
    
    // Limpar timeout e estado persistente
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    // isRecordingPersistentRef.current = false;
    
    if ((window as any).showNotification) {
      (window as any).showNotification('success', `Gravação de ${feature} finalizada! Tempo de ${recordingTimeLimit} minutos concluído.`);
    }
  };

  // Loading state
  if (devicesLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-8 md:pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando dispositivos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8 md:pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Shield className="h-16 w-16 text-primary animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Anjo da Guarda
          </h1>
          <p className="text-muted-foreground">Sua segurança sempre protegida</p>
        </div>


        {/* Status Cards - Now clickable */}
        <div className="grid grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
          <Card 
            className={`p-4 transition-all cursor-pointer hover:shadow-glow ${activeFeatures.camera ? 'bg-success/10 border-success' : 'bg-card'}`}
            onClick={() => handleFeatureToggle('camera')}
          >
            <div className="flex flex-col items-center gap-2">
              <Camera className={`h-6 w-6 ${activeFeatures.camera ? 'text-success' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium">Câmera</span>
              {activeFeatures.camera && (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-success animate-pulse" />
                    <span className="text-xs text-success">Ativa</span>
                  </div>
                  <span className="text-xs text-success/70">Não pode cancelar</span>
                </div>
              )}
            </div>
          </Card>

          <Card 
            className={`p-4 transition-all cursor-pointer hover:shadow-glow ${activeFeatures.audio ? 'bg-success/10 border-success' : 'bg-card'}`}
            onClick={() => handleFeatureToggle('audio')}
          >
            <div className="flex flex-col items-center gap-2">
              <Mic className={`h-6 w-6 ${activeFeatures.audio ? 'text-success' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium">Áudio</span>
              {activeFeatures.audio && (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-success animate-pulse" />
                    <span className="text-xs text-success">Ativo</span>
                  </div>
                  <span className="text-xs text-success/70">Não pode cancelar</span>
                </div>
              )}
            </div>
          </Card>

          <Card 
            className={`p-4 transition-all cursor-pointer hover:shadow-glow ${activeFeatures.location ? 'bg-success/10 border-success' : 'bg-card'}`}
            onClick={() => handleFeatureToggle('location')}
          >
            <div className="flex flex-col items-center gap-2">
              <MapPin className={`h-6 w-6 ${activeFeatures.location ? 'text-success' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium">Localização</span>
              {activeFeatures.location && (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-success animate-pulse" />
                    <span className="text-xs text-success">Ativa</span>
                  </div>
                  <span className="text-xs text-success/70">Não pode cancelar</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Panic Button */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {isPanicActive && (
              <div className="absolute inset-0 animate-ping">
                <div className="w-full h-full rounded-full bg-red-500 opacity-75"></div>
              </div>
            )}
            <Button
              variant={isPanicActive ? "destructive" : "default"}
              size="lg"
              onClick={handlePanicButton}
              className="relative h-48 w-48 rounded-full text-2xl"
              disabled={createRecordingMutation.isPending}
            >
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="h-16 w-16" />
                <span>{isPanicActive ? "GRAVANDO" : "PÂNICO"}</span>
                {isPanicActive && (
                  <span className="text-xs opacity-75">Não pode cancelar</span>
                )}
              </div>
            </Button>
          </div>
        </div>

        {/* Recording Status */}
        {recordingState.isRecording && (
          <Card className="max-w-2xl mx-auto mb-8 p-6 bg-gradient-card">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-semibold text-red-500">GRAVANDO</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Duração: {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </p>
              {locationData && (
                <div className="text-xs text-muted-foreground mt-1">
                  <p className="font-medium">📍 {locationAddress || 'Obtendo endereço...'}</p>
                  <p className="text-xs opacity-75">
                    Lat: {locationData.coords.latitude.toFixed(6)}, 
                    Lng: {locationData.coords.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Video Preview */}
        {activeFeatures.camera && (
          <Card className="max-w-2xl mx-auto mb-8 p-4">
            <h3 className="text-lg font-semibold mb-4">Preview da Câmera</h3>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-64 object-cover rounded-lg"
            />
            
            {/* Localização embaixo do preview da câmera */}
            {locationData && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Localização Atual</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{locationAddress || 'Obtendo endereço...'}</p>
                  <p className="text-xs text-muted-foreground">
                    Lat: {locationData.coords.latitude.toFixed(6)}, 
                    Lng: {locationData.coords.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Location Map */}
        {activeFeatures.location && locationData && (
          <Card className="max-w-2xl mx-auto mb-8 p-4">
            <h3 className="text-lg font-semibold mb-4">📍 Localização Atual</h3>
            <div className="space-y-3">
              <div className="bg-card p-3 rounded-lg">
                <p className="font-medium text-sm">{locationAddress || 'Obtendo endereço...'}</p>
                <p className="text-xs text-muted-foreground">
                  Lat: {locationData.coords.latitude.toFixed(6)}, 
                  Lng: {locationData.coords.longitude.toFixed(6)}
                </p>
              </div>
              <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${locationData.coords.longitude-0.001},${locationData.coords.latitude-0.001},${locationData.coords.longitude+0.001},${locationData.coords.latitude+0.001}&layer=mapnik&marker=${locationData.coords.latitude},${locationData.coords.longitude}`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="rounded-lg"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Controle de Tempo de Gravação */}
        <Card className="max-w-2xl mx-auto mb-8 p-6 bg-gradient-card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Tempo de Gravação
          </h3>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Defina o tempo limite para todas as gravações (pânico, câmera, áudio, localização)
              </p>
              <div className="text-2xl font-bold text-primary mb-2">
                {recordingTimeLimit} {recordingTimeLimit === 1 ? 'minuto' : 'minutos'}
              </div>
            </div>
            
            <div className="px-4">
              <input
                type="range"
                min="1"
                max="60"
                value={recordingTimeLimit}
                onChange={(e) => setRecordingTimeLimit(parseInt(e.target.value))}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(recordingTimeLimit - 1) * 100 / 59}%, #e5e7eb ${(recordingTimeLimit - 1) * 100 / 59}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>1 min</span>
                <span>30 min</span>
                <span>60 min</span>
              </div>
            </div>
            
            <style jsx>{`
              .slider::-webkit-slider-thumb {
                appearance: none;
                height: 20px;
                width: 20px;
                border-radius: 50%;
                background: #3b82f6;
                cursor: pointer;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              }
              
              .slider::-moz-range-thumb {
                height: 20px;
                width: 20px;
                border-radius: 50%;
                background: #3b82f6;
                cursor: pointer;
                border: 2px solid #ffffff;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              }
            `}</style>
            
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                ⚠️ As gravações não podem ser canceladas até completar o tempo definido
              </p>
            </div>
          </div>
        </Card>

        {/* Connection Monitor */}
        <div className="mb-8">
          <ConnectionMonitor />
        </div>

        <Card className="max-w-2xl mx-auto p-6 bg-gradient-card">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Como funciona
          </h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <span>Pressione o botão de pânico em caso de emergência</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <span>Vídeo com áudio e localização serão ativados discretamente</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <span>Os arquivos são salvos e você pode baixar quando quiser</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              <span>Use os botões individuais para gravar apenas o que precisar</span>
            </li>
          </ul>
        </Card>


        {/* Debug Info */}
        {devicesError && (
          <Card className="max-w-2xl mx-auto mt-8 p-6 bg-destructive/10 border-destructive">
            <h3 className="text-lg font-semibold mb-4 text-destructive">Erro de Conexão</h3>
            <p className="text-sm text-destructive">
              Não foi possível carregar os dispositivos. Verifique sua conexão com a internet.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
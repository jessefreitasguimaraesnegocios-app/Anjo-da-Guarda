import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  FileVideo, 
  FileAudio, 
  MapPin, 
  Download, 
  Trash2, 
  Calendar, 
  Search, 
  Filter, 
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Lock,
  ArrowLeft,
  RefreshCw
} from "lucide-react";
import { useRecordings, Recording } from "@/hooks/useRecordings";
import { useDevices } from "@/hooks/useDevices";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase";

export default function MeusRegistros() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [currentPlaying, setCurrentPlaying] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [deletingRecording, setDeletingRecording] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  const { getRecordings, deleteRecording } = useRecordings();
  const { getDevices } = useDevices();
  const queryClient = useQueryClient();

  // Fetch recordings
  const { data: recordings = [], isLoading: recordingsLoading } = useQuery({
    queryKey: ['recordings'],
    queryFn: getRecordings,
    onSuccess: (data) => {
      console.log('📋 Gravações carregadas em MeusRegistros:', data);
    },
    onError: (error) => {
      console.error('❌ Erro ao carregar gravações:', error);
    }
  });

  // Fetch devices for context
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  // Delete recording mutation
  const deleteRecordingMutation = useMutation({
    mutationFn: deleteRecording,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      setDeletingRecording(null);
      if ((window as any).showNotification) {
        (window as any).showNotification('success', 'Registro removido com sucesso!');
      }
    },
    onError: (error: any) => {
      setDeletingRecording(null);
      if ((window as any).showNotification) {
        (window as any).showNotification('error', error.message || 'Erro ao remover registro');
      }
    },
  });

  const handlePlay = async (recording: Recording) => {
    if (currentPlaying === recording.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        videoRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        videoRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setCurrentPlaying(recording.id);
      setIsPlaying(true);
      
      try {
        // Verificar se o arquivo existe antes de tentar reproduzir
        if (!recording.file_path) {
          console.error('❌ Nenhum file_path encontrado para o registro');
          if ((window as any).showNotification) {
            (window as any).showNotification('warning', 'Esta gravação não possui arquivo associado. Pode ter sido feita antes da atualização do sistema.');
          }
          setCurrentPlaying(null);
          setIsPlaying(false);
          return;
        }

        console.log('🔍 Tentando baixar arquivo:', recording.file_path);
        
        // Para gravações de localização, mostrar dados diretamente
        if (recording.type === 'location' && recording.location_data) {
          console.log('📍 Exibindo dados de localização:', recording.location_data);
          if ((window as any).showNotification) {
            (window as any).showNotification('success', `Dados de localização carregados! ${recording.location_data.total_points || 0} pontos coletados.`);
          }
          setCurrentPlaying(null);
          setIsPlaying(false);
          return;
        }
        
        // Primeiro, verificar se o arquivo existe no storage
        const { data: listData, error: listError } = await supabase.storage
          .from('recordings')
          .list(recording.file_path.split('/')[0], {
            limit: 1000,
            offset: 0
          });
        
        if (listError) {
          console.error('❌ Erro ao listar arquivos:', listError);
          throw new Error('Erro ao verificar arquivos no servidor');
        }

        const fileName = recording.file_path.split('/').pop();
        const fileExists = listData?.some(file => file.name === fileName);
        
        if (!fileExists) {
          console.error('❌ Arquivo não encontrado no storage:', fileName);
          if ((window as any).showNotification) {
            (window as any).showNotification('warning', 'Arquivo não encontrado no servidor. Esta gravação pode ter sido feita antes da atualização do sistema.');
          }
          setCurrentPlaying(null);
          setIsPlaying(false);
          return;
        }
        
        // Gerar URL assinada do Supabase Storage (backend) para reprodução
        const { data: urlData, error: urlError } = await supabase.storage
          .from('recordings')
          .createSignedUrl(recording.file_path, 3600); // URL válida por 1 hora

        if (urlError || !urlData) {
          console.error('❌ Erro ao gerar URL assinada:', urlError);
          
          // Tratar diferentes tipos de erro
          if (urlError?.message?.includes('not found') || urlError?.message?.includes('404') || urlError?.message?.includes('Object not found')) {
            if ((window as any).showNotification) {
              (window as any).showNotification('warning', 'Arquivo não encontrado no servidor. Esta gravação pode ter sido feita antes da atualização do sistema.');
            }
          } else if (urlError?.message?.includes('StorageUnknownError')) {
            if ((window as any).showNotification) {
              (window as any).showNotification('error', 'Erro de conexão com o servidor de arquivos. Tente novamente em alguns instantes.');
            }
          } else {
            if ((window as any).showNotification) {
              (window as any).showNotification('error', `Erro ao acessar arquivo: ${urlError?.message || 'Erro desconhecido'}`);
            }
          }
          
          setCurrentPlaying(null);
          setIsPlaying(false);
          return;
        }

        const url = urlData.signedUrl;
        console.log('✅ URL assinada gerada com sucesso:', url);
        
        // Limpar URLs anteriores para evitar vazamentos de memória
        if (audioRef.current?.src && audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        if (videoRef.current?.src && videoRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(videoRef.current.src);
        }
        
        if (recording.type === 'video' || recording.type === 'panic') {
          if (videoRef.current) {
            videoRef.current.src = url;
            videoRef.current.crossOrigin = 'anonymous';
            videoRef.current.load();
            
            // Aguardar o metadata carregar antes de reproduzir
            videoRef.current.addEventListener('loadedmetadata', () => {
              setDuration(videoRef.current?.duration || 0);
              videoRef.current?.play().catch(err => {
                console.error('Erro ao reproduzir vídeo:', err);
                if ((window as any).showNotification) {
                  (window as any).showNotification('error', 'Erro ao reproduzir vídeo');
                }
              });
            }, { once: true });
            
            // Atualizar tempo atual durante reprodução
            videoRef.current.addEventListener('timeupdate', () => {
              setCurrentTime(videoRef.current?.currentTime || 0);
            });
          }
        } else if (recording.type === 'audio') {
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.crossOrigin = 'anonymous';
            audioRef.current.load();
            
            // Aguardar o metadata carregar antes de reproduzir
            audioRef.current.addEventListener('loadedmetadata', () => {
              setDuration(audioRef.current?.duration || 0);
              audioRef.current?.play().catch(err => {
                console.error('Erro ao reproduzir áudio:', err);
                if ((window as any).showNotification) {
                  (window as any).showNotification('error', 'Erro ao reproduzir áudio');
                }
              });
            }, { once: true });
            
            // Atualizar tempo atual durante reprodução
            audioRef.current.addEventListener('timeupdate', () => {
              setCurrentTime(audioRef.current?.currentTime || 0);
            });
          }
        }

        if ((window as any).showNotification) {
          (window as any).showNotification('success', `Reproduzindo: ${getTypeLabel(recording.type)}`);
        }
      } catch (error: any) {
        console.error('❌ Erro ao reproduzir arquivo:', error);
        if ((window as any).showNotification) {
          (window as any).showNotification('error', `Erro ao reproduzir arquivo: ${error.message || 'Erro desconhecido'}`);
        }
        setCurrentPlaying(null);
        setIsPlaying(false);
      }
    }
  };

  const handleDownload = async (recording: Recording) => {
    try {
      // Verificar se o arquivo existe antes de tentar baixar
      if (!recording.file_path) {
        console.error('❌ Nenhum file_path encontrado para o registro');
        if ((window as any).showNotification) {
          (window as any).showNotification('warning', 'Esta gravação não possui arquivo associado. Pode ter sido feita antes da atualização do sistema.');
        }
        return;
      }

      console.log('📥 Iniciando download do arquivo:', recording.file_path);

      // Primeiro, verificar se o arquivo existe no storage
      const { data: listData, error: listError } = await supabase.storage
        .from('recordings')
        .list(recording.file_path.split('/')[0], {
          limit: 1000,
          offset: 0
        });
      
      if (listError) {
        console.error('❌ Erro ao listar arquivos:', listError);
        if ((window as any).showNotification) {
          (window as any).showNotification('error', 'Erro ao verificar arquivos no servidor');
        }
        return;
      }

      const fileName = recording.file_path.split('/').pop();
      const fileExists = listData?.some(file => file.name === fileName);
      
      if (!fileExists) {
        console.error('❌ Arquivo não encontrado no storage:', fileName);
        if ((window as any).showNotification) {
          (window as any).showNotification('warning', 'Arquivo não encontrado no servidor. Esta gravação pode ter sido feita antes da atualização do sistema.');
        }
        return;
      }

      // Gerar URL assinada do Supabase Storage (backend) para download
      const { data: urlData, error: urlError } = await supabase.storage
        .from('recordings')
        .createSignedUrl(recording.file_path, 3600); // URL válida por 1 hora

      if (urlError || !urlData) {
        console.error('❌ Erro ao gerar URL assinada:', urlError);
        
        // Tratar diferentes tipos de erro
        if (urlError?.message?.includes('not found') || urlError?.message?.includes('404') || urlError?.message?.includes('Object not found')) {
          if ((window as any).showNotification) {
            (window as any).showNotification('warning', 'Arquivo não encontrado no servidor. Esta gravação pode ter sido feita antes da atualização do sistema.');
          }
        } else if (urlError?.message?.includes('StorageUnknownError')) {
          if ((window as any).showNotification) {
            (window as any).showNotification('error', 'Erro de conexão com o servidor de arquivos. Tente novamente em alguns instantes.');
          }
        } else {
          if ((window as any).showNotification) {
            (window as any).showNotification('error', `Erro ao baixar arquivo: ${urlError?.message || 'Erro desconhecido'}`);
          }
        }
        return;
      }

      console.log('✅ URL assinada gerada com sucesso para download');

      // Criar nome do arquivo mais descritivo
      const date = new Date(recording.created_at);
      const dateStr = date.toLocaleDateString('pt-BR').replace(/\//g, '-');
      const timeStr = date.toLocaleTimeString('pt-BR', { hour12: false }).replace(/:/g, '-');
      const typeLabel = getTypeLabel(recording.type);
      
      // Determinar extensão baseada no tipo
      const fileExt = recording.type === 'location' ? 'json' : 
                     recording.type === 'audio' ? 'webm' : 
                     recording.type === 'video' || recording.type === 'panic' ? 'webm' : 'webm';
      
      const downloadFileName = `${typeLabel}_${dateStr}_${timeStr}.${fileExt}`;
      
      // Baixar arquivo usando fetch com a URL assinada
      try {
        const response = await fetch(urlData.signedUrl);
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('✅ Arquivo baixado com sucesso:', blob.size, 'bytes');
        
        // Criar URL para download
        const url = URL.createObjectURL(blob);
        
        // Criar elemento de download
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadFileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Limpar URL após um tempo
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      } catch (fetchError) {
        console.error('❌ Erro ao baixar arquivo:', fetchError);
        if ((window as any).showNotification) {
          (window as any).showNotification('error', `Erro ao baixar arquivo: ${fetchError instanceof Error ? fetchError.message : 'Erro desconhecido'}`);
        }
        return;
      }

      if ((window as any).showNotification) {
        (window as any).showNotification('success', `Download iniciado: ${getTypeLabel(recording.type)}`);
      }

    } catch (error: any) {
      console.error('❌ Erro ao fazer download:', error);
      if ((window as any).showNotification) {
        (window as any).showNotification('error', `Erro ao fazer download: ${error.message || 'Erro desconhecido'}`);
      }
    }
  };

  const handleStop = () => {
    setCurrentPlaying(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    
    // Pausar e limpar elementos de mídia
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current.src = '';
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(videoRef.current.src);
      }
      videoRef.current.src = '';
    }
  };

  const handleConfirmDelete = (recordingId: string) => {
    setDeletingRecording(recordingId);
    deleteRecordingMutation.mutate(recordingId);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) audioRef.current.volume = newVolume;
    if (videoRef.current) videoRef.current.volume = newVolume;
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) audioRef.current.muted = !isMuted;
    if (videoRef.current) videoRef.current.muted = !isMuted;
  };

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case "video":
        return <FileVideo className="h-5 w-5" />;
      case "audio":
        return <FileAudio className="h-5 w-5" />;
      case "location":
        return <MapPin className="h-5 w-5" />;
      case "panic":
        return <FileVideo className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (tipo: string) => {
    switch (tipo) {
      case "video":
        return "Vídeo";
      case "audio":
        return "Áudio";
      case "location":
        return "Localização";
      case "panic":
        return "Pânico";
      default:
        return tipo;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "N/A";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDeviceName = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    return device?.name || "Dispositivo desconhecido";
  };

  // Filter recordings
  const filteredRecordings = recordings.filter(recording => {
    const matchesSearch = recording.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getTypeLabel(recording.type).toLowerCase().includes(searchTerm.toLowerCase()) ||
                         new Date(recording.created_at).toLocaleString().toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "all" || recording.type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (recordingsLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-8 md:pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando registros...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8 md:pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/evidencias')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <Lock className="h-8 w-8 text-primary" />
                Meus Registros
              </h1>
              <p className="text-muted-foreground">
                Área protegida com reprodução de arquivos
              </p>
            </div>
          </div>
        </div>

        {/* Player Controls */}
        {currentPlaying && (
          <Card className="p-6 mb-8 bg-gradient-card">
            <div className="flex items-center gap-4 mb-4">
              <Button
                size="icon"
                variant="outline"
                onClick={handleStop}
              >
                <Pause className="h-4 w-4" />
              </Button>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">
                    {formatTime(currentTime)}
                  </span>
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Registros</p>
                <p className="text-2xl font-bold text-primary">{filteredRecordings.length}</p>
              </div>
              <FileVideo className="h-8 w-8 text-primary" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reproduzindo</p>
                <p className="text-2xl font-bold text-primary">
                  {currentPlaying ? '1' : '0'}
                </p>
              </div>
              <Play className="h-8 w-8 text-primary" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Último Acesso</p>
                <p className="text-2xl font-bold text-primary">
                  {filteredRecordings.length > 0 
                    ? new Date(filteredRecordings[0].created_at).toLocaleDateString()
                    : 'Nenhum'
                  }
                </p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar registros..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
          >
            <option value="all">Todos os tipos</option>
            <option value="video">Vídeo</option>
            <option value="audio">Áudio</option>
            <option value="location">Localização</option>
            <option value="panic">Pânico</option>
          </select>
          
          {/* Botão de debug temporário */}
          <Button
            variant="outline"
            onClick={() => {
              console.log('🔄 Forçando atualização da lista de gravações...');
              queryClient.invalidateQueries({ queryKey: ['recordings'] });
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Lista de Registros */}
        <div className="space-y-4">
          {filteredRecordings.map((recording) => (
            <Card key={recording.id} className="p-6 hover:shadow-glow transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Icon and Info */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-3 bg-primary/10 rounded-lg text-primary">
                    {getIcon(recording.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">
                      {getTypeLabel(recording.type)} - {new Date(recording.created_at).toLocaleString()}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                      <span>{getTypeLabel(recording.type)}</span>
                      <span>•</span>
                      <span>{formatFileSize(recording.size)}</span>
                      <span>•</span>
                      <span>{formatDuration(recording.duration)}</span>
                      {recording.type === 'location' && recording.location_data && (
                        <>
                          <span>•</span>
                          <span>{recording.location_data.total_points || 0} pontos</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dispositivo: {getDeviceName(recording.device_id)}
                    </p>
                    
                    {/* Exibir dados de localização se disponíveis */}
                    {recording.type === 'location' && recording.location_data && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Dados de Localização</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Pontos:</span>
                            <span className="ml-1 font-medium">{recording.location_data.total_points || 0}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Duração:</span>
                            <span className="ml-1 font-medium">{formatDuration(recording.location_data.duration)}</span>
                          </div>
                          {recording.location_data.locations && recording.location_data.locations.length > 0 && (
                            <>
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Primeira posição:</span>
                                <span className="ml-1 font-medium">
                                  {recording.location_data.locations[0].latitude.toFixed(6)}, {recording.location_data.locations[0].longitude.toFixed(6)}
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Endereço:</span>
                                <span className="ml-1 font-medium">{recording.location_data.locations[0].address || 'N/A'}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status and Actions */}
                <div className="flex items-center justify-between lg:justify-end gap-4">
                  {/* Status Badge */}
                  <Badge 
                    variant="outline" 
                    className={
                      recording.file_path || (recording.type === 'location' && recording.location_data)
                        ? "bg-success/10 text-success border-success" 
                        : "bg-warning/10 text-warning border-warning"
                    }
                  >
                    {recording.file_path || (recording.type === 'location' && recording.location_data) ? "Disponível" : "Sem arquivo"}
                  </Badge>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant={currentPlaying === recording.id ? "default" : "outline"}
                      onClick={() => handlePlay(recording)}
                      title={
                        recording.file_path || (recording.type === 'location' && recording.location_data) 
                          ? (currentPlaying === recording.id ? "Pausar" : "Reproduzir") 
                          : "Arquivo não disponível"
                      }
                      className="gap-2"
                      disabled={!recording.file_path && !(recording.type === 'location' && recording.location_data)}
                    >
                      {currentPlaying === recording.id && isPlaying ? (
                        <>
                          <Pause className="h-4 w-4" />
                          <span className="hidden sm:inline">Pausar</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          <span className="hidden sm:inline">Reproduzir</span>
                        </>
                      )}
                    </Button>

                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDownload(recording)}
                      title={recording.file_path ? "Baixar arquivo" : "Arquivo não disponível"}
                      className="gap-2"
                      disabled={!recording.file_path}
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Baixar</span>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive hover:bg-destructive/10"
                          title="Remover registro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover este registro? Esta ação não pode ser desfeita.
                            <br />
                            <br />
                            <strong>Arquivo:</strong> {getTypeLabel(recording.type)} - {new Date(recording.created_at).toLocaleString()}
                            <br />
                            <strong>Dispositivo:</strong> {getDeviceName(recording.device_id)}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleConfirmDelete(recording.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Sim, Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredRecordings.length === 0 && (
          <Card className="p-12 text-center">
            <Lock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">
              Nenhum registro encontrado
            </h3>
            <p className="text-muted-foreground">
              Não há registros disponíveis para reprodução
            </p>
          </Card>
        )}

        {/* Hidden Media Elements */}
        <audio ref={audioRef} style={{ display: 'none' }} />
        <video ref={videoRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}


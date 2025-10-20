import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LocationData, ViewMode, EvidenceType } from '../types';

interface RecordingViewProps {
  mode: ViewMode;
  maxDuration: number; // in minutes
  onClose: () => void;
  onSave: (type: EvidenceType, blob: Blob, duration: number, locationHistory: LocationData[]) => void;
}

type LayoutMode = 'split' | 'rear-main' | 'front-main';

const RecordingView: React.FC<RecordingViewProps> = ({ mode, maxDuration, onClose, onSave }) => {
  const videoRearRef = useRef<HTMLVideoElement>(null);
  const videoFrontRef = useRef<HTMLVideoElement>(null);
  
  const streamRearRef = useRef<MediaStream | null>(null);
  const streamFrontRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const locationHistoryRef = useRef<LocationData[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [hasDualCamera, setHasDualCamera] = useState(false);

  const isLive = mode === ViewMode.Live;
  const isVideo = mode === ViewMode.RecordingVideo || mode === ViewMode.RecordingPanic || mode === ViewMode.Live;
  const isAudioOnly = mode === ViewMode.RecordingAudio;

  const handleStop = useCallback(() => {
    if (isLive) {
        onClose();
        return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, [isLive, onClose]);

  useEffect(() => {
    let timer: number;
    if (isRecording || isLive) {
      timer = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => window.clearInterval(timer);
  }, [isRecording, isLive]);

  // Auto-stop timer
  useEffect(() => {
    if (isRecording && maxDuration > 0 && !isLive) {
      const maxDurationInSeconds = maxDuration * 60;
      if (duration >= maxDurationInSeconds) {
        handleStop();
      }
    }
  }, [duration, isRecording, maxDuration, isLive, handleStop]);

  useEffect(() => {
    let locationWatchId: number;

    const setupStreams = async () => {
      let rearStream: MediaStream | null = null;
      let frontStream: MediaStream | null = null;
      let audioStream: MediaStream | null = null;
      
      try {
        // Get audio first, as it's needed for all recording types
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = audioStream;

        // Try to get both video streams in parallel for faster setup
        const [rearResult, frontResult] = await Promise.allSettled([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        ]);

        if (rearResult.status === 'fulfilled') {
          rearStream = rearResult.value;
          streamRearRef.current = rearStream;
          if (videoRearRef.current) videoRearRef.current.srcObject = rearStream;
        } else {
           console.warn("Could not get rear camera, trying any camera as fallback.", rearResult.reason);
           try {
             const anyStream = await navigator.mediaDevices.getUserMedia({ video: true });
             rearStream = anyStream;
             streamRearRef.current = anyStream;
             if (videoRearRef.current) videoRearRef.current.srcObject = anyStream;
           } catch (e) {
             console.error("Fallback to any camera also failed.", e);
           }
        }
        
        if (frontResult.status === 'fulfilled') {
          frontStream = frontResult.value;
          streamFrontRef.current = frontStream;
          if (videoFrontRef.current) videoFrontRef.current.srcObject = frontStream;
        } else {
          console.warn("Could not get front camera.", frontResult.reason);
        }

        const dualCamSupported = !!(rearStream && frontStream);
        setHasDualCamera(dualCamSupported);

        if (isAudioOnly) {
          if (!isLive) startRecording(audioStream);
          else setDuration(0);
          return;
        }

        if (isLive) {
            setDuration(0);
        } else {
            const videoStreamForRecording = streamRearRef.current || streamFrontRef.current;
            if (videoStreamForRecording && audioStream) {
                const videoTrack = videoStreamForRecording.getVideoTracks()[0];
                const audioTrack = audioStream.getAudioTracks()[0];
                const combinedStream = new MediaStream([videoTrack, audioTrack]);
                startRecording(combinedStream);
            } else if (audioStream) {
                console.warn("Video mode failed to get camera, falling back to audio-only.");
                startRecording(audioStream);
            } else {
                throw new Error("No media streams available to record.");
            }
        }
      } catch (err) {
        console.error("Error accessing media devices.", err);
        alert("Não foi possível acessar a câmera/microfone. Verifique as permissões.");
        onClose();
      }
    };

    setupStreams();

    locationWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLocation: LocationData = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setCurrentLocation(newLocation);
        locationHistoryRef.current.push(newLocation);
      },
      (err) => console.error("Location error:", err),
      { enableHighAccuracy: true }
    );
    
    return () => {
      navigator.geolocation.clearWatch(locationWatchId);
      const stopStream = (stream: MediaStream | null) => {
        stream?.getTracks().forEach(track => track.stop());
      };
      stopStream(streamRearRef.current);
      stopStream(streamFrontRef.current);
      stopStream(audioStreamRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = (stream: MediaStream) => {
    recordedChunksRef.current = [];
    const hasVideo = stream.getVideoTracks().length > 0;
    
    let mimeType: string;

    if (hasVideo) {
      mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    } else {
      mimeType = 'audio/webm';
    }
    
    try {
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
    } catch (e) {
      console.error(`Error creating MediaRecorder with ${mimeType}:`, e);
      if (hasVideo && mimeType === 'video/mp4') {
        console.warn('Retrying with video/webm...');
        mimeType = 'video/webm';
        try {
          mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
        } catch (fallbackError) {
          console.error('Fallback to video/webm also failed:', fallbackError);
          alert("Não foi possível iniciar a gravação. O formato de vídeo não é suportado.");
          onClose();
          return;
        }
      } else {
        alert("Não foi possível iniciar a gravação. O formato de áudio não é suportado.");
        onClose();
        return;
      }
    }
    
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      let evidenceType: EvidenceType;
      switch (mode) {
        case ViewMode.RecordingVideo: evidenceType = EvidenceType.Video; break;
        case ViewMode.RecordingAudio: evidenceType = EvidenceType.Audio; break;
        case ViewMode.RecordingPanic: evidenceType = EvidenceType.Panic; break;
        default: evidenceType = hasVideo ? EvidenceType.Video : EvidenceType.Audio;
      }
      onSave(evidenceType, blob, duration, locationHistoryRef.current);
    };
    mediaRecorderRef.current.start();
    setIsRecording(true);
    setDuration(0);
  };
  
  const handleToggleLayout = () => {
    setLayoutMode(prev => {
      if (prev === 'split') return 'rear-main';
      if (prev === 'rear-main') return 'front-main';
      return 'split';
    });
  };

  const formatTime = (sec: number) => {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const getVideoClassNames = (cameraType: 'rear' | 'front') => {
      const baseClasses = 'object-cover transition-all duration-300 ease-in-out bg-black';
      if (!hasDualCamera) return `w-full h-full ${baseClasses}`;
      
      switch (layoutMode) {
          case 'split':
              return `w-1/2 h-full ${baseClasses}`;
          case 'rear-main':
              return cameraType === 'rear' 
                  ? `w-full h-full z-10 ${baseClasses}` 
                  : `absolute w-1/4 h-1/4 max-w-[200px] max-h-[200px] bottom-4 right-4 z-20 rounded-lg border-2 border-white/50 ${baseClasses}`;
          case 'front-main':
              return cameraType === 'front'
                  ? `w-full h-full z-10 ${baseClasses}`
                  : `absolute w-1/4 h-1/4 max-w-[200px] max-h-[200px] bottom-4 right-4 z-20 rounded-lg border-2 border-white/50 ${baseClasses}`;
      }
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
       {isVideo ? (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
            <video ref={videoRearRef} autoPlay muted playsInline className={getVideoClassNames('rear')} />
            {hasDualCamera && <video ref={videoFrontRef} autoPlay muted playsInline className={getVideoClassNames('front')} />}
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-white">
          <div className="w-32 h-32 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="mt-4 text-xl">Gravando áudio...</p>
        </div>
      )}
      
      <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/80 via-transparent to-black/50 pointer-events-none">
        <div className="flex justify-between items-start">
            <div className={`px-4 py-2 rounded-lg text-white font-bold flex items-center gap-2 pointer-events-auto ${isLive ? 'bg-slate-600' : 'bg-red-600 animate-pulse'}`}>
                <div className="w-3 h-3 bg-white rounded-full"></div>
                {isLive ? 'LIVE' : 'GRAVANDO'} • {formatTime(duration)}
            </div>
            {currentLocation && (
                <div className="text-white text-xs bg-black/50 p-2 rounded-lg text-right max-w-[150px] pointer-events-auto">
                    <p>{currentLocation.latitude.toFixed(5)}</p>
                    <p>{currentLocation.longitude.toFixed(5)}</p>
                </div>
            )}
        </div>
        
        <div className="flex items-center justify-center gap-4 pointer-events-auto">
            <button 
                onClick={handleStop} 
                className={`text-white font-bold py-3 px-8 rounded-lg transition-colors ${isLive ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-600 hover:bg-red-700'}`}
            >
                {isLive ? 'Fechar' : 'Parar Gravação'}
            </button>
            {isVideo && hasDualCamera && (
                 <button onClick={handleToggleLayout} className="bg-white/20 text-white p-3 rounded-full backdrop-blur-sm" aria-label="Alterar Layout">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4-4-4-4M12 4h8M12 12h8M12 20h8" />
                    </svg>
                 </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default RecordingView;
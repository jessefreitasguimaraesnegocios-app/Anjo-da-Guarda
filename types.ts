export enum EvidenceType {
  Video = 'Video',
  Audio = 'Audio',
  Location = 'Location',
  Panic = 'Panic',
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface Evidence {
  id: string;
  type: EvidenceType;
  timestamp: number;
  duration: number; // in seconds
  size: number; // in MB
  location: LocationData | null;
  hash: string;
  blobUrl?: string;
  mimeType?: string;
  locationHistory?: LocationData[];
}

export enum ViewMode {
  None,
  Location,
  Live,
  RecordingVideo,
  RecordingAudio,
  RecordingPanic,
}
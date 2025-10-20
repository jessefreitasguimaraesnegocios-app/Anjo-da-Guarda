
import { EvidenceType } from './types';

export const FREE_DOWNLOADS_LIMIT = 3;

export const DOWNLOAD_PRICES: Record<EvidenceType, number> = {
  [EvidenceType.Video]: 10,
  [EvidenceType.Audio]: 5,
  [EvidenceType.Location]: 15,
  [EvidenceType.Panic]: 25, // Panic combines multiple types
};

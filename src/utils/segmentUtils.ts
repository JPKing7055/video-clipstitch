import { VideoSegment } from '../types';

/**
 * Checks if a specific segment overlaps with any other segment in the list.
 */
export function isSegmentOverlapping(
  target: VideoSegment,
  allSegments: VideoSegment[]
): boolean {
  for (const seg of allSegments) {
    if (seg.id === target.id) continue;
    // Overlap occurs if start < other.end AND end > other.start
    if (target.startTime < seg.endTime && target.endTime > seg.startTime) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if there are any overlapping segments in the entire list.
 */
export function hasAnyOverlap(segments: VideoSegment[]): boolean {
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (
        segments[i].startTime < segments[j].endTime &&
        segments[i].endTime > segments[j].startTime
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculates aggregate stats for a list of segments.
 */
export function calculateSegmentsStats(
  segments: VideoSegment[],
  fps: number = 15
): {
  count: number;
  totalDurationSec: number;
  totalFrames: number;
  hasOverlap: boolean;
} {
  let totalDurationSec = 0;
  for (const seg of segments) {
    const rawDuration = Math.max(0.01, seg.endTime - seg.startTime);
    const outputDuration = rawDuration / (seg.speed || 1);
    totalDurationSec += outputDuration;
  }

  const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));
  const hasOverlap = hasAnyOverlap(segments);

  return {
    count: segments.length,
    totalDurationSec: Number(totalDurationSec.toFixed(2)),
    totalFrames,
    hasOverlap,
  };
}

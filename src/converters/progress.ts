export interface MediaProgress {
  processedSeconds: number
  totalSeconds: number
}

/**
 * `progress` is null when the current operation cannot be measured honestly.
 * A numeric value is reserved for work backed by FFmpeg's output timestamp.
 */
export type ConversionProgressCallback = (
  progress: number | null,
  stage: string,
  media?: MediaProgress
) => void

export function createProgressReporter(callback?: ConversionProgressCallback) {
  let lastProgress = 0
  let lastStage = ''

  return (progress: number | null, stage: string, media?: MediaProgress) => {
    if (progress === null) {
      lastStage = stage
      callback?.(null, stage)
      return
    }

    if (stage !== lastStage) lastProgress = 0
    const nextProgress = Math.max(lastProgress, Math.min(1, Math.max(0, progress)))
    lastStage = stage
    lastProgress = nextProgress
    callback?.(nextProgress, stage, media)
  }
}

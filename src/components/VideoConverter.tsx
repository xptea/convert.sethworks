import { useState, useCallback, useRef } from 'react'
import {
  convertVideo,
  initFFmpeg,
  isFFmpegLoaded,
  makeVideoFilename,
  type VideoFormat,
} from '@/converters/video'
import { downloadBlob } from '@/lib/download'
import { Dropzone } from './Dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'

const ACCEPT_VIDEO = 'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/avi,video/mov'

export function VideoConverter() {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<VideoFormat>('mp4')
  const [quality, setQuality] = useState(3)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'converting' | 'done' | 'error'>('idle')
  const [loadProgress, setLoadProgress] = useState(0)
  const [convertProgress, setConvertProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null)
  const loadingRef = useRef(false)

  const onFile = useCallback((f: File) => {
    setFile(f)
    setOutputBlob(null)
    setError(null)
    setPhase('idle')
    setConvertProgress(0)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!file || loadingRef.current) return
    loadingRef.current = true
    setError(null)
    setOutputBlob(null)

    if (!isFFmpegLoaded()) {
      setPhase('loading')
      try {
        await initFFmpeg((p) => setLoadProgress(p))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load FFmpeg')
        setPhase('error')
        loadingRef.current = false
        return
      }
    }

    setPhase('converting')
    setConvertProgress(0)
    try {
      const blob = await convertVideo(file, { format, quality }, (p) =>
        setConvertProgress(p)
      )
      setOutputBlob(blob)
      downloadBlob(blob, makeVideoFilename(file, format))
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Video conversion failed')
      setPhase('error')
    } finally {
      loadingRef.current = false
    }
  }, [file, format, quality])

  const progressValue =
    phase === 'loading' ? loadProgress : phase === 'converting' ? convertProgress : 0

  const progressLabel =
    phase === 'loading'
      ? 'Loading FFmpeg (one-time, ~30 MB)…'
      : phase === 'converting'
      ? `Converting to ${format.toUpperCase()}…`
      : ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video converter</CardTitle>
        <CardDescription>
          Convert MOV / WebM / AVI to MP4 or WebM locally. FFmpeg runs entirely in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Dropzone
          accept={ACCEPT_VIDEO}
          onFile={onFile}
          label="Drop a video here"
          supportedText="MP4, MOV, WebM, AVI"
        />

        {file && (
          <p className="text-sm text-muted-foreground">
            Selected: <span className="font-medium text-foreground">{file.name}</span>
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Output format</label>
            <Select value={format} onValueChange={(v) => setFormat(v as VideoFormat)}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                <SelectItem value="webm">WebM (VP9/Opus)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Quality: {quality} / 5
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-foreground"
            />
            <p className="text-xs text-muted-foreground">
              1 = smallest file, 5 = best quality
            </p>
          </div>
        </div>

        {(phase === 'loading' || phase === 'converting') && (
          <div className="space-y-2">
            <Progress value={Math.round(progressValue * 100)} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{progressLabel}</span>
              <span>{Math.round(progressValue * 100)}%</span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {phase === 'done' && outputBlob && (
          <p className="text-sm text-muted-foreground">
            Done — your converted file has been downloaded.
          </p>
        )}

        <Button
          onClick={handleConvert}
          disabled={!file || phase === 'loading' || phase === 'converting'}
          className="w-full"
        >
          {phase === 'loading'
            ? 'Loading FFmpeg…'
            : phase === 'converting'
            ? 'Converting…'
            : 'Convert & download'}
        </Button>
      </CardContent>
    </Card>
  )
}

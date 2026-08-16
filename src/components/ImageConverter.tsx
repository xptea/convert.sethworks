import { useState, useCallback, useMemo } from 'react'
import { convertImage, downloadBlob, makeImageFilename, type ImageFormat } from '@/converters/image'
import { Dropzone } from './Dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ACCEPT_IMAGE = 'image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp'

export function ImageConverter() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [format, setFormat] = useState<ImageFormat>('image/jpeg')
  const [quality, setQuality] = useState(0.85)
  const [maxWidth, setMaxWidth] = useState(1920)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = useCallback((f: File) => {
    setFile(f)
    setError(null)
    const url = URL.createObjectURL(f)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!file) return
    setConverting(true)
    setError(null)
    try {
      const blob = await convertImage(file, {
        format,
        quality,
        maxWidth,
      })
      downloadBlob(blob, makeImageFilename(file, format))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed')
    } finally {
      setConverting(false)
    }
  }, [file, format, quality, maxWidth])

  const qualityLabel = useMemo(() => {
    if (format === 'image/png') return 'PNG compression is lossless, so quality is ignored.'
    return `Quality: ${Math.round(quality * 100)}%`
  }, [format, quality])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image converter</CardTitle>
        <CardDescription>
          Convert PNG, JPEG, WebP, GIF, and more — all in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Dropzone
          accept={ACCEPT_IMAGE}
          onFile={onFile}
          label="Drop an image here"
          supportedText="PNG, JPG, WebP, GIF, BMP"
        />

        {preview && (
          <div className="flex justify-center rounded-lg border p-2">
            <img
              src={preview}
              alt="Preview"
              className="max-h-48 rounded-md object-contain"
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Output format</label>
            <Select value={format} onValueChange={(v) => setFormat(v as ImageFormat)}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image/png">PNG</SelectItem>
                <SelectItem value="image/jpeg">JPEG</SelectItem>
                <SelectItem value="image/webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Max width: {maxWidth}px</label>
            <input
              type="range"
              min={100}
              max={4000}
              step={100}
              value={maxWidth}
              onChange={(e) => setMaxWidth(Number(e.target.value))}
              className="w-full accent-foreground"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{qualityLabel}</label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            disabled={format === 'image/png'}
            className="w-full accent-foreground"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleConvert}
          disabled={!file || converting}
          className="w-full"
        >
          {converting ? 'Converting…' : 'Convert & download'}
        </Button>
      </CardContent>
    </Card>
  )
}

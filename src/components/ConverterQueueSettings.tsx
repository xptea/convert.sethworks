import type { GifOptions } from '@/converters/video'
import { Slider } from '@/components/ui/slider'

export function MetadataSetting({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-muted/60 px-3 py-2.5 text-left">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-primary"
      />
      <span>
        <span className="block text-xs font-medium text-foreground">Remove metadata</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
          Removes embedded author, device, comment, and location information where supported.
        </span>
      </span>
    </label>
  )
}

export function QualitySlider({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const pct = Math.round(value * 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Output quality</span>
        <span>{pct}%</span>
      </div>
      <Slider
        aria-label="Output quality"
        min={1}
        max={100}
        value={pct}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <p className="text-[10px] text-muted-foreground leading-tight">
        Higher preserves more detail. Lossless formats may ignore this setting.
      </p>
    </div>
  )
}

const selectClass = 'h-8 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50'

export function GifSettings({
  value,
  onChange,
  disabled,
}: {
  value: GifOptions
  onChange: (updates: Partial<GifOptions>) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Animated GIF settings</p>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          GIF has no normal bitrate setting. Resolution, FPS, colors, and dithering control quality and file size.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Resolution</span>
          <select
            aria-label="GIF resolution"
            className={selectClass}
            value={String(value.width)}
            disabled={disabled}
            onChange={(event) => onChange({
              width: event.target.value === 'original' ? 'original' : Number(event.target.value),
            })}
          >
            <option value="original">Original</option>
            <option value="320">320px wide</option>
            <option value="480">480px wide</option>
            <option value="640">640px wide</option>
            <option value="800">800px wide</option>
            <option value="960">960px wide</option>
          </select>
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Frame rate</span>
          <select
            aria-label="GIF frame rate"
            className={selectClass}
            value={value.fps}
            disabled={disabled}
            onChange={(event) => onChange({ fps: Number(event.target.value) })}
          >
            {[5, 10, 15, 20, 24, 30].map((fps) => (
              <option key={fps} value={fps}>{fps} FPS</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Palette</span>
          <select
            aria-label="GIF palette colors"
            className={selectClass}
            value={value.colors}
            disabled={disabled}
            onChange={(event) => onChange({ colors: Number(event.target.value) })}
          >
            {[32, 64, 128, 256].map((colors) => (
              <option key={colors} value={colors}>{colors} colors</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Loop</span>
          <select
            aria-label="GIF loop behavior"
            className={selectClass}
            value={value.loop ? 'forever' : 'once'}
            disabled={disabled}
            onChange={(event) => onChange({ loop: event.target.value === 'forever' })}
          >
            <option value="forever">Forever</option>
            <option value="once">Play once</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>Dithering</span>
        <select
          aria-label="GIF dithering"
          className={selectClass}
          value={value.dither}
          disabled={disabled}
          onChange={(event) => onChange({ dither: event.target.value as GifOptions['dither'] })}
        >
          <option value="sierra2_4a">Smooth gradients</option>
          <option value="bayer">Crisp pattern</option>
          <option value="none">None</option>
        </select>
      </label>

      <p className="rounded-lg bg-muted/60 px-2.5 py-2 text-[10px] leading-4 text-muted-foreground">
        Higher resolution, FPS, and color counts look better but can make GIF files much larger and slower to create.
      </p>
    </div>
  )
}

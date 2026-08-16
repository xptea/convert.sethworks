import { ConverterQueue } from '@/components/ConverterQueue'

function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            convert.sethworks
          </h1>
          <p className="mx-auto max-w-lg text-balance text-muted-foreground">
            Drag or click to add images and videos, pick the output format, and convert — all on your device.
          </p>
        </div>

        <ConverterQueue />

        <p className="text-xs text-muted-foreground">
          Runs 100% in your browser. Files never leave your device.
        </p>
      </div>
    </div>
  )
}

export default App

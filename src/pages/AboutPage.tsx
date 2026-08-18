import {
  ArrowLeft,
  Check,
  Cloud,
  Cpu,
  FileLock2,
  Gauge,
} from 'lucide-react'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteNav } from '@/components/SiteNav'

const steps = [
  ['You choose a file', 'The browser gives the page temporary access to the file you selected. Dragging works through the same browser File API.'],
  ['The format is identified', 'The app uses the file type and extension to show compatible image, video, and audio outputs.'],
  ['A local engine is selected', 'Common images use browser-native Canvas when it is faster. Other formats use FFmpeg compiled to WebAssembly.'],
  ['Conversion runs in memory', 'Input bytes are copied into the converter’s in-browser filesystem. The codec reads, transforms, and writes the result inside the tab.'],
  ['The result becomes a download', 'The output bytes are wrapped in a local Blob and exposed through a temporary object URL so your browser can save them.'],
  ['Temporary resources are released', 'Job files and download URLs are removed when they are no longer needed. Reloading or closing the page clears the current queue.'],
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
      <div className="space-y-4 text-[15px] leading-7 text-muted-foreground sm:text-base">{children}</div>
    </section>
  )
}

export function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background px-4">
      <SiteNav current="about" />

      <main className="mx-auto w-full max-w-3xl flex-1 py-8 sm:py-12">
        <article className="space-y-14 text-left">
          <header className="space-y-6 border-b border-border pb-10">
            <a href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="size-4" />
              Back to the converter
            </a>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                How your files are converted without leaving your device
              </h1>
              <p className="max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
                convert.sethworks.xyz is a static website that turns your browser into the conversion computer. There is no media upload server behind it: your files are read, processed, and downloaded locally in the tab you already have open.
              </p>
              <p className="text-sm text-muted-foreground">
                <time dateTime="2026-08-17">August 17, 2026</time>
                <span aria-hidden="true"> · </span>
                7 minute read
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <Cpu className="mb-3 size-5 text-foreground" />
                <p className="font-medium text-foreground">Execution</p>
                <p className="mt-1 text-sm text-muted-foreground">Your browser and CPU</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <Cloud className="mb-3 size-5 text-foreground" />
                <p className="font-medium text-foreground">Hosting</p>
                <p className="mt-1 text-sm text-muted-foreground">Static application files</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <FileLock2 className="mb-3 size-5 text-foreground" />
                <p className="font-medium text-foreground">Your media</p>
                <p className="mt-1 text-sm text-muted-foreground">Stays on your device</p>
              </div>
            </div>
          </header>

          <nav aria-label="Article contents" className="rounded-xl border border-border bg-card p-5">
            <p className="mb-3 text-sm font-medium text-foreground">In this article</p>
            <ol className="grid gap-x-6 gap-y-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li><a className="hover:text-foreground" href="#no-conversion-server">1. No conversion server</a></li>
              <li><a className="hover:text-foreground" href="#what-happens">2. What happens to a file</a></li>
              <li><a className="hover:text-foreground" href="#two-engines">3. The two local engines</a></li>
              <li><a className="hover:text-foreground" href="#network">4. What crosses the network</a></li>
              <li><a className="hover:text-foreground" href="#performance">5. Performance and memory</a></li>
              <li><a className="hover:text-foreground" href="#quality">6. Quality and file size</a></li>
              <li><a className="hover:text-foreground" href="#faq">7. Frequently asked questions</a></li>
            </ol>
          </nav>

          <Section id="no-conversion-server" title="A converter with no conversion server">
            <p>
              A conventional online converter sends your file to a company’s server, waits for that server to run a codec, and sends the result back. That design can be convenient, but it also means the service receives the original file and must temporarily store or process it somewhere outside your control.
            </p>
            <p>
              This site uses a different architecture. Cloudflare Pages serves the same kinds of static assets as any ordinary website: HTML, CSS, JavaScript, a small worker, and a WebAssembly codec bundle. Once those application files arrive, your browser does the conversion work. The app has no upload endpoint, user account, conversion database, or remote job queue.
            </p>
          </Section>

          <Section id="what-happens" title="What happens when you drop a file">
            <p>The complete lifecycle stays inside the browser page:</p>
            <ol className="grid gap-3 sm:grid-cols-2">
              {steps.map(([title, description], index) => (
                <li key={title} className="rounded-xl border border-border bg-card p-4">
                  <span className="mb-3 flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
                    {index + 1}
                  </span>
                  <h3 className="font-medium text-foreground">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                </li>
              ))}
            </ol>
            <p>
              The downloaded copy is a normal file on your device. It remains wherever you save it, while the temporary object URL used to start the download is revoked immediately afterward.
            </p>
            <p>
              Batch behavior follows the same rule. “Convert all” starts the pending items in your queue, and “Download as ZIP” uses JSZip in the page to assemble completed outputs locally. Choosing separate downloads creates a local browser download for each result instead.
            </p>
          </Section>

          <Section id="two-engines" title="Two local engines, chosen for the job">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <Gauge className="mb-4 size-5 text-foreground" />
                <h3 className="font-medium text-foreground">Browser Canvas</h3>
                <p className="mt-2 text-sm leading-6">
                  PNG, JPEG, and WebP can use the browser’s native image decoder and Canvas encoder. This route starts quickly and is usually faster for everyday still images.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <Cpu className="mb-4 size-5 text-foreground" />
                <h3 className="font-medium text-foreground">FFmpeg WebAssembly</h3>
                <p className="mt-2 text-sm leading-6">
                  Video, audio, and specialist image formats use FFmpeg compiled for the browser through <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-foreground">@ffmpeg/core-mt</code>.
                </p>
              </div>
            </div>
            <p>
              WebAssembly is a portable binary format that browsers can execute at near-native speed inside their security sandbox. The multithreaded FFmpeg build uses <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-foreground">SharedArrayBuffer</code> and browser workers. The app caps codec work at four threads to balance speed, memory use, and stability instead of consuming every logical CPU core.
            </p>
            <p>
              Cross-origin isolation headers (COOP and COEP) allow that shared-memory setup. They are security headers delivered with the static page, not evidence of a conversion backend.
            </p>
            <p>
              A format registry connects each picker label to its extension, MIME type, codec, container, and tested FFmpeg arguments. This is why a dropped file can be converted forward into another listed format and then dragged back in for a reverse conversion. Formats with decode-only support or unreliable browser encoders are not advertised as outputs.
            </p>
          </Section>

          <Section id="network" title="What crosses the network and what does not">
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[1fr_1.3fr] border-b border-border bg-secondary/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                <span>Network request</span><span>What it contains</span>
              </div>
              {[
                ['Page load', 'The interface: HTML, CSS, and JavaScript'],
                ['First FFmpeg job', 'The static FFmpeg JavaScript, worker, and compressed WASM engine'],
                ['Your input file', 'No request. The browser reads it locally'],
                ['Your output file', 'No response. The browser creates it locally'],
              ].map(([request, contents]) => (
                <div key={request} className="grid grid-cols-[1fr_1.3fr] border-b border-border px-4 py-3 text-sm last:border-0">
                  <span className="font-medium text-foreground">{request}</span><span>{contents}</span>
                </div>
              ))}
            </div>
            <p>
              The FFmpeg engine is roughly 10 MB after gzip compression and is fetched from the site only when a job needs it. You can confirm the separation yourself in browser developer tools: the Network panel shows application assets, while the input file is handled through the local File API rather than an upload request.
            </p>
            <p>
              This privacy boundary describes the converter’s own code. A browser extension, compromised device, operating-system backup tool, or file-sync folder has its own access rules and sits outside what a webpage can control.
            </p>
          </Section>

          <Section id="performance" title="Why some conversions are instant and others take time">
            <p>
              Containers and codecs are different things. Moving already-compatible H.264 and AAC streams from MP4 into MOV can often copy the streams without recompressing them. That operation is called remuxing and is very fast. Turning H.264 into VP8, Theora, MPEG-2, ProRes, or H.265 requires decoding every frame and encoding it again, so it takes longer.
            </p>
            <ul className="space-y-2">
              {[
                'The first FFmpeg conversion includes one-time engine startup and download work.',
                'Higher resolutions and longer durations require more CPU time and browser memory.',
                'Modern codecs generally compress better, but their encoders do more computation.',
                'FFmpeg jobs share a controlled execution queue to avoid several large WASM jobs exhausting memory at once.',
                'Lossless video formats can be hundreds of megabytes even for a short clip.',
              ].map((item) => (
                <li key={item} className="flex gap-2"><Check className="mt-1.5 size-4 shrink-0 text-foreground" /><span>{item}</span></li>
              ))}
            </ul>
            <p>
              Because the work is local, performance depends on your hardware and browser rather than on a remote server plan. A desktop with several fast cores will generally finish sooner than a low-memory phone.
            </p>
          </Section>

          <Section id="quality" title="Why 100% quality can still change file size">
            <p>
              “100%” controls encoder quality where that format supports a quality setting; it does not mean “reuse the original compressed bytes.” Two encoders can represent the same pixels with different filters, metadata, color profiles, and compression decisions, producing different file sizes without a visible change.
            </p>
            <p>
              PNG is lossless, so a quality percentage does not improve its pixels. When a PNG is converted to PNG at 100%, this site now preserves the original bytes instead of needlessly decoding and re-encoding them. Other same-format conversions may still need a new encode when you request a different quality or codec profile.
            </p>
            <p>
              Lossy formats such as JPEG, WebP, MP3, H.264, and H.265 trade some information for smaller files. Lossless and fixed-profile formats may ignore the queue’s quality setting because their codec rules are different.
            </p>
          </Section>

          <Section id="faq" title="Frequently asked questions">
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {[
                ['Are my files uploaded?', 'No. The app reads the files you select through the browser File API and does not send their contents to a conversion service.'],
                ['Why does Cloudflare appear in the connection?', 'Cloudflare Pages hosts the static website and codec assets. It delivers the tool; it does not perform the media conversion.'],
                ['Does the site keep a copy?', 'The app has no media database or account storage. The working copy exists in the page’s memory and temporary WASM filesystem for the current session. Your downloaded result remains on your device.'],
                ['Can I inspect this behavior?', 'Yes. Open your browser’s Network panel, convert a file, and watch the requests. You will see site assets and the FFmpeg engine when needed, not an upload containing your media.'],
                ['Why is the first conversion slower?', 'The browser may need to download, decompress, initialize, and compile the FFmpeg WebAssembly engine before the first specialist image, audio, or video job. Later jobs reuse it.'],
                ['Will it work on a phone?', 'Often, yes, but available memory and sustained CPU performance are lower on many phones. Small images and clips are a better fit than large lossless video jobs.'],
              ].map(([question, answer]) => (
                <details key={question} className="group p-4 open:bg-secondary/20">
                  <summary className="cursor-pointer list-none font-medium text-foreground marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {question}
                      <span className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{answer}</p>
                </details>
              ))}
            </div>
          </Section>

        </article>
      </main>

      <SiteFooter />
    </div>
  )
}

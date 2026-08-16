import { ImageConverter } from '@/components/ImageConverter'
import { VideoConverter } from '@/components/VideoConverter'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function App() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Card className="mb-8 border-0 shadow-none">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">convert.sethworks</CardTitle>
          <CardDescription className="text-balance">
            Convert images and videos <strong>entirely on your device</strong>. No uploads, no server, no tracking.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="image" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="image">Image</TabsTrigger>
          <TabsTrigger value="video">Video</TabsTrigger>
        </TabsList>
        <TabsContent value="image" className="mt-4">
          <ImageConverter />
        </TabsContent>
        <TabsContent value="video" className="mt-4">
          <VideoConverter />
        </TabsContent>
      </Tabs>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Runs 100% in your browser. Files never leave your device.
      </p>
    </div>
  )
}

export default App

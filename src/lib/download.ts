export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read image data.'))
    reader.readAsDataURL(blob)
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function copyImageBlob(blob: Blob, filename?: string) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Image copying is not supported by this browser.')
  }

  const canDirectWrite = typeof ClipboardItem.supports === 'function'
    ? ClipboardItem.supports(blob.type)
    : blob.type === 'image/png'

  const dataUrl = await blobToDataUrl(blob)
  const htmlContent = `<img src="${dataUrl}"${filename ? ` alt="${escapeHtml(filename)}"` : ''} />`
  const htmlBlob = new Blob([htmlContent], { type: 'text/html' })

  // If the browser supports writing this image format natively, write the original format and HTML
  if (canDirectWrite) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
          'text/html': htmlBlob,
        }),
      ])
      return
    } catch {
      try {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        return
      } catch {
        // Fall back to PNG raster representation below
      }
    }
  }

  // When direct writing of the format is not supported by the browser (such as image/gif in Chromium),
  // generate a PNG raster fallback for clipboard image consumers, paired with an HTML
  // representation embedding the original image format data URL.
  let pngBlob: Blob
  if (blob.type === 'image/png') {
    pngBlob = blob
  } else {
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare this image for the clipboard.')
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    pngBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Could not create a clipboard image.'))),
        'image/png'
      )
    )
  }

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'image/png': pngBlob,
      }),
    ])
  } catch {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': pngBlob,
      }),
    ])
  }
}

export function processAvatarFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file (PNG, JPG, WEBP).'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 256
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context is unavailable.'))
          return
        }
        const minSide = Math.min(img.width, img.height)
        const sx = (img.width - minSide) / 2
        const sy = (img.height - minSide) / 2
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => reject(new Error('Failed to load the selected image.'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read the file from your device.'))
    reader.readAsDataURL(file)
  })
}

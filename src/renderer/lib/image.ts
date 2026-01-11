export const processProfileImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 1. Basic validation: limit input size to 10MB to avoid browser crashes
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('Image is too large. Please select an image under 10MB.'))
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const SIZE = 128 // Standard avatar size
        canvas.width = SIZE
        canvas.height = SIZE

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        // 2. Perform center crop
        let sourceX = 0
        let sourceY = 0
        let sourceWidth = img.width
        let sourceHeight = img.height

        if (img.width > img.height) {
          sourceWidth = img.height
          sourceX = (img.width - img.height) / 2
        } else if (img.height > img.width) {
          sourceHeight = img.width
          sourceY = (img.height - img.width) / 2
        }

        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight, // Source slice
          0,
          0,
          SIZE,
          SIZE // Destination
        )

        // 3. Convert to small JPEG (0.6 quality is usually plenty for 128px)
        const base64 = canvas.toDataURL('image/jpeg', 0.6)
        resolve(base64)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = event.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

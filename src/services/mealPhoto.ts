import type { AnalyzeMealRequest, MealAnalysis } from '../shared/meal'

const ACCESS_KEY = 'hibi-access-code'
const MAX_SIDE = 1280

export class MealPhotoError extends Error {
  constructor(message: string, readonly needsAccessCode = false) {
    super(message)
  }
}

/** Kept per device and out of backups, since it unlocks the owner's API credit. */
export const getAccessCode = () => { try { return localStorage.getItem(ACCESS_KEY) ?? '' } catch { return '' } }
export const setAccessCode = (code: string) => { try { localStorage.setItem(ACCESS_KEY, code.trim()) } catch { /* private mode */ } }

/**
 * Downscales to at most 1280 px and re-encodes as JPEG. Phone photos are 3-12 MB; this keeps
 * uploads to a few hundred KB, under the function's 4.5 MB limit, and strips EXIF location data.
 */
export const prepareImage = async (file: File) => {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new MealPhotoError('This image format can’t be read here. Try a JPEG or PNG photo.')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
  return { previewUrl: dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' as const }
}

export const analyzeMeal = async (request: AnalyzeMealRequest, signal?: AbortSignal): Promise<MealAnalysis> => {
  if (!navigator.onLine) throw new MealPhotoError('You’re offline. Photo estimates need an internet connection.')
  const code = getAccessCode()
  if (!code) throw new MealPhotoError('Enter your access code to use photo estimates.', true)
  let response: Response
  try {
    // Functions live at the domain root, whatever base path the app is served under.
    response = await fetch('/api/analyze-meal', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hibi-access-code': code },
      body: JSON.stringify(request),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new MealPhotoError('Couldn’t reach the server. Check your connection and try again.')
  }
  const body = await response.json().catch(() => null) as (MealAnalysis & { error?: string }) | null
  if (!response.ok || !body) throw new MealPhotoError(body?.error ?? `The server returned an error (${response.status}).`, response.status === 401)
  return body
}

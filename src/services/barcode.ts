/** Retail product barcodes; Open Food Facts keys products by these. */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const

export interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}

interface NativeDetectorClass {
  new (options: { formats: string[] }): Detector
  getSupportedFormats(): Promise<string[]>
}

/**
 * Uses the browser's BarcodeDetector (Chrome on Android) when it supports retail formats,
 * otherwise lazy-loads the ZXing WebAssembly polyfill (iOS Safari, Firefox). The wasm is
 * served from our own origin instead of the library's default CDN.
 */
export const createDetector = async (): Promise<Detector> => {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (Native) {
    const supported = await Native.getSupportedFormats().catch(() => [] as string[])
    const formats = FORMATS.filter((format) => supported.includes(format))
    if (formats.length) return new Native({ formats })
  }
  const [{ BarcodeDetector, setZXingModuleOverrides }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) })
  return new BarcodeDetector({ formats: [...FORMATS] })
}

export const cameraErrorMessage = (error: unknown) => {
  if (!window.isSecureContext) return 'The camera only works over HTTPS. Type the barcode number instead.'
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError') return 'Camera access was blocked. Allow it in your browser settings, or type the barcode number.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device. Type the barcode number instead.'
  return 'The camera couldn’t start. Type the barcode number instead.'
}

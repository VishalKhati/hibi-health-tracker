import { z } from 'zod'

/**
 * What Gemini reads off a photo of a pack's nutrition table. Indian packs must print energy,
 * protein, carbohydrate and fat per 100 g or 100 ml (FSSAI Labelling and Display Regulations,
 * 2020); fibre is optional, so it may be missing.
 */
export const LabelReadingSchema = z.object({
  readable: z.boolean().describe('False when no nutrition table is visible, or it is too blurry or cut off to read.'),
  name: z.string().describe('Product name as printed on the pack, or an empty string if not visible.'),
  brand: z.string().describe('Brand as printed on the pack, or an empty string if not visible.'),
  unit: z.enum(['g', 'ml']).describe('Whether the values are per 100 g or per 100 ml.'),
  kcalPer100: z.number().describe('Energy in kcal per 100 g or 100 ml. Convert from kJ (÷ 4.184) if only kJ is printed.'),
  proteinPer100: z.number().describe('Protein in grams per 100 g or 100 ml.'),
  carbsPer100: z.number().describe('Total carbohydrate in grams per 100 g or 100 ml.'),
  fatPer100: z.number().describe('Total fat in grams per 100 g or 100 ml.'),
  fiberPer100: z.number().nullable().describe('Dietary fibre in grams per 100 g or 100 ml, or null if the label does not list it.'),
  servingSize: z.number().describe('Serving size in g or ml as printed on the label, or 0 if none is printed.'),
  note: z.string().describe('Anything you were unsure about, or an empty string.'),
})
export type LabelReading = z.infer<typeof LabelReadingSchema>

/** Request body for POST /api/read-label. */
export interface ReadLabelRequest {
  /** Base64 JPEG without the data: prefix. */
  image: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
}

/** A packaged product someone confirmed from its label, shared by barcode through /api/products/:code. */
export const SharedProductSchema = z.object({
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80),
  kcalPer100g: z.number().min(0).max(950),
  proteinPer100g: z.number().min(0).max(100),
  carbsPer100g: z.number().min(0).max(100).optional(),
  fatPer100g: z.number().min(0).max(100).optional(),
  fiberPer100g: z.number().min(0).max(100).optional(),
  servingGrams: z.number().positive().max(5000).optional(),
  servingLabel: z.string().trim().max(60).optional(),
})
export type SharedProduct = z.infer<typeof SharedProductSchema>

/** EAN-8 to GTIN-14; anything else isn't a product barcode. */
export const isBarcode = (code: string) => /^\d{6,14}$/.test(code)

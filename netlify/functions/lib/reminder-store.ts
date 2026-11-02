import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import webpush from 'web-push'

export const reminderStore = () => getStore({ name: 'hibi-reminders', consistency: 'strong' })

/** One record per push subscription; the endpoint is hashed so keys don't expose it. */
export const keyFor = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex')

export const vapidReady = () => {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  // Push services require an https: or mailto: contact. Netlify sets URL to the site's address,
  // which is plain http during local development.
  const siteUrl = process.env.URL?.startsWith('https://') ? process.env.URL : 'https://hibi-vishal.netlify.app'
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? siteUrl, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  return true
}

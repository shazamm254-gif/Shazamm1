import { ApiError } from './anthropic.js'

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search'
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos'

function requireKey() {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) {
    throw new ApiError(400, 'invalid_key', 'Missing YOUTUBE_API_KEY — add it to your .env file.')
  }
  return key
}

// Translate Google's error envelope into our friendly ApiError codes.
async function handleYouTubeError(resp) {
  let body = {}
  try {
    body = await resp.json()
  } catch {
    /* ignore */
  }
  const reason = body?.error?.errors?.[0]?.reason || ''
  const msg = body?.error?.message || `YouTube API error ${resp.status}`

  if (resp.status === 403 && /quota/i.test(reason + msg)) {
    throw new ApiError(403, 'quota_exceeded', 'YouTube daily quota exceeded. Try again tomorrow or use a different key.')
  }
  if (resp.status === 400 && /keyInvalid|badRequest/i.test(reason)) {
    throw new ApiError(400, 'invalid_key', 'YouTube rejected the API key. Check YOUTUBE_API_KEY.')
  }
  if (resp.status === 403) {
    throw new ApiError(403, 'invalid_key', `YouTube access denied: ${msg}`)
  }
  throw new ApiError(resp.status, 'youtube_error', msg)
}

/**
 * search.list — recent short, high-view-count videos for a niche.
 * Cost ~100 quota units. Returns an array of videoIds (max 25).
 */
export async function searchShorts(niche, { region, maxResults = 25 } = {}) {
  const key = requireKey()
  const publishedAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoDuration: 'short',
    order: 'viewCount',
    q: niche,
    publishedAfter,
    maxResults: String(Math.min(maxResults, 25)), // cost guard: cap at 25
    key,
  })
  if (region) params.set('regionCode', region)

  const resp = await fetch(`${SEARCH_URL}?${params}`)
  if (!resp.ok) await handleYouTubeError(resp)

  const data = await resp.json()
  const ids = (data.items || [])
    .map((it) => it.id?.videoId)
    .filter(Boolean)
  return ids
}

/**
 * videos.list — statistics + snippet for the given ids. Cost ~1 unit.
 */
export async function fetchVideoStats(ids) {
  if (!ids.length) return []
  const key = requireKey()
  const params = new URLSearchParams({
    part: 'statistics,snippet',
    id: ids.join(','),
    key,
  })

  const resp = await fetch(`${VIDEOS_URL}?${params}`)
  if (!resp.ok) await handleYouTubeError(resp)

  const data = await resp.json()
  return data.items || []
}

/**
 * Compute virality signals for each video and return the top `limit`, sorted
 * by views-per-day. Each entry is a compact object safe to send to Claude.
 */
export function rankByVirality(items, limit = 10) {
  const now = Date.now()
  const scored = items.map((v) => {
    const stats = v.statistics || {}
    const views = Number(stats.viewCount || 0)
    const likes = Number(stats.likeCount || 0)
    const comments = Number(stats.commentCount || 0)
    const published = new Date(v.snippet?.publishedAt || now).getTime()
    const daysSince = Math.max((now - published) / (1000 * 60 * 60 * 24), 1)

    return {
      videoId: v.id,
      title: v.snippet?.title || '',
      channel: v.snippet?.channelTitle || '',
      publishedAt: v.snippet?.publishedAt || null,
      views,
      likes,
      comments,
      daysSince: Math.round(daysSince),
      viewsPerDay: Math.round(views / daysSince),
      likeToView: views ? +(likes / views).toFixed(4) : 0,
      commentToView: views ? +(comments / views).toFixed(4) : 0,
    }
  })

  scored.sort((a, b) => b.viewsPerDay - a.viewsPerDay)
  return scored.slice(0, limit)
}

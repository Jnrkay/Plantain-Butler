// Everything Butler needs from audio, images, video and PDFs — prepared on the phone so
// uploads stay small (the server accepts ~4 MB per request).
import { accessToken } from './supabase'

const uid = () => Math.random().toString(36).slice(2, 9)
const readAsDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob) })
const b64 = async (blob) => (await readAsDataURL(blob)).split(',')[1]
export const fmtDuration = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round((s || 0) % 60)).padStart(2, '0')}`

export function kindOf(file) {
  const t = file.type || ''
  if (t.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name)) return 'image'
  if (t.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(file.name)) return 'video'
  if (t.startsWith('audio/') || /\.(m4a|mp3|wav|aac|ogg|opus|amr)$/i.test(file.name)) return 'audio'
  if (t === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf'
  return null
}

/* ---------- images ---------- */
const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })
function drawScaled(source, w, h, max, quality) {
  const s = Math.min(1, max / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s))
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}
export async function prepareImage(file, max = 1280) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const full = drawScaled(img, img.naturalWidth, img.naturalHeight, max, 0.8)
    return {
      blocks: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: full.split(',')[1] } }],
      thumb: drawScaled(img, img.naturalWidth, img.naturalHeight, 160, 0.6),
    }
  } finally { URL.revokeObjectURL(url) }
}

/* ---------- audio: decode anything the phone can play → 16 kHz mono WAV chunks ---------- */
const RATE = 16000
const CHUNK_SECONDS = 55
function wavFrom(samples) {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, RATE, true)
  v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) { const x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true) }
  return new Blob([buf], { type: 'audio/wav' })
}
export async function audioToWavChunks(blob) {
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC()
  let decoded
  try {
    const data = await blob.arrayBuffer()
    decoded = await new Promise((res, rej) => { const p = ctx.decodeAudioData(data, res, rej); if (p?.then) p.then(res, rej) })
  } finally { ctx.close?.() }
  const duration = decoded.duration
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext
  const off = new Off(1, Math.max(1, Math.ceil(duration * RATE)), RATE)
  const src = off.createBufferSource()
  src.buffer = decoded; src.connect(off.destination); src.start(0)
  const mono = (await off.startRendering()).getChannelData(0)
  const chunks = []
  for (let i = 0; i < mono.length; i += CHUNK_SECONDS * RATE) chunks.push(wavFrom(mono.subarray(i, i + CHUNK_SECONDS * RATE)))
  return { chunks, duration }
}

let transcriptionAvailable = null
export async function voiceNotesAvailable() {
  if (transcriptionAvailable !== null) return transcriptionAvailable
  try {
    const token = await accessToken()
    const r = await fetch('/api/transcribe', { headers: { Authorization: `Bearer ${token}` } })
    transcriptionAvailable = r.ok ? !!(await r.json()).configured : false
  } catch { transcriptionAvailable = false }
  return transcriptionAvailable
}

export async function transcribe(blob) {
  const { chunks, duration } = await audioToWavChunks(blob)
  if (duration < 0.4) return { text: '', duration }
  const token = await accessToken()
  const parts = []
  for (const c of chunks) {
    const r = await fetch('/api/transcribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ audio: await b64(c), mime: 'audio/wav' }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { if (r.status === 501) transcriptionAvailable = false; throw new Error(d.error || `Transcription failed (${r.status})`) }
    if (d.text) parts.push(d.text)
  }
  return { text: parts.join(' ').trim(), duration }
}

/* ---------- video: a few still frames + the soundtrack ---------- */
export async function prepareVideo(file, frames = 6) {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  Object.assign(video, { src: url, muted: true, playsInline: true, preload: 'auto' })
  video.setAttribute('playsinline', '')
  try {
    await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = () => rej(new Error('This phone can’t open that video.')); setTimeout(() => rej(new Error('That video took too long to open.')), 15000) })
    // iOS only paints frames once playback has started
    try { await video.play(); video.pause() } catch { /* fine */ }
    const duration = video.duration || 0
    const times = Array.from({ length: frames }, (_, i) => Math.min(duration - 0.05, (duration * (i + 0.5)) / frames))
    const shots = []
    for (const t of times) {
      await new Promise((res) => { const done = () => { video.removeEventListener('seeked', done); res() }; video.addEventListener('seeked', done); video.currentTime = Math.max(0, t); setTimeout(done, 2500) })
      shots.push(drawScaled(video, video.videoWidth, video.videoHeight, 640, 0.7))
    }
    let transcript = '', audioNote = ''
    try {
      if (await voiceNotesAvailable()) transcript = (await transcribe(file)).text
      else audioNote = '(The video’s sound wasn’t transcribed — voice transcription isn’t switched on.)'
    } catch (e) { audioNote = `(Couldn’t read the video’s sound: ${e.message})` }
    const blocks = [
      ...shots.map((s) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: s.split(',')[1] } })),
      { type: 'text', text: `[Video "${file.name}", ${fmtDuration(duration)} long — ${shots.length} still frames above, in order.]${transcript ? `\nWhat's said in the video: "${transcript}"` : audioNote ? `\n${audioNote}` : '\n(No speech in the video.)'}` },
    ]
    return { blocks, thumb: drawScaled(video, video.videoWidth, video.videoHeight, 160, 0.6), duration, transcript }
  } finally { URL.revokeObjectURL(url) }
}

/* ---------- audio files ---------- */
export async function prepareAudio(file) {
  if (!(await voiceNotesAvailable())) throw new Error('Audio needs voice transcription switched on.')
  const { text, duration } = await transcribe(file)
  return { blocks: [{ type: 'text', text: `[Audio "${file.name}", ${fmtDuration(duration)}] Transcript: "${text || '(no speech found)'}"` }], duration, transcript: text }
}

/* ---------- PDFs ---------- */
export async function preparePdf(file) {
  if (file.size > 3 * 1024 * 1024) throw new Error('PDFs need to be under 3 MB.')
  return { blocks: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await b64(file) } }] }
}

export async function prepareFile(file) {
  const kind = kindOf(file)
  const base = { id: uid(), kind, name: file.name || kind }
  if (kind === 'image') return { ...base, ...(await prepareImage(file)) }
  if (kind === 'video') return { ...base, ...(await prepareVideo(file)) }
  if (kind === 'audio') return { ...base, ...(await prepareAudio(file)) }
  if (kind === 'pdf') return { ...base, ...(await preparePdf(file)) }
  throw new Error('Butler can read photos, short videos, audio and PDFs.')
}

/* ---------- voice note recorder ---------- */
export const MAX_VOICE_SECONDS = 120
export async function startRecorder(onLevel) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || ''
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const parts = []
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
  // Live level for the waveform
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC()
  const analyser = ctx.createAnalyser(); analyser.fftSize = 256
  ctx.createMediaStreamSource(stream).connect(analyser)
  const buf = new Uint8Array(analyser.frequencyBinCount)
  let raf
  const tick = () => { analyser.getByteTimeDomainData(buf); let peak = 0; for (const x of buf) peak = Math.max(peak, Math.abs(x - 128)); onLevel?.(Math.min(1, peak / 64)); raf = requestAnimationFrame(tick) }
  tick()
  rec.start(250)
  const started = Date.now()
  const cleanup = () => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ctx.close?.() }
  return {
    started,
    stop: () => new Promise((res) => { rec.onstop = () => { cleanup(); res(new Blob(parts, { type: rec.mimeType || mime || 'audio/mp4' })) }; rec.stop() }),
    cancel: () => { rec.onstop = cleanup; try { rec.stop() } catch { cleanup() } },
  }
}

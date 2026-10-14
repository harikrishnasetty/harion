import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'resources')
mkdirSync(outDir, { recursive: true })

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const lerp = (a, b, t) => a + (b - a) * t

function blend(buf, size, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= size || y >= size || a <= 0) return
  const i = (y * size + x) * 4
  const sa = a / 255
  const da = buf[i + 3] / 255
  const outA = sa + da * (1 - sa)
  if (outA <= 0) return
  buf[i] = Math.round((r * sa + buf[i] * da * (1 - sa)) / outA)
  buf[i + 1] = Math.round((g * sa + buf[i + 1] * da * (1 - sa)) / outA)
  buf[i + 2] = Math.round((b * sa + buf[i + 2] * da * (1 - sa)) / outA)
  buf[i + 3] = Math.round(outA * 255)
}

function drawOrb(buf, size, cx, cy, R, glow = 1) {
  const startX = Math.max(0, Math.floor(cx - R * 1.7))
  const endX = Math.min(size - 1, Math.ceil(cx + R * 1.7))
  const startY = Math.max(0, Math.floor(cy - R * 1.7))
  const endY = Math.min(size - 1, Math.ceil(cy + R * 1.7))
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const d = Math.sqrt(dx * dx + dy * dy) / R
      if (d > 1.7) continue
      let r, g, b, a
      if (d <= 1) {
        const t = Math.min(1, d)
        r = lerp(34, 168, t)
        g = lerp(211, 85, t)
        b = lerp(238, 247, t)
        a = 255
        if (d > 0.66) {
          const k = (d - 0.66) / 0.34
          r = lerp(r, 236, k)
          g = lerp(g, 254, k)
          b = lerp(b, 255, k)
        }
        const sx = (dx + 0.34 * R) / (0.52 * R)
        const sy = (dy + 0.34 * R) / (0.52 * R)
        const sd = Math.sqrt(sx * sx + sy * sy)
        if (sd < 1) {
          const s = (1 - sd) * 0.5
          r = lerp(r, 255, s)
          g = lerp(g, 255, s)
          b = lerp(b, 255, s)
        }
      } else {
        const k = (d - 1) / 0.7
        const ga = Math.pow(1 - k, 2) * 110 * glow
        r = lerp(34, 168, 0.72)
        g = lerp(211, 85, 0.72)
        b = lerp(238, 247, 0.72)
        a = ga
      }
      blend(buf, size, x, y, r, g, b, a)
    }
  }
}

function drawTile(buf, size) {
  const inset = size * 0.06
  const radius = size * 0.24
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const cx2 = Math.min(Math.max(px, inset + radius), size - inset - radius)
      const cy2 = Math.min(Math.max(py, inset + radius), size - inset - radius)
      const dist = Math.hypot(px - cx2, py - cy2)
      if (dist > radius) continue
      const t = py / size
      let r = lerp(13, 6, t)
      let g = lerp(16, 8, t)
      let b = lerp(30, 18, t)
      if (dist > radius - size * 0.012) {
        const k = (dist - (radius - size * 0.012)) / (size * 0.012)
        r = lerp(r, 34, k)
        g = lerp(g, 211, k)
        b = lerp(b, 238, k)
      }
      blend(buf, size, x, y, r, g, b, 255)
    }
  }
}

function makeIcon(size) {
  const buf = Buffer.alloc(size * size * 4)
  drawTile(buf, size)
  drawOrb(buf, size, size * 0.5, size * 0.5, size * 0.28, 1)
  return encodePng(size, size, buf)
}

function makeTray(size) {
  const buf = Buffer.alloc(size * size * 4)
  drawOrb(buf, size, size * 0.5, size * 0.5, size * 0.36, 0.9)
  return encodePng(size, size, buf)
}

writeFileSync(join(outDir, 'icon.png'), makeIcon(256))
writeFileSync(join(outDir, 'tray.png'), makeTray(32))
writeFileSync(join(outDir, 'tray@2x.png'), makeTray(64))
console.log('Icons written to', outDir)

const QR_VERSION = 5
const QR_SIZE = 37
const QR_DATA_CODEWORDS = 108
const QR_EC_CODEWORDS = 26
const QR_FORMAT_L_MASK_0 = '111011111000100'

function nowId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`
}

function playerId() {
  return nowId('p')
}

function gfMul(a, b) {
  let result = 0
  while (b > 0) {
    if (b & 1) result ^= a
    a <<= 1
    if (a & 0x100) a ^= 0x11d
    b >>= 1
  }
  return result
}

function gfPow(a, n) {
  let result = 1
  for (let i = 0; i < n; i += 1) result = gfMul(result, a)
  return result
}

function polyMul(a, b) {
  const result = Array(a.length + b.length - 1).fill(0)
  a.forEach((av, ai) => {
    b.forEach((bv, bi) => {
      result[ai + bi] ^= gfMul(av, bv)
    })
  })
  return result
}

function rsGenerator(degree) {
  let poly = [1]
  for (let i = 0; i < degree; i += 1) {
    poly = polyMul(poly, [1, gfPow(2, i)])
  }
  return poly
}

function rsEncode(data, degree) {
  const gen = rsGenerator(degree)
  const result = data.concat(Array(degree).fill(0))
  for (let i = 0; i < data.length; i += 1) {
    const factor = result[i]
    if (!factor) continue
    for (let j = 0; j < gen.length; j += 1) {
      result[i + j] ^= gfMul(gen[j], factor)
    }
  }
  return result.slice(data.length)
}

function pushBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1)
}

function qrDataCodewords(text) {
  const bytes = []
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes.push(code)
  }
  const bits = []
  pushBits(bits, 4, 4)
  pushBits(bits, bytes.length, 8)
  bytes.forEach((byte) => pushBits(bits, byte, 8))
  const maxBits = QR_DATA_CODEWORDS * 8
  const terminator = Math.min(4, maxBits - bits.length)
  for (let i = 0; i < terminator; i += 1) bits.push(0)
  while (bits.length % 8) bits.push(0)

  const data = []
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j]
    data.push(value)
  }
  let pad = 0
  while (data.length < QR_DATA_CODEWORDS) {
    data.push(pad % 2 ? 0x11 : 0xec)
    pad += 1
  }
  return data.slice(0, QR_DATA_CODEWORDS)
}

function makeQrMatrix(text) {
  const size = QR_SIZE
  const modules = Array.from({ length: size }, () => Array(size).fill(false))
  const reserved = Array.from({ length: size }, () => Array(size).fill(false))

  function set(row, col, value, reserve) {
    if (row < 0 || col < 0 || row >= size || col >= size) return
    modules[row][col] = !!value
    if (reserve) reserved[row][col] = true
  }

  function finder(row, col) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = row + r
        const cc = col + c
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6
        const dark = inside && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
        set(rr, cc, dark, true)
      }
    }
  }

  finder(0, 0)
  finder(0, size - 7)
  finder(size - 7, 0)

  for (let i = 8; i < size - 8; i += 1) {
    set(6, i, i % 2 === 0, true)
    set(i, 6, i % 2 === 0, true)
  }

  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1
      set(30 + r, 30 + c, dark, true)
    }
  }

  set(8, 29, true, true)
  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      reserved[8][i] = true
      reserved[i][8] = true
    }
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true
    reserved[size - 1 - i][8] = true
  }

  const data = qrDataCodewords(text)
  const codewords = data.concat(rsEncode(data, QR_EC_CODEWORDS))
  const bitStream = []
  codewords.forEach((byte) => pushBits(bitStream, byte, 8))

  let bitIndex = 0
  let upward = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1
    for (let rowStep = 0; rowStep < size; rowStep += 1) {
      const row = upward ? size - 1 - rowStep : rowStep
      for (let offset = 0; offset < 2; offset += 1) {
        const cc = col - offset
        if (reserved[row][cc]) continue
        const bit = bitStream[bitIndex] || 0
        modules[row][cc] = !!(bit ^ (((row + cc) % 2 === 0) ? 1 : 0))
        bitIndex += 1
      }
    }
    upward = !upward
  }

  const format = QR_FORMAT_L_MASK_0
  const formatA = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]
  const formatB = [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]]
  for (let i = 0; i < 15; i += 1) {
    const bit = format[i] === '1'
    set(formatA[i][0], formatA[i][1], bit, true)
    set(formatB[i][0], formatB[i][1], bit, true)
  }
  return modules
}

module.exports = {
  makeQrMatrix
}

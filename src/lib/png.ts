import "server-only";
import { inflateSync } from "node:zlib";

// 안전 영역 검사용 최소 PNG 디코더 (satori 출력: 8비트 RGBA/RGB, 인터레이스 없음). 그 밖의 형식은 추측하지 않고 실패한다.
export function decodePng(buf: Buffer): { w: number; h: number; ch: number; px: Buffer } {
  if (!buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) throw new Error("PNG 아님");
  let off = 8, w = 0, h = 0, ch = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString("latin1", off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      const depth = data[8], color = data[9], interlace = data[12];
      if (depth !== 8 || interlace !== 0 || (color !== 6 && color !== 2)) throw new Error(`지원 안 하는 PNG (depth ${depth}, color ${color}, interlace ${interlace})`);
      ch = color === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch, px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[dst + x - ch] : 0, b = y > 0 ? px[dst - stride + x] : 0, c = x >= ch && y > 0 ? px[dst - stride + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (f !== 0) throw new Error(`모르는 PNG 필터 ${f}`);
      px[dst + x] = v & 255;
    }
  }
  return { w, h, ch, px };
}

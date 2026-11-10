/** Arquivo OGG mínimo (só cabeçalhos e uma página final) para testar a leitura de duração. */
function oggPage(input: { granule: bigint; headerType: number; data: Uint8Array; sequence: number }) {
  const header = new Uint8Array(27 + 1);
  const view = new DataView(header.buffer);
  header.set([0x4f, 0x67, 0x67, 0x53], 0);
  header[4] = 0;
  header[5] = input.headerType;
  view.setBigInt64(6, input.granule, true);
  view.setUint32(14, 1, true);
  view.setUint32(18, input.sequence, true);
  header[26] = 1;
  header[27] = input.data.length;
  const page = new Uint8Array(header.length + input.data.length);
  page.set(header, 0);
  page.set(input.data, header.length);
  return page;
}

const bytes = (text: string) => Uint8Array.from(text, (character) => character.charCodeAt(0));

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

export function opusOggFixture(seconds: number, preSkip = 312) {
  const head = new Uint8Array(19);
  head.set(bytes("OpusHead"), 0);
  head[8] = 1;
  head[9] = 1;
  new DataView(head.buffer).setUint16(10, preSkip, true);
  new DataView(head.buffer).setUint32(12, 16_000, true);
  return concat([
    oggPage({ granule: BigInt(0), headerType: 2, data: head, sequence: 0 }),
    oggPage({ granule: BigInt(0), headerType: 0, data: bytes("OpusTags"), sequence: 1 }),
    oggPage({ granule: BigInt(Math.round(seconds * 48_000) + preSkip), headerType: 4, data: new Uint8Array(40), sequence: 2 }),
  ]);
}

export function vorbisOggFixture(seconds: number, sampleRate = 44_100) {
  const id = new Uint8Array(30);
  id.set([0x01, ...bytes("vorbis")], 0);
  new DataView(id.buffer).setUint32(12, sampleRate, true);
  return concat([
    oggPage({ granule: BigInt(0), headerType: 2, data: id, sequence: 0 }),
    oggPage({ granule: BigInt(Math.round(seconds * sampleRate)), headerType: 4, data: new Uint8Array(40), sequence: 1 }),
  ]);
}

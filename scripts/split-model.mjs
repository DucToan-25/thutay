import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCE = fileURLToPath(new URL('../../flower_bouquet.glb', import.meta.url));
const DEFAULT_OUTPUT = fileURLToPath(new URL('../dist/assets/models/', import.meta.url));
const HOST_FILE_LIMIT = 25 * 1024 * 1024;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGlb(bytes) {
  assert(bytes.length >= 20, 'File GLB quá ngắn.');
  assert(bytes.readUInt32LE(0) === 0x46546c67, 'File không có định dạng GLB.');
  assert(bytes.readUInt32LE(4) === 2, 'Chỉ hỗ trợ GLB phiên bản 2.');
  assert(bytes.readUInt32LE(8) === bytes.length, 'Độ dài GLB không khớp với header.');
  let json;
  let binary;
  for (let offset = 12; offset < bytes.length;) {
    assert(offset + 8 <= bytes.length, 'Header chunk GLB bị thiếu.');
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    assert(start + length <= bytes.length, 'Chunk GLB vượt quá độ dài file.');
    const chunk = bytes.subarray(start, start + length);
    if (type === 0x4e4f534a) {
      assert(!json, 'GLB có nhiều hơn một chunk JSON.');
      json = JSON.parse(chunk.toString('utf8').trim());
    } else if (type === 0x004e4942) {
      assert(!binary, 'GLB có nhiều hơn một chunk BIN.');
      binary = chunk;
    } else {
      throw new Error('GLB có chunk phụ; cần kiểm tra trước khi chuyển đổi.');
    }
    offset = start + length;
  }
  assert(json && binary, 'GLB cần có đủ chunk JSON và BIN.');
  assert(json.buffers?.length === 1 && !json.buffers[0].uri, 'Mô hình cần một buffer nhúng.');
  assert(json.buffers[0].byteLength <= binary.length, 'Buffer BIN bị thiếu dữ liệu.');
  return { json, binary };
}

function unchangedScene(json) {
  const { buffers, bufferViews, images, ...scene } = json;
  return JSON.stringify(scene);
}

async function writeVerified(path, bytes) {
  assert(bytes.length < HOST_FILE_LIMIT, `File vượt giới hạn 25 MiB: ${path}`);
  await writeFile(path, bytes);
  assert(sha256(await readFile(path)) === sha256(bytes), `Kiểm tra SHA-256 không khớp: ${path}`);
}

/** Split the original supplied GLB without re-encoding any geometry or texture. */
export async function splitModel(sourcePath = DEFAULT_SOURCE, outputDirectory = DEFAULT_OUTPUT) {
  const source = resolve(sourcePath);
  const output = resolve(outputDirectory);
  const originalBytes = await readFile(source);
  const originalHash = sha256(originalBytes);
  const { json: original, binary } = readGlb(originalBytes);
  assert(Array.isArray(original.images) && original.images.length > 0, 'Mô hình cần có ảnh nhúng.');
  assert(Array.isArray(original.bufferViews), 'GLB thiếu bufferViews.');
  const imageViews = new Set(original.images.map((image) => image.bufferView));
  assert([...imageViews].every(Number.isInteger), 'Chỉ hỗ trợ ảnh nhúng trong bufferView.');
  const firstImageView = Math.min(...imageViews);
  assert(firstImageView > 0, 'Cần có hình học đứng trước các ảnh nhúng.');
  // The supplied file places three geometry views first and all JPEG views after.
  // Keep their indices and byte offsets, so every accessor remains exactly the same.
  assert(original.bufferViews.every((view, index) => (index < firstImageView) !== imageViews.has(index)),
    'Các bufferView hình học và ảnh không liên tiếp; cần kiểm tra mô hình mới.');
  const geometryViews = original.bufferViews.slice(0, firstImageView);
  assert(geometryViews.every((view) => view.buffer === 0), 'Hình học dùng buffer không hỗ trợ.');
  const geometryLength = Math.max(...geometryViews.map((view) => (view.byteOffset || 0) + view.byteLength));
  assert(geometryLength <= binary.length, 'Buffer hình học bị thiếu dữ liệu.');
  const geometry = binary.subarray(0, geometryLength);
  const transformed = structuredClone(original);
  transformed.buffers = [{ ...original.buffers[0], byteLength: geometryLength, uri: 'flower_bouquet.bin' }];
  transformed.bufferViews = structuredClone(geometryViews);
  const textures = original.images.map((image, index) => {
    assert(image.mimeType === 'image/jpeg', 'Mô hình có ảnh khác JPEG; cần kiểm tra trước khi chuyển đổi.');
    const view = original.bufferViews[image.bufferView];
    assert(view && view.buffer === 0, 'Ảnh tham chiếu bufferView không hỗ trợ.');
    const offset = view.byteOffset || 0;
    assert(offset >= geometryLength && offset + view.byteLength <= binary.length, 'Dữ liệu ảnh GLB không hợp lệ.');
    const bytes = binary.subarray(offset, offset + view.byteLength);
    assert(bytes[0] === 0xff && bytes[1] === 0xd8, 'Ảnh nhúng không có header JPEG.');
    const name = `flower-${String(index + 1).padStart(2, '0')}.jpg`;
    const { bufferView, ...imageMetadata } = image;
    transformed.images[index] = { ...imageMetadata, uri: `textures/${name}` };
    return { name, bytes };
  });
  assert(unchangedScene(original) === unchangedScene(transformed), 'Dữ liệu cảnh đã thay đổi ngoài phạm vi cho phép.');
  await mkdir(resolve(output, 'textures'), { recursive: true });
  const geometryPath = resolve(output, 'flower_bouquet.bin');
  await writeVerified(geometryPath, geometry);
  for (const texture of textures) {
    await writeVerified(resolve(output, 'textures', texture.name), texture.bytes);
  }
  const gltfPath = resolve(output, 'flower_bouquet.gltf');
  await writeVerified(gltfPath, Buffer.from(`${JSON.stringify(transformed)}\n`, 'utf8'));
  const saved = JSON.parse(await readFile(gltfPath, 'utf8'));
  assert(unchangedScene(original) === unchangedScene(saved), 'JSON cảnh đã thay đổi sau khi lưu.');
  assert(JSON.stringify(saved.buffers) === JSON.stringify(transformed.buffers)
    && JSON.stringify(saved.bufferViews) === JSON.stringify(geometryViews)
    && JSON.stringify(saved.images) === JSON.stringify(transformed.images), 'JSON tài nguyên không khớp.');
  const metadata = original.asset?.extras || {};
  const license = metadata.license?.startsWith('CC-BY-4.0')
    ? 'Creative Commons Attribution 4.0 International (CC BY 4.0)\nhttps://creativecommons.org/licenses/by/4.0/'
    : (metadata.license || 'Không có thông tin giấy phép trong metadata của mô hình.');
  const credits = `${metadata.title || 'Mô hình bó hoa'}\n\nTác giả: ${metadata.author || 'Không có metadata tác giả.'}\nNguồn: ${metadata.source || 'Không có metadata nguồn.'}\nGiấy phép: ${license}\n\nThông tin tác giả, nguồn và giấy phép được lấy từ asset.extras của GLB gốc.\n\nBản chuyển đổi trong thư mục này chỉ tách GLB thành GLTF, BIN và JPEG\nđể mỗi file nhỏ hơn giới hạn 25 MiB của dịch vụ lưu trữ. Hình học và\nảnh JPEG được giữ nguyên từng byte, không nén lại, không giảm chất lượng.\nCấu trúc cảnh, vật liệu, màu sắc, UV và phép biến đổi không thay đổi.\n\nSHA-256 của GLB gốc: ${originalHash}\nSHA-256 của hình học BIN: ${sha256(geometry)}\n`;
  await writeVerified(resolve(output, 'CREDITS.txt'), Buffer.from(credits, 'utf8'));
  assert(sha256(await readFile(source)) === originalHash, 'File GLB nguồn đã thay đổi.');
  // Remove only the verified copy in this explicit output directory, never the source.
  const copiedGlb = resolve(output, 'flower_bouquet.glb');
  if (copiedGlb !== source) {
    assert(dirname(copiedGlb) === output, 'Đường dẫn bản GLB sao chép vượt ngoài thư mục đích.');
    let copiedBytes;
    try { copiedBytes = await readFile(copiedGlb); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (copiedBytes) {
      assert(sha256(copiedBytes) === originalHash, 'Bản GLB trong thư mục đích khác nguồn; không xóa.');
      await unlink(copiedGlb);
    }
  }
  return {
    gltfPath,
    originalBytes: originalBytes.length,
    geometryBytes: geometry.length,
    textureBytes: textures.reduce((sum, texture) => sum + texture.bytes.length, 0),
    textureCount: textures.length,
    largestFileBytes: Math.max(geometry.length, ...textures.map((texture) => texture.bytes.length)),
    originalHash,
    geometryHash: sha256(geometry),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await splitModel(process.argv[2] || DEFAULT_SOURCE);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Không thể tách mô hình: ${error.message}`);
    process.exitCode = 1;
  }
}

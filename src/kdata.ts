import { crc32 } from 'crc';
import lzf from 'lzfjs';

export const KDATA_SIG_FLAG = 0x4b44;

export enum KDATA_HASH_FLAG {
    None = 0x4e,
    Crc32 = 0x43,
}
export enum KDATA_COMPRESS_FLAG {
    None = 0x4e,
    Lzf = 0x46,
    Lzo = 0x4c,
}

export declare interface KDataWriteOptions {
    hash?: KDATA_HASH_FLAG;
    compress?: KDATA_COMPRESS_FLAG;
}

export declare interface KDataReadOptions {
    strict?: boolean;
}

export class KDataReadError extends Error {}

export const isKData = (buffer: ArrayBuffer | Buffer) => {
    buffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
    const dataView = new DataView(buffer);
    const sig = dataView.getUint16(2, true);
    return sig === KDATA_SIG_FLAG;
};

/**
 * 把一段数据转换为Kdata格式
 * @param payload
 * @param options
 * @returns
 */
export const writeKData = (payload: ArrayBuffer, options: KDataWriteOptions = {}) => {
    const { hash = KDATA_HASH_FLAG.Crc32, compress = KDATA_COMPRESS_FLAG.Lzf } = options;

    const originLength = payload.byteLength;
    if (options.compress === KDATA_COMPRESS_FLAG.Lzf) {
        payload = lzf.compress(payload);
    }
    const dataLength = payload.byteLength;
    const crc = hash === KDATA_HASH_FLAG.Crc32 ? crc32(payload) : 0;
    const result = new ArrayBuffer(16 + dataLength);
    const dataView = new DataView(result);

    dataView.setUint8(0, hash);
    dataView.setUint8(1, compress);
    dataView.setUint16(2, KDATA_SIG_FLAG, true);
    dataView.setUint32(4, crc, true);
    dataView.setUint32(8, originLength, true);
    dataView.setUint32(12, dataLength, true);

    new Uint8Array(result).set(new Uint8Array(payload), 16);
    return result;
};

/**
 * 读Kdata
 * @param payload
 * @param options
 * @returns
 */
export const readKData = (buffer: ArrayBuffer | Buffer, options: KDataReadOptions = {}) => {
    const { strict = false } = options;
    buffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
    const dataView = new DataView(buffer);

    const hash = dataView.getUint8(0) as KDATA_HASH_FLAG;
    const compress = dataView.getUint8(1) as KDATA_COMPRESS_FLAG;
    const sig = dataView.getUint16(2, true);

    if (sig !== KDATA_SIG_FLAG && strict) {
        throw new KDataReadError('KData signature not match');
    }

    const crc = dataView.getUint32(4, true);
    const originLength = dataView.getUint32(8, true);
    const dataLength = dataView.getUint32(12, true);
    const _payload = buffer.slice(16, 16 + dataLength);

    if (hash === KDATA_HASH_FLAG.Crc32 && crc !== crc32(_payload) && strict) {
        throw new KDataReadError('KData crc32 not match');
    }

    const payload = compress === KDATA_COMPRESS_FLAG.Lzf ? lzf.decompress(_payload) : _payload;

    return {
        hash,
        compress,
        sig,
        crc,
        originLength,
        dataLength,
        payload,
    };
};

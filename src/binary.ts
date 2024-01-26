import { DictType, mapTransform } from './utils/map-transform';
import lodash from 'lodash';

export const BINARY_SIG_FLAG = BigInt('0x206174614461754c');

export const isBinary = (buffer: ArrayBuffer | Buffer): boolean => {
    buffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
    const dataView = new DataView(buffer);
    const sig = dataView.getBigUint64(0, true);
    return sig === BINARY_SIG_FLAG;
};

declare type BinarySupportType = number | string | boolean | null | undefined | any[] | Record<string, any> | Map<any, any>;

export declare interface BinaryWriteOptions {
    sig: bigint;
    version: number;
    compress: boolean;
    hash: boolean;
}

export declare interface BinaryPayloadWriteOptions {
    seen: Set<any>;
    buffer: ArrayBuffer;
    offset: number;
}

export declare interface BinaryReadOptions {
    sig?: bigint;
    strict?: boolean;
    dictType?: DictType;
}

export declare interface BinaryPayloadReadOptions {
    offset: number;
}

export enum BinaryLuaType {
    Number,
    Boolean,
    String,
    Nil,
    Table,
}

const stringEncoder = new TextEncoder();
const stringDecoder = new TextDecoder();

export const getTargetSize = (target: BinarySupportType, seen?: Set<any>) => {
    seen = seen || new Set();
    if (seen.has(target)) {
        throw new Error('Circular reference detected', { cause: target });
    }
    let result = 1;
    if (typeof target === 'number') {
        result += 8;
    } else if (typeof target === 'boolean') {
        result += 1;
    } else if (typeof target === 'string') {
        result += stringEncoder.encode(target).length + 1;
    } else if (target === null || target === undefined) {
        result += 0;
    } else if (lodash.isArray(target) || lodash.isPlainObject(target) || target instanceof Map) {
        seen.add(target);
        result += 4;
        const entries =
            target instanceof Map ? target.entries() : lodash.isArray(target) ? Array.from(target.entries()) : Object.entries(target);
        for (const [key, value] of entries) {
            result += getTargetSize(key as BinarySupportType, seen);
            result += getTargetSize(value as BinarySupportType, seen);
        }
    } else {
        throw new Error('Unsupported type', { cause: target });
    }
    return result;
};

export const writeBinary = (target: BinarySupportType, options?: BinaryWriteOptions) => {
    const { sig = BINARY_SIG_FLAG, version = 2, compress = false, hash = false } = options || {};

    const payload = new Uint8Array(writeBinaryPayload(target));

    const result = new ArrayBuffer(18 + payload.byteLength);
    const dataView = new DataView(result);
    dataView.setBigUint64(0, sig);
    dataView.setInt32(8, version);
    dataView.setUint8(12, compress ? 1 : 0);
    dataView.setUint8(13, hash ? 1 : 0);
    dataView.setUint32(14, 0);
    let offset = 18;
    payload.forEach((byte) => dataView.setUint8(offset++, byte));
    return result;
};

export const writeBinaryPayload = (target: BinarySupportType, options?: BinaryPayloadWriteOptions) => {
    // init
    if (!options) {
        options = {
            seen: new Set(),
            buffer: new ArrayBuffer(getTargetSize(target)),
            offset: 0,
        };
    }

    // create dataview to edit buffer
    const dataView = new DataView(options.buffer);
    if (typeof target === 'number') {
        dataView.setUint8(options.offset++, BinaryLuaType.Number);
        dataView.setFloat64(options.offset, target);
        options.offset += 8;
    } else if (typeof target === 'boolean') {
        dataView.setUint8(options.offset++, BinaryLuaType.Boolean);
        dataView.setUint8(options.offset++, target ? 1 : 0);
    } else if (typeof target === 'string') {
        dataView.setUint8(options.offset++, BinaryLuaType.String);
        const encoded = stringEncoder.encode(target);
        encoded.forEach((byte) => dataView.setUint8((options as BinaryPayloadWriteOptions).offset++, byte));
        dataView.setUint8(options.offset++, 0);
    } else if (target === null || target === undefined) {
        dataView.setUint8(options.offset++, BinaryLuaType.Nil);
    } else if (lodash.isArray(target) || lodash.isPlainObject(target) || target instanceof Map) {
        dataView.setUint8(options.offset++, BinaryLuaType.Table);
        // 记录table在buffer内的offset
        // table类型后面是一个32位无符号整数，用于表示dword后面的表的大小
        const tableSizeOffset = options.offset;
        options.offset += 4;
        const entries =
            target instanceof Map ? target.entries() : lodash.isArray(target) ? Array.from(target.entries()) : Object.entries(target);
        for (const [key, value] of entries) {
            writeBinaryPayload(key as BinarySupportType, options);
            writeBinaryPayload(value as BinarySupportType, options);
        }
        dataView.setUint32(tableSizeOffset, options.offset - tableSizeOffset - 4);
    } else {
        throw new Error('Unsupported type', { cause: target });
    }

    return options.buffer;
};

export const readBinary = (buffer: ArrayBuffer | Buffer, options?: BinaryReadOptions) => {
    if (buffer instanceof Buffer) {
        buffer = buffer.buffer;
    }
    const { sig: expectSig = BINARY_SIG_FLAG, strict = false, dictType = DictType.Map } = options || {};

    const dataView = new DataView(buffer);

    const sig = dataView.getBigUint64(0);
    if (sig !== expectSig && strict) {
        throw new Error('Signature not match', { cause: sig });
    }

    const version = dataView.getInt32(8);
    const compress = dataView.getUint8(12);
    const hash = dataView.getUint8(13);
    const crc = dataView.getUint32(14);

    const payloadBuffer = buffer.slice(18);

    let payload = readBinaryPayload(payloadBuffer);
    if (payload instanceof Map) {
        payload = mapTransform(payload, {
            dictType,
        }) as Map<any, any>;
    }

    return {
        sig,
        version,
        compress,
        hash,
        crc,
        payload,
    };
};

export const readBinaryPayload = (buffer: ArrayBuffer, options?: BinaryPayloadReadOptions) => {
    if (!options) {
        options = {
            offset: 0,
        };
    }

    const dataView = new DataView(buffer);
    while (options.offset < buffer.byteLength) {
        const type = dataView.getUint8(options.offset++) as BinaryLuaType;
        if (type === BinaryLuaType.Number) {
            const result = dataView.getFloat64(options.offset);
            options.offset += 8;
            return result;
        } else if (type === BinaryLuaType.Boolean) {
            return dataView.getUint8(options.offset++) === 1;
        } else if (type === BinaryLuaType.String) {
            const start = options.offset;
            // eslint-disable-next-line curly
            while (dataView.getUint8(options.offset++) !== 0);
            const result = stringDecoder.decode(buffer.slice(start, options.offset - 1));
            return result;
        } else if (type === BinaryLuaType.Nil) {
            return null;
        } else if (type === BinaryLuaType.Table) {
            const tableSize = dataView.getUint32(options.offset);
            options.offset += 4;
            const result = new Map();
            const tableEnd = options.offset + tableSize;
            while (options.offset < tableEnd) {
                const key = readBinaryPayload(buffer, options);
                const value = readBinaryPayload(buffer, options);
                result.set(key, value);
            }
            return result;
        }
    }

    throw new Error('Unexpected end of buffer');
};

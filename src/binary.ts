import lodash from "lodash";

export const BINARY_SIG_FLAG = BigInt("0x206174614461754c");

export const isBinary = (buffer: ArrayBuffer | Buffer) => {
    buffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
    const dataView = new DataView(buffer);
    const sig = dataView.getBigUint64(2, true);
    return sig === BINARY_SIG_FLAG;
};

declare type BinarySupportType =
    | number
    | string
    | boolean
    | null
    | undefined
    | Array<any>
    | Record<string, any>
    | Map<any, any>;

declare enum DictType {
    Array,
    Object,
    Map,
}

declare interface BinaryWriteOptions {
    sig: bigint;
    version: number;
    compress: boolean;
    hash: boolean;
}

declare interface BinaryPayloadWriteOptions {
    seen: Set<any>;
    buffer: ArrayBuffer;
    offset: number;
}

declare interface BinaryReadOptions {
    sig: bigint;
    strict: boolean;
    dictType: DictType;
}

declare interface BinaryPayloadReadOptions {
    offset: number;
    result: Map<any, any>
}

export enum BinaryLuaType {
    Number,
    Boolean,
    String,
    Nil,
    Table,
}

const encoder = new TextEncoder();

export const getTargetSize = (target: BinarySupportType, seen?: Set<any>) => {
    seen = seen || new Set();
    if (seen.has(target)) {
        throw new Error("Circular reference detected", { cause: target });
    }
    let result = 1;
    if (typeof target === "number") {
        result += 8;
    } else if (typeof target === "boolean") {
        result += 1;
    } else if (typeof target === "string") {
        result += encoder.encode(target).length + 1;
    } else if (
        lodash.isArray(target) ||
        lodash.isPlainObject(target) ||
        target instanceof Map
    ) {
        seen.add(target);
        result += 4;
        const entries =
            target instanceof Map
                ? target.entries()
                : lodash.isArray(target)
                ? Array.from(target.entries())
                : Object.entries(target as Record<string, any>);
        for (const [key, value] of entries) {
            result += getTargetSize(key, seen);
            result += getTargetSize(value, seen);
        }
    } else {
        throw new Error("Unsupported type", { cause: target });
    }
    return result;
};

export const writeBinaryPayload = (
    target: BinarySupportType,
    options?: BinaryPayloadWriteOptions
) => {
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
    if (typeof target === "number") {
        dataView.setUint8(options.offset++, BinaryLuaType.Number);
        dataView.setFloat64(options.offset, target, true);
        options.offset += 8;
    } else if (typeof target === "boolean") {
        dataView.setUint8(options.offset++, BinaryLuaType.Boolean);
        dataView.setUint8(options.offset++, target ? 1 : 0);
    } else if (typeof target === "string") {
        dataView.setUint8(options.offset++, BinaryLuaType.String);
        const encoded = encoder.encode(target);
        encoded.forEach(byte => dataView.setUint8(options.offset++, byte));
        dataView.setUint8(options.offset++, 0);
    } else if (target === null || target === undefined) {
        dataView.setUint8(options.offset++, BinaryLuaType.Nil);
    } else if (
        lodash.isArray(target) ||
        lodash.isPlainObject(target) ||
        target instanceof Map
    ) {
        dataView.setUint8(options.offset++, BinaryLuaType.Table);
        // 记录table在buffer内的offset
        // table类型后面是一个32位无符号整数，用于表示dword后面的表的大小
        const tableSizeOffset = options.offset;
        options.offset += 4;
        const entries =
            target instanceof Map
                ? target.entries()
                : lodash.isArray(target)
                ? Array.from(target.entries())
                : Object.entries(target as Record<string, any>);
        for (const [key, value] of entries) {
            writeBinaryPayload(key, options);
            writeBinaryPayload(value, options);
        }
        dataView.setUint32(
            tableSizeOffset,
            options.offset - tableSizeOffset - 4
        );
    } else {
        throw new Error("Unsupported type", { cause: target });
    }

    return options.buffer;
};

export const writeBinary = (
    target: BinarySupportType,
    options?: BinaryWriteOptions
) => {
    const {
        sig = BINARY_SIG_FLAG,
        version = 2,
        compress = false,
        hash = false,
    } = options || {};

    const payload = new Uint8Array(writeBinaryPayload(target));

    const result = new ArrayBuffer(18 + payload.byteLength);
    const dataView = new DataView(result);
    dataView.setBigUint64(0, sig);
    dataView.setInt32(8, version);
    dataView.setUint8(12, compress ? 1 : 0);
    dataView.setUint8(13, hash ? 1 : 0);
    dataView.setUint32(14, 0);
    let offset = 18;
    payload.forEach(byte => dataView.setUint8(offset++, byte));
    return result;
};

export const readBinary = (
    buffer: ArrayBuffer | Buffer,
    options: BinaryReadOptions
) => {
    if (buffer instanceof Buffer) buffer = buffer.buffer;
    const { sig: expectSig = BINARY_SIG_FLAG, strict = false, dictType = DictType.Map } = options || {};

    const dataView = new DataView(buffer);
    const sig = dataView.getBigUint64(0);
    const version = dataView.getInt32(8);
    const compress = dataView.getUint8(12);
    const hash = dataView.getUint8(13);
    const crc = dataView.getUint32(14);

    const payload = buffer.slice(18);
    
};

export const readBinaryPayload = (buffer: ArrayBuffer | Buffer, options: BinaryPayloadReadOptions) => {

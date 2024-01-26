export enum LuaDataFormat {
    Primitive,
    KData,
    BinaryV2,
}

export 

export const detectFormat = (buffer: ArrayBuffer): LuaDataFormat => {
    const view = new DataView(buffer);
    if (view.getBigUint64()) {
        return LuaDataFormat.BinaryV2;
    } else if (view.get) {
    }
};

export const read = async (buffer: ArrayBuffer): Promise<Record<any, any>> => {
    return {};
};

export const write = async (data: Record<any, any>): Promise<ArrayBuffer> => {
    return Buffer.alloc(0);
};

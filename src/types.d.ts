declare module 'lzfjs' {
    const compress: (data: ArrayBuffer | TypedArray | Buffer) => Uint8Array | Buffer;
    const decompress: (data: ArrayBuffer | TypedArray | Buffer) => Uint8Array | Buffer;

    export default {
        compress,
        decompress,
    };
}

import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

const production = !process.env.ROLLUP_WATCH;

export default {
    input: './src/index.ts',
    external: ['lodash', 'lzfjs', 'crc', 'luadata'],
    output: {
        file: 'dist/index.js',
        format: 'umd',
        name: 'jx3-luadata',
        sourcemap: !production,
        globals: {
            lodash: 'lodash',
            lzfjs: 'lzf',
            crc: 'crc',
            luadata: 'luadata',
        },
    },
    plugins: [
        typescript({
            sourceMap: !production,
            outputToFilesystem: true,
        }),
        json(),
    ],
};

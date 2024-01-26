import iconv from 'iconv-lite';

const key = [0x76, 0x75, 0x53, 0x72, 0x71, 0x39, 0x4f, 0x62];

export const decodeAdventureString = (code: string, encoding: string = 'gbk') => {
    if (code.length % 2 !== 0) {
        throw new Error('Buffer length must be even');
    }
    const buffer = iconv.encode(code, 'ascii');

    const output = [];
    for (let i = 0; i < buffer.length / 2; ++i) {
        const char = ((buffer[i * 2] - 0x41) << 4) | (buffer[i * 2 + 1] - 0x41);
        output.push(char ^ key[i % key.length]);
    }

    const result = iconv.decode(Buffer.from(output), encoding);
    return result;
};

export const encodeAdventureString = (string: string, encoding = 'gbk') => {
    const buffer = iconv.encode(string, encoding);

    const output = [];
    for (let i = 0; i < buffer.length; ++i) {
        const char = buffer[i] ^ key[i % key.length];
        output.push(((char >> 4) & 0x0f) + 0x41);
        output.push((char & 0x0f) + 0x41);
    }

    const result = iconv.decode(Buffer.from(output), 'ascii');
    return result;
};

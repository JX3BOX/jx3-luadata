const { isKData, readKdata, writeKData } = require('../dist/index.js');
const { expect } = require('chai');

describe('Binary', () => {
    it('神说：我们应该能提供一个能判断buffer是不是kdata格式的函数', () => {
        const target = new ArrayBuffer(new Uint8Array(100));

        const buffer = writeKData(target);
        const result = isKData(buffer);
        expect(result).to.equal(true);
    });

    it('神说：KData可以存任意一段二进制数据', () => {
        const array = new Uint8Array(255);
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 255);
        }
        const target = array.buffer;

        const buffer = writeKData(target, { compress: true, hash: true });
        const result = readKdata(buffer);
        const payload = result.payload;
        expect(Buffer.from(payload).equals(Buffer.from(target))).to.equal(true);
    });
});

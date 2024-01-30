const { Lua } = require('wasmoon-lua5.1');
const { readBinary, writeBinary, luadata, DictType, mapTransform } = require('../dist/index.js');
const { expect } = require('chai');
const fs = require('fs');
const iconv = require('iconv-lite');

describe('Binary', () => {
    it('神说：我们的库把一个表写入再写出应该是一致的', () => {
        const target = {
            a: 1,
            b: 2,
            c: 3,
            d: {
                e: 4,
                f: 5,
                g: 6,
                h: {
                    i: 7,
                    j: 8,
                    k: 9,
                },
            },
        };

        const buffer = writeBinary(target);
        const result = readBinary(buffer);
        const payload = mapTransform(result.payload, { dictType: DictType.Object });
        expect(payload).to.deep.equal(target);
    });

    it('神说：我们应该支持任意Lua基础数据类型的写入与读取 - 字符串', () => {
        const target = '神说：今天也这么努力，晚上休息一下没关系的吧！';

        const buffer = writeBinary(target);
        const result = readBinary(buffer);
        expect(result.payload).to.deep.equal(target);
    });

    it('神说：我们应该支持任意Lua基础数据类型的写入与读取 - null', () => {
        const target = null;

        const buffer = writeBinary(target);
        const result = readBinary(buffer);
        expect(result.payload).to.deep.equal(target);
    });

    it('神说：我们应该支持任意Lua基础数据类型的写入与读取 - 数字', () => {
        const target = Math.random();

        const buffer = writeBinary(target);
        const result = readBinary(buffer);
        expect(result.payload).to.deep.equal(target);
    });

    it('神说：茗伊战斗统计给的对比数据应该要通过测试', async function () {
        this.timeout(10000);
        const map = [
            '2023-12-29-11-33-38_萧沙_489.fstt.jx3dat',
            '2024-01-26-10-20-37_英怀珠_146.fstt.jx3dat',
            '2024-01-26-10-24-48_高力士_64.fstt.jx3dat',
            '2024-01-26-10-28-39_安禄山_140.fstt.jx3dat',
        ];
        for (const file of map) {
            const fileBuffer = fs.readFileSync(`test/demo/${file}`);
            const fileContent = iconv.decode(fileBuffer, 'gbk').slice(6);
            const script = `x = ${fileContent}`;
            const lua = await Lua.create();
            await lua.doString(script);
            lua.luaApi.lua_getglobal(lua.global.address, 'x');
            const table = lua.global.getTable(1, { dictType: DictType.Map });
            const binary = Buffer.from(writeBinary(table));
            const v2_target = fs.readFileSync(`test/demo/${file}_V2`);
            expect(binary.equals(v2_target)).to.be.equal(true, `${file} 不匹配！`);
        }
    });
});

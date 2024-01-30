// import { Lua } from 'wasmoon-lua5.1';
// import { luadata, writeBinary, readBinary, DictType } from '../dist/index.js';
// import fs from 'fs';
// import iconv from 'iconv-lite';

// const file = 'test/demo/2024-01-26-10-28-39_安禄山_140.fstt.jx3dat';
// const buffer = fs.readFileSync(file);
// const _content = iconv.decode(buffer, 'gbk').slice(6);
// const script = `x = ${_content}`;
// const lua = await Lua.create();
// await lua.doString(script);
// lua.global.luaApi.lua_getglobal(lua.global.address, 'x');
// lua.global.dumpStack();
// const data = lua.global.getTable(1, { dictType: DictType.Map });
// console.log(data);
// const binary = Buffer.from(writeBinary(data));
// fs.writeFileSync('test/test.jx3dat_V2', binary);
//const readResult = readBinary(binary);npm ui
//console.log(readResult);

// const ta = fs.readFileSync('test/demo/2024-01-26-10-28-39_安禄山_140.fstt.jx3dat_V2');
// console.log(ta.equals(binary));

// const str = '缘起大区_缘起稻香';

// const encoder = new TextEncoder();
// console.log(encoder.encode(str).buffer);
// const target = iconv.encode(str, 'gbk');
// console.log(target.buffer.slice(0, target.byteLength));

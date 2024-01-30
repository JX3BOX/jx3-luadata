# jx3-luadata

剑三的lua数据交互库  

## 支持的格式

### 裸的lua table

[茗伊写的](https://www.npmjs.com/package/luadata)

#### 无文件头的lua table

```lua
{ key = value }
-- or  
return { key = value }
```

```js
import { luadata } from "@jx3box/jx3-luadata"
```

### KData

带文件头的KData
见 [文档](https://github.com/JX3BOX/jx3-unpkg/blob/master/docs/数据交互/jx3dat格式.md)

```js
const { isKData, readKdata, writeKData } = require('../dist/index.js');
const array = new Uint8Array(255);
for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 255);
}
const target = array.buffer;

const buffer = writeKData(target, { compress: true, hash: true });
const result = readKdata(buffer);
```

### ver2 Luadata 二进制格式

带文件头的第二代luadata
见 [文档](./docs/剑网3缘起本地序列化lua数据说明.md)

```js
import { luadata, writeBinary, readBinary, DictType } from '../dist/index.js';

const target = {
    hello: 'world',
};

const buffer = writeBinary(target);
const result = readBinary(buffer);
```

# jx3-luadata

剑三的lua数据交互库  

## Quick Start

```ts
import { read, write, LuaDataFormat } from '@jx3box/jx3-luadata';
import fs from "fs/promises";

const data = await read('path/to/file');
const buffer = await write(data, { format: LuaDataFormat.KData });
await fs.writeFile('path/to/file', buffer);
```

## 支持的格式

### 裸的lua table

```lua
{ key = value }
-- or 
return { key = value }
```

### KData

带文件头的KData
见 [文档](https://github.com/JX3BOX/jx3-unpkg/blob/master/docs/数据交互/jx3dat格式.md)

### ver2 Luadata 二进制格式

带文件头的第二代luadata
见 [文档](./docs/剑网3缘起本地序列化lua数据说明.md)

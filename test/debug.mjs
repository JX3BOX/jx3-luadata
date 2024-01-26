// debug here
import { writeBinary, writeKData } from '../dist/index.js';
import fs from 'fs/promises';

const payload = writeBinary('test');
const kdata = writeKData(payload, { compress: true });

await fs.writeFile('test.jx3dat', Buffer.from(kdata));

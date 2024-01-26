import { readFile } from "fs/promises";

const buffer = await readFile("./demo/不咕#2312@3.jx3dat");
const arrayBuffer = buffer.buffer;
const view = new DataView(arrayBuffer);
console.log(view.getUint16(2) == 0x444b);
console.log(view);

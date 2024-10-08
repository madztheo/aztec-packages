import { promisify } from 'util';
import { gunzip } from 'zlib';

import { Opcode } from './serialization/instruction_serialization.js';

const AVM_MAGIC_SUFFIX = Buffer.from([
  Opcode.MOV_16, // opcode
  0x00, // indirect
  ...Buffer.from('18ca', 'hex'), // srcOffset
  ...Buffer.from('18ca', 'hex'), // dstOffset
]);

export function markBytecodeAsAvm(bytecode: Buffer): Buffer {
  return Buffer.concat([bytecode, AVM_MAGIC_SUFFIX]);
}

// This is just a helper function for the AVM simulator
export async function decompressBytecodeIfCompressed(bytecode: Buffer): Promise<Buffer> {
  try {
    return await promisify(gunzip)(bytecode);
  } catch {
    // If the bytecode is not compressed, the gunzip call will throw an error
    // In this case, we assume the bytecode is not compressed and continue.
    return Promise.resolve(bytecode);
  }
}

export async function isAvmBytecode(bytecode: Buffer): Promise<boolean> {
  const decompressedBytecode = await decompressBytecodeIfCompressed(bytecode);
  const magicSize = AVM_MAGIC_SUFFIX.length;
  return decompressedBytecode.subarray(-magicSize).equals(AVM_MAGIC_SUFFIX);
}

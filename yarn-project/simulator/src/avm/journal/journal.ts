import {
  AztecAddress,
  type FunctionSelector,
  type Gas,
  SerializableContractInstance,
  computePublicBytecodeCommitment,
} from '@aztec/circuits.js';
import { Fr } from '@aztec/foundation/fields';
import { createDebugLogger } from '@aztec/foundation/log';

import assert from 'assert';

import { getPublicFunctionDebugName } from '../../common/debug_fn_name.js';
import { type WorldStateDB } from '../../public/public_db_sources.js';
import { type TracedContractInstance } from '../../public/side_effect_trace.js';
import { type PublicSideEffectTraceInterface } from '../../public/side_effect_trace_interface.js';
import { type AvmContractCallResult } from '../avm_contract_call_result.js';
import { type AvmExecutionEnvironment } from '../avm_execution_environment.js';
import { NullifierManager } from './nullifiers.js';
import { PublicStorage } from './public_storage.js';

/**
 * A class to manage persistable AVM state for contract calls.
 * Maintains a cache of the current world state,
 * a trace of all side effects.
 *
 * The simulator should make any world state / tree queries through this object.
 *
 * Manages merging of successful/reverted child state into current state.
 */
export class AvmPersistableStateManager {
  private readonly log = createDebugLogger('aztec:avm_simulator:state_manager');

  constructor(
    /** Reference to node storage */
    private readonly worldStateDB: WorldStateDB,
    /** Side effect trace */
    private readonly trace: PublicSideEffectTraceInterface,
    /** Public storage, including cached writes */
    // TODO(5818): make private once no longer accessed in executor
    public readonly publicStorage: PublicStorage,
    /** Nullifier set, including cached/recently-emitted nullifiers */
    private readonly nullifiers: NullifierManager,
  ) {}

  /**
   * Create a new state manager with some preloaded pending siloed nullifiers
   */
  public static newWithPendingSiloedNullifiers(
    worldStateDB: WorldStateDB,
    trace: PublicSideEffectTraceInterface,
    pendingSiloedNullifiers: Fr[],
  ) {
    const parentNullifiers = NullifierManager.newWithPendingSiloedNullifiers(worldStateDB, pendingSiloedNullifiers);
    return new AvmPersistableStateManager(
      worldStateDB,
      trace,
      /*publicStorage=*/ new PublicStorage(worldStateDB),
      /*nullifiers=*/ parentNullifiers.fork(),
    );
  }

  /**
   * Create a new state manager forked from this one
   */
  public fork() {
    return new AvmPersistableStateManager(
      this.worldStateDB,
      this.trace.fork(),
      this.publicStorage.fork(),
      this.nullifiers.fork(),
    );
  }

  /**
   * Write to public storage, journal/trace the write.
   *
   * @param contractAddress - the address of the contract whose storage is being written to
   * @param slot - the slot in the contract's storage being written to
   * @param value - the value being written to the slot
   */
  public writeStorage(contractAddress: Fr, slot: Fr, value: Fr) {
    this.log.debug(`Storage write (address=${contractAddress}, slot=${slot}): value=${value}`);
    // Cache storage writes for later reference/reads
    this.publicStorage.write(contractAddress, slot, value);
    this.trace.tracePublicStorageWrite(contractAddress, slot, value);
  }

  /**
   * Read from public storage, trace the read.
   *
   * @param contractAddress - the address of the contract whose storage is being read from
   * @param slot - the slot in the contract's storage being read from
   * @returns the latest value written to slot, or 0 if never written to before
   */
  public async readStorage(contractAddress: Fr, slot: Fr): Promise<Fr> {
    const { value, exists, cached } = await this.publicStorage.read(contractAddress, slot);
    this.log.debug(
      `Storage read  (address=${contractAddress}, slot=${slot}): value=${value}, exists=${exists}, cached=${cached}`,
    );
    this.trace.tracePublicStorageRead(contractAddress, slot, value, exists, cached);
    return Promise.resolve(value);
  }

  /**
   * Read from public storage, don't trace the read.
   *
   * @param contractAddress - the address of the contract whose storage is being read from
   * @param slot - the slot in the contract's storage being read from
   * @returns the latest value written to slot, or 0 if never written to before
   */
  public async peekStorage(contractAddress: Fr, slot: Fr): Promise<Fr> {
    const { value, exists, cached } = await this.publicStorage.read(contractAddress, slot);
    this.log.debug(
      `Storage peek  (address=${contractAddress}, slot=${slot}): value=${value}, exists=${exists}, cached=${cached}`,
    );
    return Promise.resolve(value);
  }

  // TODO(4886): We currently don't silo note hashes.
  /**
   * Check if a note hash exists at the given leaf index, trace the check.
   *
   * @param contractAddress - the address of the contract whose storage is being read from
   * @param noteHash - the unsiloed note hash being checked
   * @param leafIndex - the leaf index being checked
   * @returns true if the note hash exists at the given leaf index, false otherwise
   */
  public async checkNoteHashExists(contractAddress: Fr, noteHash: Fr, leafIndex: Fr): Promise<boolean> {
    const gotLeafValue = (await this.worldStateDB.getCommitmentValue(leafIndex.toBigInt())) ?? Fr.ZERO;
    const exists = gotLeafValue.equals(noteHash);
    this.log.debug(
      `noteHashes(${contractAddress})@${noteHash} ?? leafIndex: ${leafIndex} | gotLeafValue: ${gotLeafValue}, exists: ${exists}.`,
    );
    // TODO(8287): We still return exists here, but we need to transmit both the requested noteHash and the gotLeafValue
    // such that the VM can constrain the equality and decide on exists based on that.
    this.trace.traceNoteHashCheck(contractAddress, gotLeafValue, leafIndex, exists);
    return Promise.resolve(exists);
  }

  /**
   * Write a note hash, trace the write.
   * @param noteHash - the unsiloed note hash to write
   */
  public writeNoteHash(contractAddress: Fr, noteHash: Fr) {
    this.log.debug(`noteHashes(${contractAddress}) += @${noteHash}.`);
    this.trace.traceNewNoteHash(contractAddress, noteHash);
  }

  /**
   * Check if a nullifier exists, trace the check.
   * @param contractAddress - address of the contract that the nullifier is associated with
   * @param nullifier - the unsiloed nullifier to check
   * @returns exists - whether the nullifier exists in the nullifier set
   */
  public async checkNullifierExists(contractAddress: Fr, nullifier: Fr): Promise<boolean> {
    const [exists, isPending, leafIndex] = await this.nullifiers.checkExists(contractAddress, nullifier);
    this.log.debug(
      `nullifiers(${contractAddress})@${nullifier} ?? leafIndex: ${leafIndex}, exists: ${exists}, pending: ${isPending}.`,
    );
    this.trace.traceNullifierCheck(contractAddress, nullifier, leafIndex, exists, isPending);
    return Promise.resolve(exists);
  }

  /**
   * Write a nullifier to the nullifier set, trace the write.
   * @param contractAddress - address of the contract that the nullifier is associated with
   * @param nullifier - the unsiloed nullifier to write
   */
  public async writeNullifier(contractAddress: Fr, nullifier: Fr) {
    this.log.debug(`nullifiers(${contractAddress}) += ${nullifier}.`);
    // Cache pending nullifiers for later access
    await this.nullifiers.append(contractAddress, nullifier);
    // Trace all nullifier creations (even reverted ones)
    this.trace.traceNewNullifier(contractAddress, nullifier);
  }

  /**
   * Check if an L1 to L2 message exists, trace the check.
   * @param msgHash - the message hash to check existence of
   * @param msgLeafIndex - the message leaf index to use in the check
   * @returns exists - whether the message exists in the L1 to L2 Messages tree
   */
  public async checkL1ToL2MessageExists(contractAddress: Fr, msgHash: Fr, msgLeafIndex: Fr): Promise<boolean> {
    const valueAtIndex = (await this.worldStateDB.getL1ToL2LeafValue(msgLeafIndex.toBigInt())) ?? Fr.ZERO;
    const exists = valueAtIndex.equals(msgHash);
    this.log.debug(
      `l1ToL2Messages(@${msgLeafIndex}) ?? exists: ${exists}, expected: ${msgHash}, found: ${valueAtIndex}.`,
    );
    // TODO(8287): We still return exists here, but we need to transmit both the requested msgHash and the value
    // such that the VM can constrain the equality and decide on exists based on that.
    this.trace.traceL1ToL2MessageCheck(contractAddress, valueAtIndex, msgLeafIndex, exists);
    return Promise.resolve(exists);
  }

  /**
   * Write an L2 to L1 message.
   * @param contractAddress - L2 contract address that created this message
   * @param recipient - L1 contract address to send the message to.
   * @param content - Message content.
   */
  public writeL2ToL1Message(contractAddress: Fr, recipient: Fr, content: Fr) {
    this.log.debug(`L2ToL1Messages(${contractAddress}) += (recipient: ${recipient}, content: ${content}).`);
    this.trace.traceNewL2ToL1Message(contractAddress, recipient, content);
  }

  /**
   * Write an unencrypted log
   * @param contractAddress - address of the contract that emitted the log
   * @param event - log event selector
   * @param log - log contents
   */
  public writeUnencryptedLog(contractAddress: Fr, log: Fr[]) {
    this.log.debug(`UnencryptedL2Log(${contractAddress}) += event with ${log.length} fields.`);
    this.trace.traceUnencryptedLog(contractAddress, log);
  }

  /**
   * Get a contract instance.
   * @param contractAddress - address of the contract instance to retrieve.
   * @returns the contract instance with an "exists" flag
   */
  public async getContractInstance(contractAddress: Fr): Promise<TracedContractInstance> {
    let exists = true;
    const aztecAddress = AztecAddress.fromField(contractAddress);
    let instance = await this.worldStateDB.getContractInstance(aztecAddress);
    if (instance === undefined) {
      instance = SerializableContractInstance.default().withAddress(aztecAddress);
      exists = false;
    }
    this.log.debug(
      `Get Contract instance (address=${contractAddress}): exists=${exists}, instance=${JSON.stringify(instance)}`,
    );
    const tracedInstance = { ...instance, exists };
    this.trace.traceGetContractInstance(tracedInstance);
    return Promise.resolve(tracedInstance);
  }

  /**
   * Accept nested world state modifications
   */
  public acceptNestedCallState(nestedState: AvmPersistableStateManager) {
    this.publicStorage.acceptAndMerge(nestedState.publicStorage);
    this.nullifiers.acceptAndMerge(nestedState.nullifiers);
  }

  /**
   * Get a contract's bytecode from the contracts DB, also trace the contract class and instance
   */
  public async getBytecode(contractAddress: AztecAddress, selector: FunctionSelector): Promise<Buffer | undefined> {
    let exists = true;
    // If the bytecode is not found, we let the executor decide that to do
    const bytecode = await this.worldStateDB.getBytecode(contractAddress, selector);
    let contractInstance = await this.worldStateDB.getContractInstance(contractAddress);
    // If the contract instance is not found, we assume it has not be deployed. We will also be unable to find the
    // contract class as we will not have the id. While the class might exist, we hopefully won't need it to generate a proof (tbd).
    if (contractInstance === undefined) {
      exists = false;
      contractInstance = SerializableContractInstance.default().withAddress(contractAddress);
      this.trace.traceGetBytecode(
        bytecode ?? Buffer.alloc(1),
        { exists, ...contractInstance },
        {
          artifactHash: Fr.zero(),
          privateFunctionsRoot: Fr.zero(),
          publicBytecodeCommitment: Fr.zero(),
        },
      );
      return bytecode;
    }
    const contractClass = await this.worldStateDB.getContractClass(contractInstance.contractClassId);
    assert(
      contractClass,
      `Contract class not found in DB, but a contract instance was found with this class ID (${contractInstance.contractClassId}). This should not happen!`,
    );
    const contractClassPreimage = {
      artifactHash: contractClass.artifactHash,
      privateFunctionsRoot: contractClass.privateFunctionsRoot,
      publicBytecodeCommitment: computePublicBytecodeCommitment(contractClass.packedBytecode),
    };
    this.trace.traceGetBytecode(bytecode!, { exists, ...contractInstance }, contractClassPreimage);

    return bytecode;
  }

  /**
   * Accept the nested call's state and trace the nested call
   */
  public async processNestedCall(
    nestedState: AvmPersistableStateManager,
    nestedEnvironment: AvmExecutionEnvironment,
    startGasLeft: Gas,
    endGasLeft: Gas,
    bytecode: Buffer,
    avmCallResults: AvmContractCallResult,
  ) {
    if (!avmCallResults.reverted) {
      this.acceptNestedCallState(nestedState);
    }
    const functionName = await getPublicFunctionDebugName(
      this.worldStateDB,
      nestedEnvironment.address,
      nestedEnvironment.functionSelector,
      nestedEnvironment.calldata,
    );

    this.log.verbose(`[AVM] Calling nested function ${functionName}`);

    this.trace.traceNestedCall(
      nestedState.trace,
      nestedEnvironment,
      startGasLeft,
      endGasLeft,
      bytecode,
      avmCallResults,
      functionName,
    );
  }
}

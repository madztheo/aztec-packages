import { type ServerCircuitProver } from '@aztec/circuit-types';
import { Fr } from '@aztec/circuits.js';
import { times } from '@aztec/foundation/collection';
import { createDebugLogger } from '@aztec/foundation/log';
import { WASMSimulator } from '@aztec/simulator';
import { NoopTelemetryClient } from '@aztec/telemetry-client/noop';

import { jest } from '@jest/globals';

import { TestCircuitProver } from '../../../bb-prover/src/test/test_circuit_prover.js';
import { makeBloatedProcessedTx, makeGlobals } from '../mocks/fixtures.js';
import { TestContext } from '../mocks/test_context.js';
import { ProvingOrchestrator } from './orchestrator.js';

const logger = createDebugLogger('aztec:orchestrator-failures');

describe('prover/orchestrator/failures', () => {
  let context: TestContext;
  let orchestrator: ProvingOrchestrator;

  beforeEach(async () => {
    context = await TestContext.new(logger);
  });

  afterEach(async () => {
    await context.cleanup();
  });

  describe('error handling', () => {
    let mockProver: ServerCircuitProver;

    beforeEach(() => {
      mockProver = new TestCircuitProver(new NoopTelemetryClient(), new WASMSimulator());
      orchestrator = new ProvingOrchestrator(context.actualDb, mockProver, new NoopTelemetryClient());
    });

    it.each([
      ['Base Rollup Failed', (msg: string) => jest.spyOn(mockProver, 'getBaseRollupProof').mockRejectedValue(msg)],
      ['Merge Rollup Failed', (msg: string) => jest.spyOn(mockProver, 'getMergeRollupProof').mockRejectedValue(msg)],
      [
        'Block Root Rollup Failed',
        (msg: string) => jest.spyOn(mockProver, 'getBlockRootRollupProof').mockRejectedValue(msg),
      ],
      [
        'Block Merge Rollup Failed',
        (msg: string) => jest.spyOn(mockProver, 'getBlockMergeRollupProof').mockRejectedValue(msg),
      ],
      ['Root Rollup Failed', (msg: string) => jest.spyOn(mockProver, 'getRootRollupProof').mockRejectedValue(msg)],
      ['Base Parity Failed', (msg: string) => jest.spyOn(mockProver, 'getBaseParityProof').mockRejectedValue(msg)],
      ['Root Parity Failed', (msg: string) => jest.spyOn(mockProver, 'getRootParityProof').mockRejectedValue(msg)],
    ] as const)('handles a %s error', async (message: string, fn: (msg: string) => void) => {
      /**
       * NOTE: these tests start a new epoch with N blocks. Each block will have M txs in it.
       * Txs are proven in parallel and as soon as one fails (which is what this test is setting up to happen)
       * the orchestrator stops accepting txs in a block.
       * This means we have to be careful with our assertions as the order in which things happen is non-deterministic.
       * We need to expect
       * - addTx to fail (because a block's provingState became invalid)
       * - addTx to work fine (because we haven't hit the error in the test setup) but the epoch to fail
       */
      fn(message);

      orchestrator.startNewEpoch(1, 3);

      // We need at least 3 blocks and 3 txs to ensure all circuits are used
      for (let i = 0; i < 3; i++) {
        const txs = times(3, j => makeBloatedProcessedTx(context.actualDb, i * 10 + j + 1));
        const msgs = [new Fr(i + 100)];
        // these operations could fail if the target circuit fails before adding all blocks or txs
        try {
          await orchestrator.startNewBlock(txs.length, makeGlobals(i + 1), msgs);
          let allTxsAdded = true;
          for (const tx of txs) {
            try {
              await orchestrator.addNewTx(tx);
            } catch (err) {
              allTxsAdded = false;
              break;
            }
          }

          if (!allTxsAdded) {
            await expect(orchestrator.setBlockCompleted()).rejects.toThrow(`Block proving failed: ${message}`);
          } else {
            await orchestrator.setBlockCompleted();
          }
        } catch (err) {
          break;
        }
      }

      await expect(() => orchestrator.finaliseEpoch()).rejects.toThrow();
    });
  });
});

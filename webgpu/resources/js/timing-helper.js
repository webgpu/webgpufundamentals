function assert(cond, msg = '') {
  if (!cond) {
    throw new Error(msg);
  }
}

export default class TimingHelper {
  #device;
  #canTimestamp;
  #querySets;
  #currentSet;
  #state = 'free';

  constructor(device) {
    this.#device = device;
    this.#canTimestamp = device.features.has('timestamp-query');
    this.#querySets = [];
    this.#currentSet = undefined;
  }

  #getQuerySet() {
    const device = this.#device;
    if (this.#querySets.length === 0) {
      const querySet = device.createQuerySet({
         type: 'timestamp',
         count: 2,
      });
      const resolveBuffer = device.createBuffer({
        size: 2 * 8,
        usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
      });
      const resultBuffer = device.createBuffer({
        size: 2 * 8,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      this.#querySets.push({querySet, resolveBuffer, resultBuffer});
    }
    return this.#querySets.pop();
  }
  #beginTimestampPass(encoder, fnName, descriptor) {
    if (this.#canTimestamp) {
      assert(this.#state === 'free', 'state not free');
      this.#state = 'need resolve';

      assert(!this.#currentSet);
      this.#currentSet = this.#getQuerySet();

      const pass = encoder[fnName]({
        ...descriptor,
        ...{
          timestampWrites: {
            querySet: this.#currentSet.querySet,
            beginningOfPassWriteIndex: 0,
            endOfPassWriteIndex: 1,
          },
        },
      });

      const resolve = () => this.#resolveTiming(encoder);
      pass.end = (function(origFn) {
        return function() {
          origFn.call(this);
          resolve();
        };
      })(pass.end);

      return pass;
    } else {
      return encoder[fnName](descriptor);
    }
  }

  beginRenderPass(encoder, descriptor = {}) {
    return this.#beginTimestampPass(encoder, 'beginRenderPass', descriptor);
  }

  beginComputePass(encoder, descriptor = {}) {
    return this.#beginTimestampPass(encoder, 'beginComputePass', descriptor);
  }

  #resolveTiming(encoder) {
    if (!this.#canTimestamp) {
      return;
    }
    assert(!!this.#currentSet);
    assert(this.#state === 'need resolve', 'must call addTimestampToPass');
    this.#state = 'wait for result';

    const { querySet, resolveBuffer, resultBuffer } = this.#currentSet;

    encoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
    encoder.copyBufferToBuffer(resolveBuffer, 0, resultBuffer, 0, resultBuffer.size);
  }

  async getResult() {
    if (!this.#canTimestamp) {
      return 0;
    }
    assert(!!this.#currentSet);
    assert(this.#state === 'wait for result', 'must call resolveTiming');
    this.#state = 'free';

    const q = this.#currentSet;
    this.#currentSet = undefined;

    const { resultBuffer } = q;
    await resultBuffer.mapAsync(GPUMapMode.READ);
    const times = new BigInt64Array(resultBuffer.getMappedRange());
    const duration = Number(times[1] - times[0]);
    resultBuffer.unmap();
    this.#querySets.push(q);
    return duration;
  }
}
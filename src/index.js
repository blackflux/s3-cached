import assert from 'assert';
import zlib from 'zlib';
import cacheManager from 'cache-manager';
import fsStore from 'cache-manager-fs';
import defaults from 'lodash.defaults';
import get from 'lodash.get';

export default (options) => {
  assert(options instanceof Object && !Array.isArray(options));
  assert(options.ttlDefault === undefined, 'Please use ttl instead.');
  defaults(options, {
    ttl: 600, // eventually we invalidate cached data
    diskMaxSize: 469762048, // lambda allows for ~512mb in /tmp directory
    diskTmpDirectory: '/tmp',
    memoryLimit: 100
  });
  const awsSdkWrap = options.awsSdkWrap;
  const memoryCache = cacheManager.caching({ store: 'memory', max: options.memoryLimit });
  const diskCache = cacheManager.caching({
    store: fsStore,
    maxsize: options.diskMaxSize,
    path: options.diskTmpDirectory,
    reviveBuffers: true,
    preventfill: true // prevent cache re-init while testing
  });
  const multiCache = cacheManager.multiCaching([memoryCache, diskCache]);
  const multiCacheWrap = (...args) => {
    assert(get(args, [2, 'ttl']) !== 0, 'Use low ttl instead of zero (undefined behaviour).');
    return multiCache.wrap(...args);
  };

  const getKeysCached = (prefix = undefined, {
    ttl = options.ttl,
    bucket = options.bucket
  } = {}) => multiCacheWrap(prefix || '', async () => {
    assert(typeof prefix === 'string' || prefix === undefined);
    assert(typeof ttl === 'number');
    assert(typeof bucket === 'string');
    return awsSdkWrap.s3.listObjects({ bucket, prefix });
  }, { ttl });

  const getBinaryObjectCached = (
    key,
    {
      ttl = options.ttl,
      bucket = options.bucket,
      modifications = []
    } = {}
  ) => {
    assert(typeof key === 'string');
    assert(typeof ttl === 'number');
    assert(typeof bucket === 'string');
    assert(Array.isArray(modifications));
    return multiCacheWrap(key, () => [
      (data) => data.Body.transformToByteArray(),
      (byteArray) => Buffer.from(byteArray),
      ...modifications
    ].reduce(
      (p, c) => p.then(c),
      awsSdkWrap.call('S3:GetObjectCommand', { Bucket: bucket, Key: key })
    ), { ttl });
  };

  return {
    getKeysCached,
    getBinaryObjectCached,
    getTextObjectCached: (key, opts = {}) => {
      assert(typeof key === 'string');
      assert(opts instanceof Object && !Array.isArray(opts));
      return getBinaryObjectCached(key, {
        ttl: opts.ttl,
        bucket: opts.bucket,
        modifications: [(body) => body.toString()]
      });
    },
    getJsonObjectCached: (key, opts = {}) => {
      assert(typeof key === 'string');
      assert(opts instanceof Object && !Array.isArray(opts));
      return getBinaryObjectCached(key, {
        ttl: opts.ttl,
        bucket: opts.bucket,
        modifications: [(body) => body.toString(), JSON.parse]
      });
    },
    getGzipObjectCached: (key, opts = {}) => {
      assert(typeof key === 'string');
      assert(opts instanceof Object && !Array.isArray(opts));
      return getBinaryObjectCached(key, {
        ttl: opts.ttl,
        bucket: opts.bucket,
        modifications: [zlib.gunzipSync]
      });
    },
    resetCache: async () => {
      await new Promise(multiCache.reset);
    }
  };
};

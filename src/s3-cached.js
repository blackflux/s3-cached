const assert = require('assert');
const zlib = require('zlib');
const AWS = require('aws-sdk-wrap');
const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');
const defaults = require('lodash.defaults');
const get = require('lodash.get');

module.exports = (options) => {
  assert(typeof options === 'object' && !Array.isArray(options));
  assert(options.ttlDefault === undefined, 'Please use ttl instead.');
  defaults(options, {
    ttl: 600, // eventually we invalidate cached data
    diskMaxSize: 469762048, // lambda allows for ~512mb in /tmp directory
    diskTmpDirectory: '/tmp',
    memoryLimit: 100,
    logger: null
  });
  const aws = AWS({ config: options.s3Options, logger: options.logger });
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

  const getKeysCached = (prefix = '', {
    ttl = options.ttl,
    bucket = options.bucket
  } = {}) => multiCacheWrap(prefix, async () => {
    assert(typeof prefix === 'string');
    assert(typeof ttl === 'number');
    assert(typeof bucket === 'string');
    const result = [];
    let data = null;
    do {
      // eslint-disable-next-line no-await-in-loop
      data = await aws.call('s3', 'listObjectsV2', {
        Prefix: prefix,
        Bucket: bucket,
        ContinuationToken: get(data, 'NextContinuationToken')
      });
      result.push(...data.Contents);
    } while (data.IsTruncated);
    return result;
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
      data => data.Body,
      ...modifications
    ].reduce(
      (p, c) => p.then(c),
      aws.call('s3', 'getObject', { Bucket: bucket, Key: key })
    ), { ttl });
  };

  return {
    getKeysCached,
    getBinaryObjectCached,
    getTextObjectCached: (key, opts = {}) => {
      assert(typeof key === 'string');
      assert(typeof opts === 'object' && !Array.isArray(opts));
      return getBinaryObjectCached(key, {
        ttl: opts.ttl,
        bucket: opts.bucket,
        modifications: [body => body.toString()]
      });
    },
    getJsonObjectCached: (key, opts = {}) => {
      assert(typeof key === 'string');
      assert(typeof opts === 'object' && !Array.isArray(opts));
      return getBinaryObjectCached(key, {
        ttl: opts.ttl,
        bucket: opts.bucket,
        modifications: [body => body.toString(), JSON.parse]
      });
    },
    getDeflatedObjectCached: (key, opts = {}) => {
      assert(typeof key === 'string');
      assert(typeof opts === 'object' && !Array.isArray(opts));
      return getBinaryObjectCached(key, {
        ttl: opts.ttl,
        bucket: opts.bucket,
        modifications: [zlib.gunzipSync]
      });
    }
  };
};

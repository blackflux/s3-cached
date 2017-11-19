const zlib = require('zlib');
const AWS = require('aws-sdk');
const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');

module.exports = (options) => {
  const s3 = new AWS.S3();
  const memoryCache = cacheManager.caching({ store: 'memory', max: options.memoryLimit });
  const diskCache = cacheManager.caching({
    store: fsStore,
    maxsize: options.diskMaxSize,
    path: options.diskTmpDirectory,
    reviveBuffers: true,
    preventfill: true // prevent cache re-init while testing
  });
  const multiCache = cacheManager.multiCaching([memoryCache, diskCache]);

  const getBinaryObjectCached = (key, cacheOptions, chain) => multiCache.wrap(key, () => chain.reduce(
    (p, c) => p.then(c),
    s3.getObject({ Bucket: options.Bucket, Key: key }).promise()
  ), cacheOptions);

  return {
    getJsonObjectCached: (key, ttl = options.ttlDefault) => getBinaryObjectCached(key, { ttl }, [
      data => data.Body.toString(),
      JSON.parse
    ]),
    getDeflatedObjectCached: (key, ttl = options.ttlDefault) => getBinaryObjectCached(key, { ttl }, [
      data => data.Body,
      zlib.gunzipSync
    ])
  };
};

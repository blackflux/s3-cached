const zlib = require('zlib');
const AWS = require('aws-sdk');
const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');
const defaults = require('lodash.defaults');

module.exports = (options) => {
  defaults(options, {
    ttlDefault: 600, // eventually we invalidate cached data
    diskMaxSize: 469762048, // lambda allows for ~512mb in /tmp directory
    diskTmpDirectory: '/tmp',
    memoryLimit: 100
  });
  const s3 = new AWS.S3(options.s3Options);
  const memoryCache = cacheManager.caching({ store: 'memory', max: options.memoryLimit });
  const diskCache = cacheManager.caching({
    store: fsStore,
    maxsize: options.diskMaxSize,
    path: options.diskTmpDirectory,
    reviveBuffers: true,
    preventfill: true // prevent cache re-init while testing
  });
  const multiCache = cacheManager.multiCaching([memoryCache, diskCache]);

  const getBinaryObjectCached = (
    key,
    ttl = options.ttlDefault,
    bucket = options.bucket,
    modifications = []
  ) => multiCache.wrap(key, () => [
    data => data.Body,
    ...modifications
  ].reduce(
    (p, c) => p.then(c),
    s3.getObject({ Bucket: bucket, Key: key }).promise()
  ), { ttl });

  return {
    getBinaryObjectCached,
    getTextObjectCached: (key, ttl, bucket) => getBinaryObjectCached(key, ttl, bucket, [
      body => body.toString()
    ]),
    getJsonObjectCached: (key, ttl, bucket) => getBinaryObjectCached(key, ttl, bucket, [
      body => body.toString(),
      JSON.parse
    ]),
    getDeflatedObjectCached: (key, ttl, bucket) => getBinaryObjectCached(key, ttl, bucket, [
      zlib.gunzipSync
    ])
  };
};

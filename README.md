# Cached S3 Wrapper

[![Build Status](https://circleci.com/gh/blackflux/s3-cached.png?style=shield)](https://circleci.com/gh/blackflux/s3-cached)
[![Test Coverage](https://img.shields.io/coveralls/blackflux/s3-cached/master.svg)](https://coveralls.io/github/blackflux/s3-cached?branch=master)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=blackflux/s3-cached)](https://dependabot.com)
[![Dependencies](https://david-dm.org/blackflux/s3-cached/status.svg)](https://david-dm.org/blackflux/s3-cached)
[![NPM](https://img.shields.io/npm/v/s3-cached.svg)](https://www.npmjs.com/package/s3-cached)
[![Downloads](https://img.shields.io/npm/dt/s3-cached.svg)](https://www.npmjs.com/package/s3-cached)
[![Semantic-Release](https://github.com/blackflux/js-gardener/blob/master/assets/icons/semver.svg)](https://github.com/semantic-release/semantic-release)
[![Gardener](https://github.com/blackflux/js-gardener/blob/master/assets/badge.svg)](https://github.com/blackflux/js-gardener)

S3 File Access Abstraction providing Memory and Disk Caching Layer. Useful e.g. in lambda functions if you want to reduce the amount of s3 access for serving (semi-)static files.

## What it does

- Access abstraction to access JSON and GZipped data on AWS S3
- Two Layer caching (memory and disk)
- Allows you to define cache constraints like TTL

# Getting Started

### Install

    $ npm install --save s3-cached

### Request S3 Files

<!-- eslint-disable import/no-extraneous-dependencies, import/no-unresolved -->
```javascript
const s3 = require('s3-cached')({
  bucket: 'YOUR_BUCKET_NAME',
  s3Options: {
    accessKeyId: 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY'
  }
});

s3.getJsonObjectCached('large.json').then((json) => {
  // do something with the json data
}).catch((err) => {
  // there has been an error
});
```

# Available functions

- `getBinaryObjectCached`: retrieve file content, caching additional modifications possible through parameter
- `getTextObjectCached`: retrieve file content as string and return as promise
- `getJsonObjectCached`: retrieve file content as string, parse as json and return as promise
- `getGzipObjectCached`: retrieve file content, gunzip and return as promise
- `getKeysCached`: retrieve all file names in bucket with given prefix

Note that you can specify the ttl and/or custom bucket on a per file basis by calling 
e.g. `s3.getJsonObjectCached(FILE_NAME, { ttl, bucket })`. For exact method signatures please check the code.

## Other Function / Exports

- `resetCache()`: Reset everything in cache
- `aws`: The underlying [aws-sdk-wrap](https://www.npmjs.com/package/aws-sdk-wrap) instance

# Options

### bucket

Type: `string`<br>
Default: `undefined`

Specify the Bucket name you want to retrieve data from. It either has to be defined here or on every request (overwrites).

### s3Options

Type: `object`<br>
Default: -

Passed into [aws-wrap-sdk](https://github.com/blackflux/aws-sdk-wrap) for `AWS.S3()` initialization.

### logger

Type: `logger`<br>
Default: `null`

Passed into [aws-wrap-sdk](https://github.com/blackflux/aws-sdk-wrap).

### ttl

Type: `integer`<br>
Default: `600`

Define how long a cached file is kept by default. *This can be overwritten on a per-file basis* by passing a second parameter into the function.

### memoryLimit

Type: `integer`<br>
Default: `100`

Define how many cached entities can be hold in memory at the same time. If more entities are present, the earliest are discarded from memory cache.

### diskMaxSize

Type: `integer`<br>
Default: `469762048`

Maximum amount of disk space in bytes used by disk cache. Earliest files are discarded from file cache if more space is used.

### diskTmpDirectory

Type: `string`<br>
Default: `/tmp`

Location to store temporary data for disk cache.

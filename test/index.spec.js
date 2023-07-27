import fs from 'smart-fs';
import path from 'path';
import { expect } from 'chai';
import { describe } from 'node-tdd';
import AwsSdkWrap from 'aws-sdk-wrap';
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import S3Cached from '../src/index.js';

describe('Testing S3-Cached', {
  useNock: true,
  nockStripHeaders: true
}, () => {
  let s3Cached;
  before(() => {
    s3Cached = S3Cached({
      bucket: process.env.S3_BUCKET_NAME,
      awsSdkWrap: AwsSdkWrap({
        services: {
          S3: S3Client,
          'S3:CMD': {
            GetObjectCommand,
            ListObjectsV2Command
          }
        }
      })
    });
  });
  afterEach(async () => {
    await s3Cached.resetCache();
  });

  it('Testing S3Cached exports', () => {
    expect(Object.keys(s3Cached)).to.deep.equal([
      'getKeysCached',
      'getBinaryObjectCached',
      'getTextObjectCached',
      'getJsonObjectCached',
      'getGzipObjectCached',
      'resetCache'
    ]);
  });

  it('Testing JSON Not Found', async ({ capture }) => {
    const e = await capture(() => s3Cached.getJsonObjectCached('unknown-file.json'));
    expect(['The specified key does not exist.', 'Access Denied']).to.contain(e.message);
  });

  it('Testing Invalid JSON', async ({ capture }) => {
    const e = await capture(() => s3Cached.getJsonObjectCached('invalid.json'));
    expect(e.name).to.equal('SyntaxError');
  });

  it('Testing Binary', async () => {
    const r = await s3Cached.getBinaryObjectCached('large.bin');
    expect(r).to.deep.equal(fs.readFileSync(path.join(fs.dirname(import.meta.url), 'files', 'large.bin')));
  });

  it('Testing Text', async () => {
    const r = await s3Cached.getTextObjectCached('large.txt');
    expect(r).to.match(/^Lorem ipsum dolor/);
    expect(r).to.match(/lacinia mauris\.\n$/);
    expect(r).to.contain('condimentum ultricies');
  });

  it('Testing JSON', async () => {
    const r = await s3Cached.getJsonObjectCached('large.json');
    expect(r[0].tags).to.include('anim');
    expect(r[1].friends[2].name).to.equal('Susanne Alvarez');
  });

  it('Testing GZIP', async () => {
    const r = await s3Cached.getGzipObjectCached('large.json.gz')
      .then((s) => JSON.parse(s));
    expect(r[0].tags).to.include('anim');
    expect(r[1].friends[2].name).to.equal('Susanne Alvarez');
  });

  it('Testing Key Listing', async () => {
    const r = await s3Cached.getKeysCached();
    expect(r.length).to.equal(1124);
    expect(r[0]).to.deep.equal({
      Key: 'bspl0001.c',
      LastModified: new Date('2018-08-09T19:11:06.000Z'),
      ETag: '"d41d8cd98f00b204e9800998ecf8427e"',
      Size: 0,
      StorageClass: 'STANDARD'
    });
  });

  it('Test Response is Cached', async () => {
    // (!) cassette has one request
    await s3Cached.getTextObjectCached('large.txt');
    await s3Cached.getTextObjectCached('large.txt');
  });

  it('Test Cache Reset', async () => {
    // (!) cassette has two requests
    await s3Cached.getTextObjectCached('large.txt');
    await s3Cached.resetCache();
    await s3Cached.getTextObjectCached('large.txt');
  });
});

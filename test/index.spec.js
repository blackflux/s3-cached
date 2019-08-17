const fs = require('fs');
const path = require('path');
const expect = require('chai').expect;
const { describe } = require('node-tdd');
const S3Cached = require('./../src/index');

describe('Testing S3-Cached', { useNock: true }, () => {
  let s3Cached;
  before(() => {
    s3Cached = S3Cached({ bucket: process.env.S3_BUCKET_NAME });
  });

  afterEach(async () => {
    await s3Cached.resetCache();
  });

  it('Testing JSON Not Found', async () => {
    try {
      await s3Cached.getJsonObjectCached('unknown-file.json');
    } catch (e) {
      expect(['The specified key does not exist.', 'Access Denied']).to.contain(e.message);
    }
  });

  it('Testing Invalid JSON', async () => {
    try {
      await s3Cached.getJsonObjectCached('invalid.json');
    } catch (e) {
      expect(e.message).to.equal('Unexpected token \u001f in JSON at position 0');
    }
  });

  it('Testing Binary', async () => {
    const r = await s3Cached.getBinaryObjectCached('large.bin');
    expect(r).to.deep.equal(fs.readFileSync(path.join(__dirname, 'files', 'large.bin')));
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
    const r = await s3Cached.getDeflatedObjectCached('large.json.gz')
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

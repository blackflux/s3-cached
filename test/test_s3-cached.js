const path = require("path");
const expect = require("chai").expect;
const nockBack = require('nock').back;
const s3 = require("./../lib/s3-cached")({
  bucket: 's3-cached-test-bucket'
});

nockBack.setMode('record');
nockBack.fixtures = path.join(__dirname, "__cassette");

describe("Testing S3-Cached", () => {
  it("Testing JSON", (done) => {
    nockBack(`test_json.json_recording.json`, {}, (nockDone) => {
      s3.getJsonObjectCached("large.json").then((json) => {
        expect(json[0].tags).to.include("anim");
        expect(json[1].friends[2].name).to.equal("Susanne Alvarez");
        nockDone();
        done();
      });
    });
  });

  it("Testing GZIP", (done) => {
    nockBack(`test_gzip.json_recording.json`, {}, (nockDone) => {
      // Important: There is currently a bug in Nock, which requires us to add gzip content type
      // manually into  the recorded files. Reference: https://github.com/node-nock/nock/issues/1001
      s3.getDeflatedObjectCached("large.json.gz").then((r) => {
        const json = JSON.parse(r);
        expect(json[0].tags).to.include("anim");
        expect(json[1].friends[2].name).to.equal("Susanne Alvarez");
        nockDone();
        done();
      });
    });
  });
});

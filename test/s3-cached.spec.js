const fs = require("fs");
const path = require("path");
const expect = require("chai").expect;
const nockBack = require('nock').back;
const get = require('lodash.get');
const AWS = require("aws-sdk");
const s3 = require("./../src/s3-cached")({
  // Temporarily fill in your own bucket to record tests and place any used files in assets folder.
  // When done restore bucket name and replace bucket name in cassette files
  bucket: "dummy-bucket-name"
});

// dummy credentials are required for mock since AWS raises "Missing credentials" if non are found
process.env.AWS_ACCESS_KEY_ID = get(AWS, 'config.credentials.accessKeyId', "DUMMY");
process.env.AWS_SECRET_ACCESS_KEY = get(AWS, 'config.credentials.secretAccessKey', "DUMMY");

nockBack.setMode('record');
nockBack.fixtures = path.join(__dirname, "__cassette");

describe("Testing S3-Cached", () => {
  it("Testing JSON Not Found", (done) => {
    nockBack(`unknown-file.json_recording.json`, {}, (nockDone) => {
      s3.getJsonObjectCached("unknown-file.json").catch((err) => {
        expect(["The specified key does not exist.", "Access Denied"]).to.contain(err.message);
        nockDone();
        done();
      });
    });
  });

  it("Testing Invalid JSON", (done) => {
    nockBack(`invalid.json_recording.json`, {}, (nockDone) => {
      s3.getJsonObjectCached("invalid.json").catch((err) => {
        expect(err.message).to.equal("Unexpected token \u001f in JSON at position 0");
        nockDone();
        done();
      });
    });
  });

  it("Testing Binary", (done) => {
    nockBack(`large.bin_recording.json`, {}, (nockDone) => {
      s3.getBinaryObjectCached("large.bin").then((data) => {
        expect(data).to.deep.equal(fs.readFileSync(path.join(__dirname, "files", "large.bin")));
        nockDone();
        done();
      }).catch(done.fail);
    });
  });

  it("Testing Text", (done) => {
    nockBack(`large.text_recording.json`, {}, (nockDone) => {
      s3.getTextObjectCached("large.txt").then((text) => {
        expect(text).to.match(/^Lorem ipsum dolor/);
        expect(text).to.match(/lacinia mauris\.\n$/);
        expect(text).to.contain("condimentum ultricies");
        nockDone();
        done();
      }).catch(done.fail);
    });
  });

  it("Testing JSON", (done) => {
    nockBack(`large.json_recording.json`, {}, (nockDone) => {
      s3.getJsonObjectCached("large.json").then((json) => {
        expect(json[0].tags).to.include("anim");
        expect(json[1].friends[2].name).to.equal("Susanne Alvarez");
        nockDone();
        done();
      }).catch(done.fail);
    });
  });

  it("Testing GZIP", (done) => {
    nockBack(`large.json.gz_recording.json`, {}, (nockDone) => {
      // Important: There is currently a bug in Nock, which requires us to add gzip content type
      // manually into  the recorded files. Reference: https://github.com/node-nock/nock/issues/1001
      s3.getDeflatedObjectCached("large.json.gz").then((r) => {
        const json = JSON.parse(r);
        expect(json[0].tags).to.include("anim");
        expect(json[1].friends[2].name).to.equal("Susanne Alvarez");
        nockDone();
        done();
      }).catch(done.fail);
    });
  });

  it("Testing Key Listing", (done) => {
    nockBack(`keysList.json.gz_recording.json`, {}, (nockDone) => {
      s3.getKeysCached().then((r) => {
        expect(r.length).to.equal(1124);
        expect(r[0]).to.deep.equal({
          Key: 'bspl0001.c',
          LastModified: new Date("2018-08-09T19:11:06.000Z"),
          ETag: '"d41d8cd98f00b204e9800998ecf8427e"',
          Size: 0,
          StorageClass: 'STANDARD'
        });
        nockDone();
        done();
      }).catch(done.fail);
    });
  });
});

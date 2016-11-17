/* eslint-env mocha */

const flatpakBundler = require('..')

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')

const outputPath = path.join(__dirname, 'out')
const refsPath = path.join(__dirname, '..', 'refs')

describe('flatpak-bundler', function () {
  describe('bundle', function () {
    this.timeout(30000)

    before(function (done) {
      rimraf(outputPath, done)
      fs.mkdirSync(outputPath)
    })

    it('creates a flatpak', function (done) {
      const binPath = path.join(outputPath, 'hello')
      const flatpakPath = path.join(outputPath, 'hello.flatpak')
      const runtimeRefPath = path.join(refsPath, 'freedesktop-runtime-1.4.flatpakref')

      fs.writeFileSync(binPath,
      `#!/bin/bash
      echo "Hello, world!"`, { mode: 0o755 })

      flatpakBundler.bundle({
        id: 'org.world.Hello',
        runtime: 'org.freedesktop.Platform',
        runtimeVersion: '1.4',
        runtimeFlatpakref: runtimeRefPath,
        sdk: 'org.freedesktop.Sdk',
        files: [
          [binPath, '/bin/hello']
        ]
      }, {
        bundlePath: flatpakPath
      }, function (error) {
        if (error) return done(error)
        assert(fs.existsSync(flatpakPath))
        done()
      })
    })

    after(function (done) {
      rimraf(outputPath, done)
    })
  })
})

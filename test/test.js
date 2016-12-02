/* eslint-env mocha */

const flatpakBundler = require('..')

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')

const outputPath = path.join(__dirname, 'out')
const refsPath = path.join(__dirname, '..', 'refs')
const binPath = path.join(outputPath, 'hello')
const flatpakPath = path.join(outputPath, 'hello.flatpak')
const runtimeRefPath = path.join(refsPath, 'freedesktop-runtime-1.4.flatpakref')

describe('flatpak-bundler', function () {
  describe('bundle', function () {
    this.timeout(30000)

    beforeEach(function (done) {
      rimraf(outputPath, done)
      fs.mkdirSync(outputPath)
      fs.writeFileSync(binPath,
      `#!/bin/bash
      echo "Hello, world!"`, { mode: 0o755 })
    })

    it('creates a flatpak', function (done) {
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

    it('accepts dash variants', function (done) {
      flatpakBundler.bundle({
        'id': 'org.world.Hello',
        'runtime': 'org.freedesktop.Platform',
        'runtime-version': '1.4',
        'runtime-flatpakref': runtimeRefPath,
        'sdk': 'org.freedesktop.Sdk',
        'files': [
          [binPath, '/bin/hello']
        ]
      }, {
        'bundle-path': flatpakPath
      }, function (error) {
        if (error) return done(error)
        assert(fs.existsSync(flatpakPath))
        done()
      })
    })

    it('recognizes a node style arch', function (done) {
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
        arch: 'x64',
        bundlePath: flatpakPath
      }, function (error) {
        if (error) return done(error)
        assert(fs.existsSync(flatpakPath))
        done()
      })
    })

    afterEach(function (done) {
      rimraf(outputPath, done)
    })
  })
})

'use strict'

const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')
const quote = require('shell-quote').quote
const util = require('util')

const pkg = require('./package.json')
const logger = require('debug')(pkg.name)

const promisify = require('es6-promisify')
const writeFile = promisify(fs.writeFile)
const mkdirs = promisify(fs.mkdirs)
const exec = promisify(require('child_process').exec, { multiArgs: true })
const tmpdir = promisify(require('tmp').dir)

function kebabify (object) {
  return _.cloneDeepWith(object, (value) => {
    if (!value || typeof value !== 'object') return value

    return Object.keys(value).reduce(function (newValue, key) {
      newValue[_.kebabCase(key)] = value[key]
      return newValue
    }, {})
  })
}

function execAndLog (options, args) {
  let command = quote(args)
  return exec(command, { cwd: options['working-dir'] })
    .then(function (output) {
      logger(command)
      if (output[0]) logger('stdout ->\n' + output[0])
      if (output[1]) logger('stderr ->\n' + output[1])
    })
}

function addCommandLineOption (args, name, value) {
  if (!value) return

  if (value === true) {
    args.push(util.format('--%s', name))
    return
  }

  args.push(util.format('--%s=%s', name, value))
}

function getOptionsWithDefaults (options) {
  let defaults = {
    'build-dir': path.join(options['working-dir'], 'build'),
    'repo-dir': path.join(options['working-dir'], 'repo'),
    'manifest-path': path.join(options['working-dir'], 'manifest.json'),
    'extra-flatpak-builder-args': [],
    'extra-flatpak-build-bundle-args': []
  }
  options = _.defaults({}, options, defaults)
  options['working-dir'] = path.resolve(options['working-dir'])
  options['build-dir'] = path.resolve(options['build-dir'])
  options['repo-dir'] = path.resolve(options['repo-dir'])
  options['manifest-path'] = path.resolve(options['manifest-path'])
  options['bundle-path'] = path.resolve(options['bundle-path'])
  return options
}

function getManifestWithDefaults (manifest) {
  let defaults = {
    'branch': 'master',
    'sdk': 'org.freedesktop.Sdk',
    'runtime': 'org.freedesktop.Platform',
    'modules': [],
    'files': [],
    'symlinks': []
  }
  if (typeof manifest['runtime'] === 'undefined') {
    defaults['runtime-version'] = '1.4'
  }
  return _.defaults({}, manifest, defaults)
}

function addManfiestFilesAndLinks (options, manifest) {
  let commands = []
  for (let sourceDest of manifest['files']) {
    let source = path.resolve(sourceDest[0])
    let dest = path.join('/app', sourceDest[1])
    let dir = dest
    if (!_.endsWith(dir, path.sep)) dir = path.dirname(dir)
    commands.push(quote(['mkdir', '-p', dir]))
    commands.push(quote(['cp', '-r', source, dest]))
  }
  for (let targetDest of manifest['symlinks']) {
    let target = path.join('/app', targetDest[0])
    let dest = path.join('/app', targetDest[1])
    let dir = path.dirname(dest)
    commands.push(quote(['mkdir', '-p', dir]))
    commands.push(quote(['ln', '-s', target, dest]))
  }
  // This is kinda gross, but at the moment flatpak won't accept a source that
  // includes no make or cmake files. Include a minimal Makefile
  commands.push('echo "all:\ninstall:\n" > Makefile')
  let module = {
    'name': [pkg.name, 'files'].join('-'),
    'no-autogen': true,
    'build-options': {
      'build-args': [
        '--filesystem=' + options['working-dir'],
        '--filesystem=host'
      ]
    },
    'sources': [
      {
        'type': 'shell',
        'commands': commands
      }
    ]
  }
  manifest['modules'].push(module)
  delete manifest['files']
  delete manifest['symlinks']
}

function ensureWorkingDir (options) {
  if (!options['working-dir']) {
    return tmpdir({ dir: '/var/tmp', unsafeCleanup: true })
      .then(function (dir) {
        options['working-dir'] = dir
      })
  } else {
    return mkdirs(options['working-dir'])
  }
}

function writeJsonFile (options, manifest) {
  return writeFile(options['manifest-path'], JSON.stringify(manifest, null, '  '))
}

function flatpakBuilder (options) {
  let args = ['flatpak-builder']
  addCommandLineOption(args, 'arch', options['arch'])
  addCommandLineOption(args, 'gpg-sign', options['gpg-sign'])
  addCommandLineOption(args, 'gpg-homedir', options['gpg-homedir'])
  addCommandLineOption(args, 'subject', options['subject'])
  addCommandLineOption(args, 'body', options['body'])
  addCommandLineOption(args, 'repo', options['repo-dir'])
  addCommandLineOption(args, 'force-clean', true)
  args.concat(options['extra-flatpak-builder-args'])

  args.push(options['build-dir'])
  args.push(options['manifest-path'])
  return execAndLog(options, args)
}

function flatpakBuildBundle (options, manifest) {
  if (!options['bundle-path']) return

  let args = ['flatpak', 'build-bundle']
  addCommandLineOption(args, 'arch', options['arch'])
  addCommandLineOption(args, 'gpg-sign', options['gpg-sign'])
  addCommandLineOption(args, 'gpg-homedir', options['gpg-homedir'])
  addCommandLineOption(args, 'repo-url', options['bundle-repo-url'])
  if (options['build-runtime']) addCommandLineOption(args, 'runtime', true)
  args.concat(options['extra-flatpak-build-bundle-args'])

  args.push(options['repo-dir'])
  args.push(options['bundle-path'])
  args.push(manifest['id'])
  args.push(manifest['branch'])
  return mkdirs(path.dirname(options['bundle-path']))
    .then(function () {
      return execAndLog(options, args)
    })
}

exports.bundle = function (manifest, options, callback) {
  manifest = kebabify(manifest)
  options = kebabify(options)

  return ensureWorkingDir(options)
    .then(() => {
      options = getOptionsWithDefaults(options)
      manifest = getManifestWithDefaults(manifest)
      addManfiestFilesAndLinks(options, manifest)

      logger('Using manifest ->\n' + JSON.stringify(manifest, null, '  '))
      logger('Using options ->\n' + JSON.stringify(options, null, '  '))
    })
    .then(() => writeJsonFile(options, manifest))
    .then(() => flatpakBuilder(options))
    .then(() => flatpakBuildBundle(options, manifest))
    .then(function () {
      callback(null, options, manifest)
    }, function (error) {
      callback(error)
    })
}

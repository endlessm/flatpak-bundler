'use strict'

const _ = require('lodash')
const fs = require('fs-extra')
const ini = require('ini')
const path = require('path')
const util = require('util')

const pkg = require('./package.json')
const logger = require('debug')(pkg.name)

const promisify = require('es6-promisify')
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const copy = promisify(fs.copy)
const move = promisify(fs.move)
const remove = promisify(fs.remove)
const symlink = promisify(fs.symlink)
const readdir = promisify(fs.readdir)
const mkdirs = promisify(fs.mkdirs)
const recursiveReaddir = promisify(require('recursive-readdir'))
const exec = promisify(require('child_process').exec, { multiArgs: true })
const tmpdir = promisify(require('tmp').dir)

function execAndLog (command) {
  logger(command)
  return exec(command)
    .then(function (output) {
      if (output[0]) logger('stdout ->\n' + output[0])
      if (output[1]) logger('stderr ->\n' + output[1])
    })
}

function addCommandLineOption (args, name, value) {
  if (!value) return

  args.push(util.format('--%s=%s', name, value))
}

function getOptionsWithDefaults (options) {
  return _.defaults({}, options, {
    branch: 'master',
    sdk: 'org.freedesktop.Sdk',
    runtime: 'org.freedesktop.Platform',
    finishArgs: [],
    symlinks: [],
    renameFiles: true
  })
}

function ensureDirectories (options) {
  let dirs = []
  if (!options.buildDir) {
    let makeDir = tmpdir()
      .then(function (dir) {
        options.buildDir = dir
      })
    dirs.push(makeDir)
  } else {
    dirs.push(remove(options.buildDir))
  }
  if (!options.repoDir) {
    let makeDir = tmpdir()
      .then(function (dir) {
        options.repoDir = dir
      })
    dirs.push(makeDir)
  }
  return Promise.all(dirs).then(function () {
    logger('Using arguments ->\n' + JSON.stringify(options, null, '  '))
    return options
  })
}

function flatpakBuildInit (options) {
  let args = ['flatpak build-init']
  addCommandLineOption(args, 'arch', options.arch)
  args.push(options.buildDir)
  args.push(options.id)
  args.push(options.sdk)
  args.push(options.runtime)
  args.push(options.runtimeVersion)
  return execAndLog(args.join(' '))
    .then(function () {
      return options
    })
}

function copyInFiles (options) {
  let copies = _.map(options.files, function (item) {
    let source = item[0]
    let dest = path.join(options.buildDir, 'files', item[1])
    let destDir = dest.substring(0, dest.lastIndexOf(path.sep))
    logger('Copying ' + source + ' -> ' + dest)
    return mkdirs(destDir)
      .then(function () {
        return copy(source, dest)
      })
  })
  return Promise.all(copies)
    .then(function () {
      return options
    })
}

function renameFiles (options) {
  if (!options.renameFiles) return options

  let applicationsDir = path.join(options.buildDir, 'files', 'share', 'applications')
  let iconsDir = path.join(options.buildDir, 'files', 'share', 'icons')

  function findDesktopFile () {
    return readdir(applicationsDir)
      .then(function (desktopPaths) {
        desktopPaths = desktopPaths.filter(function (desktopPath) {
          return path.extname(desktopPath) === '.desktop'
        })
        if (desktopPaths.length !== 1) return

        return path.join(applicationsDir, desktopPaths[0])
      }).catch(function (error) {
        if (error.code !== 'ENOENT') throw error
      })
  }

  function renameDesktopFile (desktopPath) {
    if (!desktopPath) return
    let newDesktopPath = path.join(applicationsDir, options.id + '.desktop')
    if (desktopPath === newDesktopPath) return

    logger('Renaming desktop file ' + desktopPath + ' -> ' + newDesktopPath)
    return move(desktopPath, newDesktopPath)
      .then(function () {
        return newDesktopPath
      })
  }

  function rewriteDesktopFile (desktopPath) {
    if (!desktopPath) return

    return readFile(desktopPath, 'utf-8')
      .then(function (contents) {
        let data = ini.parse(contents)
        if (!('Desktop Entry' in data)) return
        let iconName = data['Desktop Entry']['Icon']
        if (iconName === options.id) return
        contents = contents.replace('Icon=' + iconName, 'Icon=' + options.id)
        return writeFile(desktopPath, contents).then(function () {
          return iconName
        })
      })
  }

  function renameIcons (iconName) {
    if (!iconName) return

    return recursiveReaddir(iconsDir)
      .then(function (iconPaths) {
        let moves = []
        _.map(iconPaths, function (iconPath) {
          let dir = path.dirname(iconPath)
          let oldname = path.basename(iconPath)
          let newname = oldname.replace(iconName, options.id)
          if (newname === oldname) return
          let newPath = path.join(dir, newname)
          logger('Renaming icon file ' + iconPath + ' -> ' + newPath)
          moves.push(move(iconPath, newPath))
        })
        return Promise.all(moves)
      })
  }

  return findDesktopFile()
    .then(renameDesktopFile)
    .then(rewriteDesktopFile)
    .then(renameIcons)
    .then(function () {
      return options
    })
}

function createSymlinks (options) {
  let links = _.map(options.symlinks, function (item) {
    let target = path.join('/app', item[0])
    let linkpath = path.join(options.buildDir, 'files', item[1])
    let dir = path.dirname(linkpath)
    return mkdirs(dir)
      .then(function () {
        symlink(target, linkpath)
      })
  })
  return Promise.all(links)
    .then(function () {
      return options
    })
}

function flatpakBuildFinish (options) {
  let args = ['flatpak build-finish']
  addCommandLineOption(args, 'command', options.command)
  args = args.concat(options.finishArgs)
  args.push(options.buildDir)
  return execAndLog(args.join(' '))
    .then(function () {
      return options
    })
}

function flatpakBuildExport (options) {
  let args = ['flatpak build-export']
  addCommandLineOption(args, 'arch', options.arch)
  addCommandLineOption(args, 'gpg-sign', options.gpgSign)
  addCommandLineOption(args, 'gpg-homedir', options.gpgHomedir)
  addCommandLineOption(args, 'subject', options.subject)
  addCommandLineOption(args, 'body', options.body)
  args.push(options.repoDir)
  args.push(options.buildDir)
  args.push(options.branch)
  return execAndLog(args.join(' '))
    .then(function () {
      return options
    })
}

function flatpakBuildBundle (options) {
  if (!options.bundlePath) return options

  let args = ['flatpak build-bundle']
  addCommandLineOption(args, 'arch', options.arch)
  addCommandLineOption(args, 'gpg-sign', options.gpgSign)
  addCommandLineOption(args, 'gpg-homedir', options.gpgHomedir)
  args.push(options.repoDir)
  args.push(options.bundlePath)
  args.push(options.id)
  args.push(options.branch)
  return mkdirs(path.dirname(options.bundlePath))
    .then(function () {
      return execAndLog(args.join(' '))
    })
    .then(function () {
      return options
    })
}

exports.bundle = function (options, callback) {
  if (!options.id) {
    callback(new Error('You need to specify an application id.'))
    return
  }
  if (!options.files) {
    callback(new Error('You need to specify some application files.'))
    return
  }

  options = getOptionsWithDefaults(options)

  ensureDirectories(options)
    .then(flatpakBuildInit)
    .then(copyInFiles)
    .then(renameFiles)
    .then(createSymlinks)
    .then(flatpakBuildFinish)
    .then(flatpakBuildExport)
    .then(flatpakBuildBundle)
    .then(function (options) {
      callback(null, options)
    }, function (error) {
      callback(error)
    })
}

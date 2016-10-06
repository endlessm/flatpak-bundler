# flatpak-bundler
Build [flatpaks](http://flatpak.org/) from nodejs.

# Quick Start

Install flatpak-bundler and the freedesktop runtime.
```shell
$ npm install flatpak-bundler -g
$ wget https://sdk.gnome.org/keys/gnome-sdk.gpg
$ flatpak remote-add --gpg-import=gnome-sdk.gpg gnome https://sdk.gnome.org/repo/
flatpak install gnome org.freedesktop.Platform 1.4
```

[Build a flatpak](#hello-world).

Install and run it!
```shell
$ flatpak install --bundle hello.flatpak
$ flatpak run org.world.Hello
```

## Overview
This modules allows building flatpaks programatically from node. It requires
flatpak to be installed on your system.

Under the hood, this is just a wrapper for the `flatpak-builder` tool with some
extra sugar added. Complete documentation of the `flatpak-builder` can be found
by running `man flatpak-builder`.

With `flatpak-builder` you specify a runtime, sandbox permissions and software
modules to build into you application, and build a flatpak from start to finish.
This module provides a few additional features

 - Supports exporting directly to the a single file flatpak bundle
 - Supports easy copying files and creating symlinks directly in `/app`

The latter is particularly useful for [electron](http://electron.atom.io/) and
[nw.js](http://nwjs.io/) style node applications, which often create packages
from prebuilt binaries and do not attempt to follow an autotools-like
[build api](https://github.com/cgwalters/build-api).

This module should make it easy to plug flatpak support into a electron or nw.js
app packaging phase.

## Usage

### bundle(manifest, buildOptions, callback)

`flatpak-bundler` provides a single method, `bundle`, which takes an app manifest,
a build options object, and a completion callback.

Both the manifest and options objects support both camelCase and dash-separated
variants of any option.

The callback with be called with an error followed by the finalized manifest
and buildOptions objects used, after default values have been applied.

### Manifest
The manifest argument will match the `flatpak-builder` manifest format exactly
with two extra options.
 - **files**: should be a list of source and dest tuples. Source should be a
   relative or absolute path to file or directory to copy into the flatpak, and
   dest should be a path to copy to within `/app` (e.g. `/share/applications/`)
 - **symlinks**: should be a list of target and path symlink tuples. Target can be
   either a relative or absolute path inside `/app`, and path should be a
   absolute path in `/app` to create the symlink at.

Other import manifest options
 - **id**: will default to the top level package.json homepage domain name + package name
 - **runtime**: will default to org.freedesktop.Platform
 - **sdk**: will default to org.freedesktop.Sdk
 - **finishArgs**: arguments to pass to `flatpak build-finish`. Use this to add sandbox permissions.
 - **modules**: if you need to build other software modules into you flatpak app (anything not
   already in your runtime), you can specify them here.

Run man `flatpak-builder` for a more thorough list of manifest options.

### Build Options
 - **arch**: the architecture to build the flatpak bundle for.
 - **workingDir**: the working directory to call `flatpak-builder` from. Defaults to a new tmp directory.
 - **buildDir**: the directory to build the application in. Defaults to `${workingDir}/build`
 - **repoDir**: the directory for a flatpak repo, can be used to publish to an existing repo. Defaults to `${workingDir}/repo`
 - **bundlePath**: output location for a single file version of the flatpak. If non supplied, the single file flatpak will not be created.
 - **bundleRepoUrl**: repo url for the single file bundle. Installing the bundle will automatically configure a remote for this URL.
 - **subject**: the single line subject to use for the flatpak repo commit message
 - **body**: the description to use for the flatpak repo commit message
 - **gpgSign**: the gpg key to use to sign the flatpak repo and bundle file
 - **gpgHomedir**: the gpg homedir to use when signing
 - **extraFlatpakBuilderArgs**: list of extra arguments to pass to the `flatpak-builder` command
 - **extraFlatpakBuildBundleArgs**: list of extra arguments to pass to the `flatpak-builder` command

### Logging
To turn on debugging output set the DEBUG environment variable
```
DEBUG=flatpak-bundler npm run my-flatpak-command
```

## Examples

#### Hello world

```js
// Write a hello world script to disk
const fs = require('fs')
fs.writeFileSync('hello',
`#!/bin/bash
echo "Hello, world!"`, { mode: 0o755 })

// Make a flapak with it!
const flatpakBundler = require('flatpak-bundler')
flatpakBundler.bundle({
  id: 'org.world.Hello',
  files: [
    ['hello', '/bin/hello']
  ],
}, {
  bundlePath: 'hello.flatpak'
}, function (error) {
  if (error) {
    console.error('Error building flatpak', error)
    return
  }
  console.log('Flatpak built successfully')
})
```

#### Electron app

```js
const flatpakBundler = require('flatpak-bundler')

flatpakBundler.bundle({ // Manifest
  id: 'org.world.Hello',
  runtime: 'io.atom.electron.Platform', // Use the electron runtime
  sdk: 'io.atom.electron.Sdk',
  files: [
    [ 'static/linux', '/share/' ], // Desktop file and icons
    [ packagedFileDir, '/share/bar' ] // Application binaries and assets
  ],
  symlinks: [
    [ '/share/bar/Bar', '/bin/Bar' ] // Create a symlink in /bin to to app executable
  ],
  finishArgs: [
    '--share=ipc', '--socket=x11', // Allow app to show windows with X11
    '--socket=pulseaudio', // Allow audio output
    '--filesystem=home:rw', // Allow access to users home directory
    '--share=network', // Allow network access
    '--device=dri' // Allow OpenGL rendering
  ],
  renameDesktopFile: 'hello.desktop', // Rename the desktop file to agree with the app id so flatpak will export it
  renameIcon: 'hello', // Rename the icon to agree with the app id so flatpak will support it
}, { // Build options
  arch: 'x86_64',
  bundlePath: 'dist/hello_x86_64.flatpak',
  gpgSign: '1234ABCD' // Gpg key to sign with
}, function (error, finalAppOptions, finalBuildOptions) { // Callback
  if (error) {
    console.error('Error building flatpak')
    console.error(error)
    return
  }
  console.log('Flatpak built successfully.')
  console.log('Build dir and repo in ' + finalBuildOptions.workingDir)
})
```

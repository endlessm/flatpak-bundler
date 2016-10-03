# flatpak-bundler
Node module for creating flatpaks.

## Overview

This is a tool for creating a flatpak application from start to finish. It is
similar to the `flatpak-builder` shipped with flatpak, with a few key
differences...

 - It's callable programatically from node
 - Will export directly to the flatpak single file format
 - Does not require targeted runtime and sdk to be installed on the build system
 - Does not attempt to build inside the sandbox, rather moves prebuilt binaries into a flatpak build directory

The last bullet point is the key difference from `flatpak-builder`. This tool is
best for app build systems which take prebuilt binaries and files and target a
number of package formats at once. This is common in electron and nw.js workflows.

To actual build node native modules and other applications dependencies inside
the flatpak sandbox, `flatpak-builder` is probably the better tool.

## API

Currently this module can only be called directly from node, though a command
line version is planned.

#### Usage
flatpak-bundler provides a single method, `bundle`, which takes in a options
object and a completion callback.

```
flatpakBundler = imports('flatpak-bundler')
flatpakBundler.bundle({
  id: 'com.foo.bar',
  files: [
    binScriptPath, 'bin/bar'
  ],
  bundlePath: 'dist/bar.flatpak'
}, function (error, finalOptions) {
  if (error) {
    console.error('Error building flatpak')
    console.error(error)
    return
  }
  console.log('Flatpak built successfully at ' + finalOptions.bundlePath);
})
```

#### Logging
To turn on debugging output set the DEBUG environment variable
```
DEBUG=flatpak-bundler npm run build
```

#### Options
There are a number of options which can be passed to the bundle command.

Flatpak metadata
 - **id**: the flatpak application id (required).
 - **branch**: the versions of the application to build. Defaults to `master`.
 - **runtime**: the flatpak runtime to run the application with. Defaults to `org.freedesktop.Runtime`.
 - **runtimeVersion**: the version of the flatpak runtime to target.
 - **sdk**: the flatpak sdk to run the application with. Defaults to `org.freedesktop.Sdk`.
 - **arch**: the architecture to build the flatpak bundle for.
 - **finishArgs**: arguments to pass to flatpak-build-finish. Use this to add sandbox permissions.

Flatpak contents
 - **files**: a list of source and destinations tuples of files to copy into the flatpak app.
 - **symlinks**: a list of target and path tuples of symlinks to create in the flatpak build dir.
 - **renameFiles**: if true, attempt to rename desktop and icons files so they can be exported by the flatpak. Defaults to true.
 - **command**: the path to the application executable. If non supplied the first found in `/app/bin/` will be used.

Flatpak build
 - **buildDir**: the directory to build the flatpak app in. If none supplied a tmp directory will be used.
 - **repoDir**: the flatpak repo directory to export the app to. If none supplied a tmp directory will be used.
 - **bundlePath**: the location for a single file version of the flatpak to be place. If non supplied, the single file version will not be created.
 - **subject**: the single line subject to use for the flatpak repo commit message
 - **body**: the description to use for the flatpak repo commit message
 - **gpgSign**: the gpg key to use to sign the flatpak repo and bundle file
 - **gpgHomedir**: the gpg homedir to use when signing

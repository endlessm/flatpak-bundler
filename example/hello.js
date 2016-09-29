var bundler = require('../index');

bundler.bundle({
    id: 'org.hello.world',
    files: [
        ['hello', 'bin/hello'],
    ],
    bundlePath: 'hello.flatpak',
}, function (err) {
    if (err)
        console.log(err);
    else
        console.log('Success');
});

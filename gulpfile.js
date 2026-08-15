const { src, dest } = require('gulp');

function buildNodeIcons() {
    return src('nodes/**/*.{png,svg}').pipe(dest('dist/nodes'));
}

function buildCredentialIcons() {
    return src('credentials/**/*.{png,svg}').pipe(dest('dist/credentials'));
}

exports['build:icons'] = require('gulp').parallel(buildNodeIcons, buildCredentialIcons);

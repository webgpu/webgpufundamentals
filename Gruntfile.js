/* eslint-disable @typescript-eslint/no-var-requires */
/*eslint-env node*/

'use strict';

process.on('unhandledRejection', up => {
  throw up;
});

const fs = require('fs');
const path = require('path');
const liveEditor = require('@gfxfundamentals/live-editor');
const fixLinks = require('./build/fix-links.js');
const liveEditorPath = path.dirname(require.resolve('@gfxfundamentals/live-editor'));

module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  const s_ignoreRE = /\.(md|py|sh|enc)$/i;
  function noMds(filename) {
    return !s_ignoreRE.test(filename);
  }

  const s_isMdRE = /\.md$/i;
  function mdsOnly(filename) {
    return s_isMdRE.test(filename);
  }

  function notFolder(filename) {
    return !fs.statSync(filename).isDirectory();
  }

  function noMdsNoFolders(filename) {
    return noMds(filename) && notFolder(filename);
  }

  grunt.initConfig({
    eslint: {
      lib: {
        src: [
          'webgpu/resources/*.js',
        ],
      },
      support: {
        src: [
          'Gruntfile.js',
          'build/js/build.js',
        ],
      },
      examples: {
        src: [
          'webgpu/*.html',
          'webgpu/lessons/resources/*.js',
          '!webgpu/lessons/resources/prettify.js',
          'webgpu/lessons/resources/*.html',
        ],
      },
    },
    copy: {
      main: {
        files: [
          { expand: false, src: '*', dest: 'out/', filter: noMdsNoFolders, },
          { expand: true, cwd: `${liveEditor.monacoEditor}/`, src: 'min/**', dest: 'out/monaco-editor/', nonull: true, },
          { expand: true, cwd: `${liveEditorPath}/src/`, src: '**', dest: 'out/webgpu/resources/', nonull: true, },
          { expand: true, src: 'webgpu/**', dest: 'out/', filter: noMds, },
          { expand: true, src: '3rdparty/**', dest: 'out/', },
        ],
      },
    },
    clean: [
      'out/**/*',
    ],
    buildlesson: {
      main: {
        files: [],
      },
    },
    watch: {
      main: {
        files: [
          'webgpu/**',
          '3rdparty/**',
          'node_modules/@gfxfundamentals/live-editor/src/**',
        ],
        tasks: ['copy'],
        options: {
          spawn: false,
        },
      },
      lessons: {
        files: [
          'webgpu/lessons/**/webgpu*.md',
        ],
        tasks: ['buildlesson'],
        options: {
          spawn: false,
        },
      },
    },
  });

  let changedFiles = {};
  const onChange = grunt.util._.debounce(function() {
    grunt.config('copy.main.files', Object.keys(changedFiles).filter(noMds).map((file) => {
      const copy = {
        src: file,
        dest: 'out/',
      };
      if (file.indexOf('live-editor') >= 0) {
        copy.cwd = `${path.dirname(file)}/`;
        copy.src = path.basename(file);
        copy.expand = true;
        copy.dest = 'out/webgpu/resources/';
      }
      return copy;
    }));
    grunt.config('buildlesson.main.files', Object.keys(changedFiles).filter(mdsOnly).map((file) => {
      return {
        src: file,
      };
    }));
    changedFiles = {};
  }, 200);
  grunt.event.on('watch', function(action, filepath) {
    changedFiles[filepath] = action;
    onChange();
  });

  const buildSettings = {
    outDir: 'out',
    baseUrl: 'https://webgpufundamentals.org',
    rootFolder: 'webgpu',
    lessonGrep: 'webgpu*.md',
    siteName: 'webgpufundamentals',
    siteThumbnail: 'webgpufundamentals.jpg',  // in rootFolder/lessons/resources
    templatePath: 'build/templates',
    owner: 'gfxfundamentals',
    repo: 'webgl-fundamentals',
    postHTMLFn: fixLinks,
    thumbnailOptions: {
      thumbnailBackground: 'webgpufundamentals-background.jpg',
      text: [
        {
          font: 'bold 100px lesson-font',
          verticalSpacing: 100,
          offset: [100, 120],
          textAlign: 'left',
          shadowOffset: [15, 15],
          strokeWidth: 15,
          textWrapWidth: 1000,
        },
        {
          font: 'bold 60px lesson-font',
          text: 'webgpufundamentals.org',
          verticalSpacing: 100,
          offset: [-100, -90],
          textAlign: 'right',
          shadowOffset: [8, 8],
          strokeWidth: 15,
          textWrapWidth: 1000,
          color: 'hsl(340, 100%, 70%)',
        },
      ],
    },
  };

  // just the hackiest way to get this working.
  grunt.registerMultiTask('buildlesson', 'build a lesson', function() {
    const filenames = new Set();
    this.files.forEach((files) => {
      files.src.forEach((filename) => {
        filenames.add(filename);
      });
    });
    const buildStuff = require('@gfxfundamentals/lesson-builder');
    const settings = Object.assign({}, buildSettings, {
      filenames,
    });
    const finish = this.async();
    buildStuff(settings).finally(finish);
  });

  grunt.registerTask('buildlessons', function() {
    const buildStuff = require('@gfxfundamentals/lesson-builder');
    const finish = this.async();
    buildStuff(buildSettings).finally(finish);
  });

  grunt.registerTask('build', ['clean', 'copy:main', 'buildlessons']);
  grunt.registerTask('buildwatch', ['build', 'watch']);

  grunt.registerTask('default', ['eslint', 'build']);
};


var fs = require('fs');
var pkg = require('./package');

var minor_version = pkg.version.replace(/\.(\d)*$/, '');
var major_version = pkg.version.replace(/\.(\d)*\.(\d)*$/, '');
var path = require('path');

function  rename_release (v) {
  return function (d, f) {
    var dest = path.join(d, f.replace(/(\.min)?\.js$/, '-'+ v + "$1.js"));
    return dest;
  };
}

module.exports = function(grunt) {
  grunt.initConfig({
    connect: {
      test: {
        options: {
          hostname: '0.0.0.0',
          port: 9999
        }
      },
      example: {
        options: {
          base:  "example",
          port: 3000
        }
      },
      example_https: {
        options: {
          base:  "example",
          port:  3000,
          protocol: 'https',
          hostname: '*',
          cert: fs.readFileSync(__dirname + '/test/https_test_certs/server.crt').toString(),
          key:  fs.readFileSync(__dirname + '/test/https_test_certs/server.key').toString(),
        }
      }
    },
    browserify: {
      dist: {
        files: {
          'build/auth0.js': ['standalone.js'],
        },
        options: {
          debug: true
        }
      }
    },
    uglify: {
      options: {
        ascii: true
      }, min: {
        files: {
          'build/auth0.min.js': ['build/auth0.js']
        }
      }
    },
    copy: {
      example: {
        files: {
          'example/auth0.js': 'build/auth0.js',
        }
      },
      release: {
        files: [
          { expand: true, flatten: true, src: 'build/*', dest: 'release/', rename: rename_release(pkg.version) },
          { expand: true, flatten: true, src: 'build/*', dest: 'release/', rename: rename_release(minor_version) },
          { expand: true, flatten: true, src: 'build/*', dest: 'release/', rename: rename_release(major_version) }
        ]
      }
    },
    clean: {
      build: ["release/", "build/", "example/auth0.js"],
    },
    watch: {
      another: {
        files: ['node_modules', 'standalone.js', 'lib/*.js'],
        tasks: ['build']
      }
    },
    exec: {
      'test-integration': {
        cmd: 'node_modules/.bin/zuul -- test/*.js',
        stdout: true,
        stderr: true
      },
      'test-phantom': {
        cmd: 'node_modules/.bin/zuul --phantom 9999 -- test/*.js',
        stdout: true,
        stderr: true
      }
    },
    /* Checks for outdated npm dependencies before release. */
    outdated: {
      release: {
        development: false
      }
    },
    s3: {
      options: {
        key:    process.env.S3_KEY,
        secret: process.env.S3_SECRET,
        bucket: process.env.S3_BUCKET,
        access: 'public-read',
        headers: {
          'Cache-Control': 'public, max-age=300',
        }
      },
      clean: {
        del: [
          {
            src:     'w2/auth0-' + pkg.version + '.js',
          },
          {
            src:     'w2/auth0-' + pkg.version + '.min.js',
          },
          {
            src:     'w2/auth0-' + major_version + '.js',
          },
          {
            src:     'w2/auth0-' + major_version + '.min.js',
          },
          {
            src:     'w2/auth0-' + minor_version + '.js',
          },
          {
            src:     'w2/auth0-' + minor_version + '.min.js',
          }
        ]
      },
      publish: {
        upload: [
          {
            src:  'release/*',
            dest: 'w2/',
            options: { gzip: false }
          }
        ]
      }
    },
    maxcdn: {
      purgeCache: {
        options: {
          companyAlias:   process.env.MAXCDN_COMPANY_ALIAS,
          consumerKey:    process.env.MAXCDN_CONSUMER_KEY,
          consumerSecret: process.env.MAXCDN_CONSUMER_SECRET,
          zone_id:        process.env.MAXCDN_ZONE_ID,
          method:         'delete'
        },
        files: [
          { dest:     'w2/auth0-' + pkg.version + '.min.js' },
          { dest:     'w2/auth0-' + pkg.version + '.js' },
          { dest:     'w2/auth0-' + major_version + '.js', },
          { dest:     'w2/auth0-' + major_version + '.min.js', },
          { dest:     'w2/auth0-' + minor_version + '.js', },
          { dest:     'w2/auth0-' + minor_version + '.min.js', }
        ],
      },
    }
  });

  // Loading dependencies
  for (var key in grunt.file.readJSON("package.json").devDependencies) {
    if (key !== "grunt" && key.indexOf("grunt") === 0) grunt.loadNpmTasks(key);
  }

  grunt.registerTask("build",         ["clean", "browserify:dist", "uglify:min", "copy:example"]);
  grunt.registerTask("example",       ["connect:example", "watch", "build"]);
  grunt.registerTask("example_https", ["connect:example_https", "watch", "build"]);

  grunt.registerTask("dev",           ["connect:test", "watch", "build"]);
  grunt.registerTask("integration",   ["exec:test-integration"]);
  grunt.registerTask("phantom",       ["exec:test-phantom"]);

  grunt.registerTask("cdn",           ["build", "copy:release", "s3","maxcdn:purgeCache"]);
};

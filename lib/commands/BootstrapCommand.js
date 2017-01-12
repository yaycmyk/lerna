"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _FileSystemUtilities = require("../FileSystemUtilities");

var _FileSystemUtilities2 = _interopRequireDefault(_FileSystemUtilities);

var _NpmUtilities = require("../NpmUtilities");

var _NpmUtilities2 = _interopRequireDefault(_NpmUtilities);

var _PackageUtilities = require("../PackageUtilities");

var _PackageUtilities2 = _interopRequireDefault(_PackageUtilities);

var _Command2 = require("../Command");

var _Command3 = _interopRequireDefault(_Command2);

var _async = require("async");

var _async2 = _interopRequireDefault(_async);

var _lodash = require("lodash.find");

var _lodash2 = _interopRequireDefault(_lodash);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BootstrapCommand = function (_Command) {
  _inherits(BootstrapCommand, _Command);

  function BootstrapCommand() {
    _classCallCheck(this, BootstrapCommand);

    return _possibleConstructorReturn(this, (BootstrapCommand.__proto__ || Object.getPrototypeOf(BootstrapCommand)).apply(this, arguments));
  }

  _createClass(BootstrapCommand, [{
    key: "initialize",
    value: function initialize(callback) {
      this.configFlags = this.repository.bootstrapConfig;
      callback(null, true);
    }
  }, {
    key: "execute",
    value: function execute(callback) {
      var _this2 = this;

      this.bootstrapPackages(function (err) {
        if (err) {
          callback(err);
        } else {
          _this2.logger.success("Successfully bootstrapped " + _this2.filteredPackages.length + " packages.");
          callback(null, true);
        }
      });
    }

    /**
     * Bootstrap packages
     * @param {Function} callback
     */

  }, {
    key: "bootstrapPackages",
    value: function bootstrapPackages(callback) {
      var _this3 = this;

      this.filteredGraph = _PackageUtilities2.default.getPackageGraph(this.filteredPackages);
      this.logger.info("Bootstrapping " + this.filteredPackages.length + " packages");
      _async2.default.series([
      // preinstall bootstrapped packages
      function (cb) {
        return _this3.preinstallPackages(cb);
      },
      // install external dependencies
      function (cb) {
        return _this3.installExternalDependencies(cb);
      },
      // symlink packages and their binaries
      function (cb) {
        return _this3.symlinkPackages(cb);
      },
      // postinstall bootstrapped packages
      function (cb) {
        return _this3.postinstallPackages(cb);
      },
      // prepublish bootstrapped packages
      function (cb) {
        return _this3.prepublishPackages(cb);
      }], callback);
    }
  }, {
    key: "runScriptInPackages",
    value: function runScriptInPackages(scriptName, callback) {
      var _this4 = this;

      var packages = this.filteredPackages.slice();
      var batches = _PackageUtilities2.default.topologicallyBatchPackages(packages, this.logger);

      this.progressBar.init(packages.length);

      var bootstrapBatch = function bootstrapBatch() {
        var batch = batches.shift();

        _async2.default.parallelLimit(batch.map(function (pkg) {
          return function (done) {
            pkg.runScript(scriptName, function (err) {
              _this4.progressBar.tick(pkg.name);
              done(err);
            });
          };
        }), _this4.concurrency, function (err) {
          if (batches.length && !err) {
            bootstrapBatch();
          } else {
            _this4.progressBar.terminate();
            callback(err);
          }
        });
      };

      // Kick off the first batch.
      bootstrapBatch();
    }

    /**
     * Run the "preinstall" NPM script in all bootstrapped packages
     * @param callback
     */

  }, {
    key: "preinstallPackages",
    value: function preinstallPackages(callback) {
      this.logger.info("Preinstalling packages");
      this.runScriptInPackages("preinstall", callback);
    }

    /**
     * Run the "postinstall" NPM script in all bootstrapped packages
     * @param callback
     */

  }, {
    key: "postinstallPackages",
    value: function postinstallPackages(callback) {
      this.logger.info("Postinstalling packages");
      this.runScriptInPackages("postinstall", callback);
    }

    /**
     * Run the "prepublish" NPM script in all bootstrapped packages
     * @param callback
     */

  }, {
    key: "prepublishPackages",
    value: function prepublishPackages(callback) {
      this.logger.info("Prepublishing packages");
      this.runScriptInPackages("prepublish", callback);
    }

    /**
     * Create a symlink to a dependency's binary in the node_modules/.bin folder
     * @param {String} src
     * @param {String} dest
     * @param {String} name
     * @param {String|Object} bin
     * @param {Function} callback
     */

  }, {
    key: "createBinaryLink",
    value: function createBinaryLink(src, dest, name, bin, callback) {
      var destBinFolder = _path2.default.join(dest, ".bin");
      // The `bin` in a package.json may be either a string or an object.
      // Normalize to an object.
      var bins = typeof bin === "string" ? _defineProperty({}, name, bin) : bin;
      var srcBinFiles = [];
      var destBinFiles = [];
      Object.keys(bins).forEach(function (name) {
        srcBinFiles.push(_path2.default.join(src, bins[name]));
        destBinFiles.push(_path2.default.join(destBinFolder, name));
      });
      // make sure when have a destination folder (node_modules/.bin)
      var actions = [function (cb) {
        return _FileSystemUtilities2.default.mkdirp(destBinFolder, cb);
      }];
      // symlink each binary
      srcBinFiles.forEach(function (binFile, idx) {
        actions.push(function (cb) {
          return _FileSystemUtilities2.default.symlink(binFile, destBinFiles[idx], "exec", cb);
        });
      });
      _async2.default.series(actions, callback);
    }

    /**
     * Install external dependencies for all packages
     * @param {Function} callback
     */

  }, {
    key: "installExternalDependencies",
    value: function installExternalDependencies(callback) {
      var _this5 = this;

      this.logger.info("Installing external dependencies");
      this.progressBar.init(this.filteredPackages.length);
      var actions = [];
      this.filteredPackages.forEach(function (pkg) {
        var allDependencies = pkg.allDependencies;
        var externalPackages = Object.keys(allDependencies).filter(function (dependency) {
          var match = (0, _lodash2.default)(_this5.packages, function (pkg) {
            return pkg.name === dependency;
          });
          return !(match && pkg.hasMatchingDependency(match));
        }).filter(function (dependency) {
          return !pkg.hasDependencyInstalled(dependency);
        }).map(function (dependency) {
          return dependency + "@" + allDependencies[dependency];
        });
        if (externalPackages.length) {
          actions.push(function (cb) {
            return _NpmUtilities2.default.installInDir(pkg.location, externalPackages, function (err) {
              _this5.progressBar.tick(pkg.name);
              cb(err);
            });
          });
        }
      });
      _async2.default.parallelLimit(actions, this.concurrency, function (err) {
        _this5.progressBar.terminate();
        callback(err);
      });
    }

    /**
     * Symlink all packages to the packages/node_modules directory
     * Symlink package binaries to dependent packages' node_modules/.bin directory
     * @param {Function} callback
     */

  }, {
    key: "symlinkPackages",
    value: function symlinkPackages(callback) {
      var _this6 = this;

      this.logger.info("Symlinking packages and binaries");
      this.progressBar.init(this.filteredPackages.length);
      var actions = [];
      this.filteredPackages.forEach(function (filteredPackage) {
        // actions to run for this package
        var packageActions = [];
        Object.keys(filteredPackage.allDependencies)
        // filter out external dependencies and incompatible packages
        .filter(function (dependency) {
          var match = _this6.packageGraph.get(dependency);
          return match && filteredPackage.hasMatchingDependency(match.package);
        }).forEach(function (dependency) {
          // get Package of dependency
          var dependencyPackage = _this6.packageGraph.get(dependency).package;
          // get path to dependency and its scope
          var dependencyLocation = dependencyPackage.location;

          var dependencyPackageJsonLocation = _path2.default.join(dependencyLocation, "package.json");
          // ignore dependencies without a package.json file
          if (!_FileSystemUtilities2.default.existsSync(dependencyPackageJsonLocation)) {
            _this6.logger.error("Unable to find package.json for " + dependency + " dependency of " + filteredPackage.name + ",  " + "Skipping...");
          } else {
            (function () {
              // get the destination directory name of the dependency
              var pkgDependencyLocation = _path2.default.join(filteredPackage.nodeModulesLocation, dependencyPackage.name);
              // check if dependency is already installed
              if (_FileSystemUtilities2.default.existsSync(pkgDependencyLocation)) {
                var isDepSymlink = _FileSystemUtilities2.default.isSymlink(pkgDependencyLocation);
                // installed dependency is a symlink pointing to a different location
                if (isDepSymlink !== false && isDepSymlink !== dependencyLocation) {
                  _this6.logger.warn("Symlink already exists for " + dependency + " dependency of " + filteredPackage.name + ", " + "but links to different location. Replacing with updated symlink...");
                  // installed dependency is not a symlink
                } else if (isDepSymlink === false) {
                  _this6.logger.warn(dependency + " is already installed for " + filteredPackage.name + ". " + "Replacing with symlink...");
                  // remove installed dependency
                  packageActions.push(function (cb) {
                    return _FileSystemUtilities2.default.rimraf(pkgDependencyLocation, cb);
                  });
                }
              }
              // ensure destination path
              packageActions.push(function (cb) {
                return _FileSystemUtilities2.default.mkdirp(pkgDependencyLocation.split(_path2.default.sep).slice(0, -1).join(_path2.default.sep), cb);
              });
              // create package symlink
              packageActions.push(function (cb) {
                return _FileSystemUtilities2.default.symlink(dependencyLocation, pkgDependencyLocation, "junction", cb);
              });
              var dependencyPackageJson = require(dependencyPackageJsonLocation);
              if (dependencyPackageJson.bin) {
                (function () {
                  var destFolder = filteredPackage.nodeModulesLocation;
                  packageActions.push(function (cb) {
                    _this6.createBinaryLink(dependencyLocation, destFolder, dependency, dependencyPackageJson.bin, cb);
                  });
                })();
              }
            })();
          }
        });
        actions.push(function (cb) {
          _async2.default.series(packageActions, function (err) {
            _this6.progressBar.tick(filteredPackage.name);
            cb(err);
          });
        });
      });
      _async2.default.series(actions, function (err) {
        _this6.progressBar.terminate();
        callback(err);
      });
    }
  }]);

  return BootstrapCommand;
}(_Command3.default);

exports.default = BootstrapCommand;
module.exports = exports["default"];
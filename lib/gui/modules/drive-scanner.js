/*
 * Copyright 2016 resin.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const os = require('os');
const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const drivelist = require('drivelist');
const debug = require('debug')('etcher:drive-scanner');
const settings = require('../models/settings');

const DRIVE_SCANNER_DELAY_MS = 2000;
const DRIVE_SCANNER_FIRST_SCAN_DELAY_MS = 125;

/**
 * @summary DriveScanner class
 * @class
 * @extends {EventEmitter}
 * @example
 * var scanner = new DriveScanner()
 *   .on('error', (error) => { ... })
 *   .on('drives', (drives) => { ... })
 */
class DriveScanner extends EventEmitter {

  /**
   * @summary DriveScanner constructor
   * @param {Object} [options] - EventEmitter options
   * @example
   * var scanner = new DriveScanner()
   *   .on('error', (error) => { ... })
   *   .on('drives', (drives) => { ... })
   */
  constructor(options) {
    super(options);
    this.isRunning = false;
    this.timer = null;
    this.scanCount = 0;
    this.errorCount = 0;
    this.run = this.run.bind(this);
  }

  /**
   * @summary Start the scanner
   * @public
   * @example
   * scanner.start()
   */
  start() {
    debug('start');
    this.isRunning = true;
    this.timer = setTimeout(this.run, DRIVE_SCANNER_FIRST_SCAN_DELAY_MS);
  }

  /**
   * @summary Kick off a scan & schedule the next run
   * @private
   * @example
   * scanner.run()
   */
  run() {

    if (!this.isRunning) {
      return;
    }

    this.scanCount += 1;
    DriveScanner.scan((error, drives) => {
      debug('scan', error || drives);
      if (error) {
        this.errorCount += 1;
        this.emit('error', error);
      } else {
        this.emit('drives', drives);
      }
      if (this.isRunning) {
        this.timer = setTimeout(this.run, DRIVE_SCANNER_DELAY_MS);
      }
    });

  }

  /**
   * @summary Stop scanning for drives
   * @public
   * @example
   * scanner.stop()
   */
  stop() {
    debug('stop');
    this.isRunning = false;
    clearTimeout(this.timer);
  }

  /**
   * @summary Post-process discovered drive objects
   * @private
   * @static
   * @param {Array<Object>} drives - list of discovered drives
   * @returns {Array<Object>}
   * @example
   * drives = DriveScanner.processDrives(drives);
   */
  static processDrives(drives) {
    return _.map(drives, (drive) => {

      drive.name = drive.device;

      if (os.platform() === 'win32' && !_.isEmpty(drive.mountpoints)) {
        drive.name = _.join(_.map(drive.mountpoints, 'path'), ', ');
      }

      return drive;

    });
  }

  /**
   * @summary Scan for drives, automatically filtering out system drives
   * @private
   * @static
   * @param  {Function} callback - callback(error, drives)
   * @example
   * DriveScanner.scan((error, drives) => {
   *   ...
   * });
   */
  static scan(callback) {
    drivelist.list((error, drives) => {

      if (error) {
        callback(error);
        return;
      }

      let list = DriveScanner.processDrives(drives);

      if (!settings.get('unsafeMode')) {
        list = _.reject(list, {
          system: true
        });
      }

      callback(null, list);

    });
  }

}

module.exports = new DriveScanner();

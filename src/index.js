/**
 * @fileoverview NoSleepJs is a utility for preventing devices from sleeping 
 * by leveraging different strategies depending on platform capabilities.
 */

import VisibilityListener from './visibility-listener.js';
import NoSleepElement from './no-sleep-element.js';
import { isOldIOS } from './detect.js';

/**
 * Determines if the native Wake Lock API is supported.
 * @returns {boolean} True if Wake Lock API is supported.
 */
const isNativeWakeLockSupported = () => "wakeLock" in navigator;

/**
 * NoSleepJs prevents devices from entering sleep mode.
 * It uses the Wake Lock API, older iOS hacks, or video playback depending on device support.
 */
export default class NoSleepJs {
  constructor() {
    /**
     * @type {boolean} Indicates whether NoSleepJs is currently enabled.
     */
    this.enabled = false;

    if (isNativeWakeLockSupported()) {
      /** @type {WakeLockSentinel|null} The active Wake Lock instance. */
      this._wakeLock = null;

      /** @type {VisibilityListener|null} Listener for visibility changes to re-enable Wake Lock. */
      this.visibilityListener = new VisibilityListener(this.enable.bind(this));
    } else if (isOldIOS()) {
      /** @type {number|null} Timer ID for the iOS hack to prevent sleep. */
      this.noSleepTimer = null;
    } else {
      /** @type {NoSleepElement} Video element for non-iOS and non-Wake Lock devices. */
      this.noSleepElement = new NoSleepElement();
      this.noSleepElement.setMetadataListener();
    }
  }

  /**
   * Checks if NoSleepJs is enabled.
   * @returns {boolean} True if NoSleepJs is enabled.
   */
  get isEnabled() {
    return this.enabled;
  }

  /**
   * Enables the NoSleepJs functionality.
   * Uses the Wake Lock API, older iOS hack, or video playback as appropriate.
   * @returns {Promise<void>} Resolves when enabling is complete.
   * @throws {Error} Throws an error if enabling fails.
   */
  async enable() {
    if (isNativeWakeLockSupported()) {
      try {
        this._wakeLock = await navigator.wakeLock.request("screen");
        this.enabled = true;
        console.log("Wake Lock active.");
        this._wakeLock.addEventListener("release", this._onWakeLockRelease);
      } catch (err) {
        this.enabled = false;
        console.error(`${err.name}, ${err.message}`);
        throw err;
      }
    } else if (isOldIOS()) {
      this._enableOldIOS();
    } else {
      await this._enableVideoPlayback();
    }
  }

  /**
   * Handles Wake Lock release events.
   * @private
   */
  _onWakeLockRelease() {
    console.log("Wake Lock released.");
  }

  /**
   * Enables the older iOS-specific hack to prevent sleep.
   * This hack repeatedly refreshes the page.
   * @private
   */
  _enableOldIOS() {
    this.disable();
    console.warn("NoSleep enabled for older iOS devices. This can interrupt active network requests.");
    this.noSleepTimer = setInterval(() => {
      if (!document.hidden) {
        window.location.href = window.location.href.split("#")[0];
        setTimeout(window.stop, 0);
      }
    }, 15000);
    this.enabled = true;
  }

  /**
   * Enables video playback to prevent sleep on devices without Wake Lock or old iOS.
   * @private
   * @returns {Promise<void>} Resolves when video playback is successfully started.
   * @throws {Error} Throws an error if video playback fails.
   */
  async _enableVideoPlayback() {
    try {
      await this.noSleepElement.play();
      this.enabled = true;
    } catch (err) {
      this.enabled = false;
      console.error("Failed to start video playback:", err);
      throw err;
    }
  }

  /**
   * Disables NoSleepJs functionality.
   * Stops Wake Lock, iOS hack, or video playback depending on the platform.
   */
  disable() {
    if (isNativeWakeLockSupported()) {
      if (this._wakeLock) {
        this._wakeLock.release();
      }
      this._wakeLock = null;
      if (this.visibilityListener) {
        this.visibilityListener.removeListeners();
      }
    } else if (isOldIOS()) {
      if (this.noSleepTimer) {
        console.warn("NoSleep disabled for older iOS devices.");
        clearInterval(this.noSleepTimer);
        this.noSleepTimer = null;
      }
    } else {
      this.noSleepElement.pause();
    }
    this.enabled = false;
  }
}

// Expose NoSleepJs globally for use in browser environments.
window.NoSleepJs = NoSleepJs;
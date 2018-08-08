const fs = require('fs');
const os = require('os');
const path = require('path');

const JsDomEnvironment = require('jest-environment-jsdom');
const puppeteer = require('puppeteer');

const DIR = path.join(os.tmpdir(), 'jest_puppeteer_global_setup');

class PuppeteerEnvironment extends JsDomEnvironment {
  constructor(config) {
    super(config);
  }

  async setup() {
    console.log('Setup Test Environment.');
    await super.setup();
    const wsEndpoint = fs.readFileSync(path.join(DIR, 'wsEndpoint'), 'utf8');
    if (!wsEndpoint) {
      throw new Error('wsEndpoint not found');
    }
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
    });
    const page = await browser.newPage();
    page.setViewport({width: 1200, height: 600, deviceScaleFactor: 4});
    this.global.__BROWSER__ = page;

    console.log('setup: puppeteer connected');
  }

  async teardown() {
    console.log('Teardown Test Environment.');
    await super.teardown();
  }

  runScript(script) {
    return super.runScript(script);
  }
}

module.exports = PuppeteerEnvironment;

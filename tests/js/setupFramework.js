/* global process */
import path from 'path';

import slugify from '@sindresorhus/slugify';
import puppeteer from 'puppeteer';

import React from 'react';
import {mount} from 'enzyme';
import App from 'app/views/app';
import OrganizationDetails from 'app/views/organizationDetails';
import OrganizationRoot from 'app/views/organizationRoot';

// import ReactDOM from 'react-dom';
// import sprite from 'svg-sprite-loader/runtime/sprite.build';
// import {toMatchImageSnapshot} from 'jest-image-snapshot';
// expect.extend({toMatchImageSnapshot});

process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error(reason);
});

MockApiClient.addMockResponse({
  url: '/organizations/',
  body: [TestStubs.Organization()],
});
MockApiClient.addMockResponse({
  url: '/organizations/org-slug/',
  body: TestStubs.Organization(),
});
MockApiClient.addMockResponse({
  url: '/internal/health/',
  body: {},
});
// const client = puppeteer.launch();
// console.log('launch pup');

expect.extend({
  async toSnapshot(received, argument) {
    try {
      // received = enzyme wrapper
      // ReactDOM.render(received, document.body);
      // console.log(sprite.stringify());
      const cloned = document.documentElement.cloneNode(true);
      // console.log('cloned', cloned);
      const body = cloned.getElementsByTagName('body').item(0);
      body.innerHTML = received.html();
      const page = await global.__BROWSER__;
      await page.setContent(cloned.outerHTML);
      const fs = require('fs');
      const css = fs
        .readFileSync(
          path.resolve(__dirname, '../../src/sentry/static/sentry/dist/sentry.css'),
          'utf8'
        )
        .replace(/[\r\n]+/g, '');
      page.addStyleTag({
        content: css,
      });
      await page.screenshot({
        path: `./.artifacts/jest/${slugify(this.currentTestName)}.png`,
        fullPage: true,
      });
      page.close();
    } catch (err) {
      console.error(err);
      throw err;
    }
    // console.log(cloned.outerHTML);
    return {
      message: () => 'expected to save snapshot',
      pass: true,
    };
  },
  async toSnapshotWithShell(received, argument) {
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization()],
    });
    MockApiClient.addMockResponse({
      url: '/broadcasts/',
      body: [TestStubs.Organization()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: TestStubs.Organization(),
    });
    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {},
    });
    let wrapper = mount(
      <App>
        <OrganizationDetails params={{orgId: 'org-slug'}}>
          <OrganizationRoot params={{orgId: 'org-slug'}}>{received}</OrganizationRoot>
        </OrganizationDetails>, TestStubs.routerContext()
        {received}
      </App>,
      TestStubs.routerContext()
    );
    return this.toSnapshot(wrapper, argument);
  },
});

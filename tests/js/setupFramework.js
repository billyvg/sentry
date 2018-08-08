/* global process __dirname */
// eslint-disable-next-line
import path from 'path';

import slugify from '@sindresorhus/slugify';
import menrva from 'menrva-client/travis';

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
      // eslint-disable-next-line
      const page = global.page;
      await page.setContent(cloned.outerHTML);
      // eslint-disable-next-line
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
      const filePath = `./.artifacts/jest/${slugify(this.currentTestName)}.png`;
      await page.screenshot({
        path: filePath,
        fullPage: true,
      });

      if (!process.env.MENRVA_TOKEN) {
        return {
          message: () => 'expected to save snapshot',
          pass: true,
        };
      }
      console.log('uploading ', filePath);
      menrva.upload({
        files: [filePath],
        job: process.env.TRAVIS_JOB_ID,
      });
      // page.close();
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

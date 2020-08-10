# action-getsentry-checkout

This uses GitHub Apps to fetch a token that has access to the sentry and getsentry repos.

## Development

Install the dependencies
```bash
$ yarn
```

Build the typescript and package it for distribution
```bash
$ yarn build
```

## Usage:

The action will provide a `token` output.


```
  - name: getsentry token
    id: getsentry
    uses: './.github/actions/action-getsentry-checkout'
    with:
      private_key: ${{ secrets.SENTRY_INTERNAL_APP_PRIVATE_KEY }}

  - name: Checkout getsentry
    uses: actions/checkout@v2
    with:
      repository: getsentry/getsentry
      token: ${{ steps.getsentry.output.token }}
```

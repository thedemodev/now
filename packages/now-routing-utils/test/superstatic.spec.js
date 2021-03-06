const { deepEqual } = require('assert');
const { normalizeRoutes } = require('../');
const {
  getCleanUrls,
  convertCleanUrls,
  convertRedirects,
  convertRewrites,
  convertHeaders,
  convertTrailingSlash,
} = require('../dist/superstatic');

function routesToRegExps(routeArray) {
  const { routes, error } = normalizeRoutes(routeArray);
  if (error) {
    throw error;
  }
  return routes.map(r => new RegExp(r.src));
}

function assertMatches(actual, matches, isExpectingMatch) {
  routesToRegExps(actual).forEach((r, i) => {
    matches[i].forEach(text => {
      deepEqual(r.test(text), isExpectingMatch, `${text} ${r.source}`);
    });
  });
}

function assertRegexMatches(actual, mustMatch, mustNotMatch) {
  assertMatches(actual, mustMatch, true);
  assertMatches(actual, mustNotMatch, false);
}

test('getCleanUrls', () => {
  const actual = getCleanUrls([
    'file.txt',
    'path/to/file.txt',
    'file.js',
    'path/to/file.js',
    'file.html',
    'path/to/file.html',
  ]);
  const expected = [
    {
      html: '/file.html',
      clean: '/file',
    },
    {
      html: '/path/to/file.html',
      clean: '/path/to/file',
    },
  ];
  deepEqual(actual, expected);
});

test('convertCleanUrls true', () => {
  const actual = convertCleanUrls(true);
  const expected = [
    {
      src: '^/(?:(.+)/)?index(?:\\.html)?/?$',
      headers: { Location: '/$1' },
      status: 308,
    },
    {
      src: '^/(.*)\\.html/?$',
      headers: { Location: '/$1' },
      status: 308,
    },
  ];
  deepEqual(actual, expected);

  const mustMatch = [
    ['/index', '/index.html', '/sub/index', '/sub/index.html'],
    ['/file.html', '/sub/file.html'],
  ];

  const mustNotMatch = [
    [
      '/someindex',
      '/someindex.html',
      '/indexAhtml',
      '/sub/someindex',
      '/sub/someindex.html',
      '/sub/indexAhtml',
    ],
    ['/filehtml', '/sub/filehtml'],
  ];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertCleanUrls true, trailingSlash true', () => {
  const actual = convertCleanUrls(true, true);
  const expected = [
    {
      src: '^/(?:(.+)/)?index(?:\\.html)?/?$',
      headers: { Location: '/$1/' },
      status: 308,
    },
    {
      src: '^/(.*)\\.html/?$',
      headers: { Location: '/$1/' },
      status: 308,
    },
  ];
  deepEqual(actual, expected);

  const mustMatch = [
    [
      '/index',
      '/index.html',
      '/sub/index',
      '/sub/index.html',
      '/index/',
      '/index.html/',
      '/sub/index/',
      '/sub/index.html/',
    ],
    ['/file.html', '/sub/file.html', '/file.html/', '/sub/file.html/'],
  ];

  const mustNotMatch = [
    [
      '/someindex',
      '/someindex.html',
      '/indexAhtml',
      '/sub/someindex',
      '/sub/someindex.html',
      '/sub/indexAhtml',
      '/someindex/',
      '/someindex.html/',
      '/indexAhtml/',
      '/sub/someindex/',
      '/sub/someindex.html/',
      '/sub/indexAhtml/',
    ],
    ['/filehtml', '/sub/filehtml', '/filehtml/', '/sub/filehtml/'],
  ];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertCleanUrls false', () => {
  const actual = convertCleanUrls(false);
  const expected = [];
  deepEqual(actual, expected);
});

test('convertRedirects', () => {
  const actual = convertRedirects([
    { source: '/some/old/path', destination: '/some/new/path' },
    { source: '/next(\\.js)?', destination: 'https://nextjs.org' },
    {
      source: '/firebase/(.*)',
      destination: 'https://www.firebase.com',
      statusCode: 302,
    },
    {
      source: '/projects/:id/:action',
      destination: '/projects.html',
    },
    { source: '/old/:segment/path', destination: '/new/path/:segment' },
    { source: '/catchall/:hello*', destination: '/catchall/:hello*/' },
    {
      source: '/another-catch/:hello+',
      destination: '/another-catch/:hello+/',
    },
    {
      source: '/feedback/((?!general).*)',
      destination: '/feedback/general',
    },
    {
      source: '/firebase/([a-zA-Z]{1,})',
      destination: 'https://$1.firebase.com/',
    },
    {
      source: '/firebase/([a-zA-Z]{1,})',
      destination: 'https://$1.firebase.com:8080/',
    },
    { source: '/catchme/:id*', destination: '/api/user' },
    {
      source: '/hello/:world*',
      destination: '/something#:world*',
    },
  ]);

  const expected = [
    {
      src: '^\\/some\\/old\\/path$',
      headers: { Location: '/some/new/path' },
      status: 308,
    },
    {
      src: '^\\/next(\\.js)?$',
      headers: { Location: 'https://nextjs.org' },
      status: 308,
    },
    {
      src: '^\\/firebase(?:\\/(.*))$',
      headers: { Location: 'https://www.firebase.com' },
      status: 302,
    },
    {
      src: '^\\/projects(?:\\/([^\\/#\\?]+?))(?:\\/([^\\/#\\?]+?))$',
      headers: { Location: '/projects.html?id=$1&action=$2' },
      status: 308,
    },
    {
      src: '^\\/old(?:\\/([^\\/#\\?]+?))\\/path$',
      headers: { Location: '/new/path/$1?segment=$1' },
      status: 308,
    },
    {
      headers: {
        Location: '/catchall/$1/?hello=$1',
      },
      src: '^\\/catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?$',
      status: 308,
    },
    {
      headers: {
        Location: '/another-catch/$1/?hello=$1',
      },
      src:
        '^\\/another-catch(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))$',
      status: 308,
    },
    {
      headers: {
        Location: '/feedback/general',
      },
      src: '^\\/feedback(?:\\/((?!general).*))$',
      status: 308,
    },
    {
      status: 308,
      headers: {
        Location: 'https://$1.firebase.com/',
      },
      src: '^\\/firebase(?:\\/([a-zA-Z]{1,}))$',
    },
    {
      status: 308,
      headers: {
        Location: 'https://$1.firebase.com:8080/',
      },
      src: '^\\/firebase(?:\\/([a-zA-Z]{1,}))$',
    },
    {
      status: 308,
      headers: {
        Location: '/api/user?id=$1',
      },
      src: '^\\/catchme(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?$',
    },
    {
      headers: {
        Location: '/something?world=$1#$1',
      },
      src: '^\\/hello(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?$',
      status: 308,
    },
  ];

  deepEqual(actual, expected);

  const mustMatch = [
    ['/some/old/path'],
    ['/next', '/next.js'],
    ['/firebase/one', '/firebase/2', '/firebase/-', '/firebase/dir/sub'],
    ['/projects/one/edit', '/projects/two/edit'],
    ['/old/one/path', '/old/two/path'],
    ['/catchall/first', '/catchall/first/second'],
    ['/another-catch/first', '/another-catch/first/second'],
    ['/feedback/another'],
    ['/firebase/admin', '/firebase/anotherAdmin'],
    ['/firebase/admin', '/firebase/anotherAdmin'],
    ['/catchme/id-1', '/catchme/id/2'],
    ['/hello/world', '/hello/another/world'],
  ];

  const mustNotMatch = [
    ['/nope'],
    ['/nextAjs', '/nextjs'],
    ['/fire', '/firebasejumper/two'],
    ['/projects/edit', '/projects/two/three/delete', '/projects'],
    ['/old/path', '/old/two/foo', '/old'],
    ['/random-catch'],
    ['/another-catch'],
    ['/feedback/general'],
    ['/firebase/user/1', '/firebase/another/1'],
    ['/firebase/user/1', '/firebase/another/1'],
    ['/catchm', '/random'],
    ['/not-this-one', '/helloo'],
  ];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertRewrites', () => {
  const actual = convertRewrites([
    { source: '/some/old/path', destination: '/some/new/path' },
    { source: '/firebase/(.*)', destination: 'https://www.firebase.com' },
    { source: '/projects/:id/edit', destination: '/projects.html' },
    {
      source: '/users/:id',
      destination: '/api/user?identifier=:id&version=v2',
    },
    {
      source: '/:file/:id',
      destination: '/:file/get?identifier=:id',
    },
    {
      source: '/qs-and-hash/:id/:hash',
      destination: '/api/get?identifier=:id#:hash',
    },
    {
      source: '/fullurl',
      destination:
        'https://user:pass@sub.example.com:8080/path/goes/here?v=1&id=2#hash',
    },
    {
      source: '/dont-override-qs/:name/:age',
      destination: '/final?name=bob&age=',
    },
    { source: '/catchall/:hello*/', destination: '/catchall/:hello*' },
    {
      source: '/another-catch/:hello+/',
      destination: '/another-catch/:hello+',
    },
    {
      source: '/firebase/([a-zA-Z]{1,})',
      destination: 'https://$1.firebase.com/',
    },
    {
      source: '/firebase/([a-zA-Z]{1,})',
      destination: 'https://$1.firebase.com:8080/',
    },
    { source: '/catchme/:id*', destination: '/api/user' },
  ]);

  const expected = [
    { src: '^\\/some\\/old\\/path$', dest: '/some/new/path', check: true },
    {
      src: '^\\/firebase(?:\\/(.*))$',
      dest: 'https://www.firebase.com',
      check: true,
    },
    {
      src: '^\\/projects(?:\\/([^\\/#\\?]+?))\\/edit$',
      dest: '/projects.html?id=$1',
      check: true,
    },
    {
      src: '^\\/users(?:\\/([^\\/#\\?]+?))$',
      dest: '/api/user?identifier=$1&version=v2&id=$1',
      check: true,
    },
    {
      src: '^(?:\\/([^\\/#\\?]+?))(?:\\/([^\\/#\\?]+?))$',
      dest: '/$1/get?identifier=$2&file=$1&id=$2',
      check: true,
    },
    {
      src: '^\\/qs-and-hash(?:\\/([^\\/#\\?]+?))(?:\\/([^\\/#\\?]+?))$',
      dest: '/api/get?identifier=$1&id=$1&hash=$2#$2',
      check: true,
    },
    {
      src: '^\\/fullurl$',
      dest:
        'https://user:pass@sub.example.com:8080/path/goes/here?v=1&id=2#hash',
      check: true,
    },
    {
      src: '^\\/dont-override-qs(?:\\/([^\\/#\\?]+?))(?:\\/([^\\/#\\?]+?))$',
      dest: '/final?name=bob&age=',
      check: true,
    },
    {
      src: '^\\/catchall(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?\\/$',
      dest: '/catchall/$1?hello=$1',
      check: true,
    },
    {
      src:
        '^\\/another-catch(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))\\/$',
      dest: '/another-catch/$1?hello=$1',
      check: true,
    },
    {
      check: true,
      dest: 'https://$1.firebase.com/',
      src: '^\\/firebase(?:\\/([a-zA-Z]{1,}))$',
    },
    {
      check: true,
      dest: 'https://$1.firebase.com:8080/',
      src: '^\\/firebase(?:\\/([a-zA-Z]{1,}))$',
    },
    {
      check: true,
      dest: '/api/user?id=$1',
      src: '^\\/catchme(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?$',
    },
  ];

  deepEqual(actual, expected);

  const mustMatch = [
    ['/some/old/path'],
    ['/firebase/one', '/firebase/two'],
    ['/projects/one/edit', '/projects/two/edit'],
    ['/users/four', '/users/five'],
    ['/file1/yep', '/file2/nope'],
    ['/qs-and-hash/test/first', '/qs-and-hash/test/second'],
    ['/fullurl'],
    ['/dont-override-qs/bob/42', '/dont-override-qs/alice/29'],
    ['/catchall/first/', '/catchall/first/second/'],
    ['/another-catch/first/', '/another-catch/first/second/'],
    ['/firebase/admin', '/firebase/anotherAdmin'],
    ['/firebase/admin', '/firebase/anotherAdmin'],
    ['/catchme/id-1', '/catchme/id/2'],
  ];

  const mustNotMatch = [
    ['/nope'],
    ['/fire', '/firebasejumper/two'],
    ['/projects/edit', '/projects/two/delete', '/projects'],
    ['/users/edit/four', '/users/five/delete', '/users'],
    ['/'],
    ['/qs-and-hash', '/qs-and-hash/onlyone'],
    ['/full'],
    ['/dont-override-qs', '/dont-override-qs/nope'],
    ['/random-catch/'],
    ['/another-catch/'],
    ['/firebase/user/1', '/firebase/another/1'],
    ['/firebase/user/1', '/firebase/another/1'],
    ['/catchm', '/random'],
  ];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertHeaders', () => {
  const actual = convertHeaders([
    {
      source: '(.*)+/(.*)\\.(eot|otf|ttf|ttc|woff|font\\.css)',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
      ],
    },
    {
      source: '404.html',
      headers: [
        {
          key: 'Cache-Control',
          value: 'max-age=300',
        },
        {
          key: 'Set-Cookie',
          value: 'error=404',
        },
      ],
    },
    {
      source: '/blog/:path*',
      headers: [
        {
          key: 'on-blog',
          value: ':path*',
        },
        {
          key: ':path*',
          value: 'blog',
        },
      ],
    },
  ]);

  const expected = [
    {
      src: '^(.*)+(?:\\/(.*))\\.(eot|otf|ttf|ttc|woff|font\\.css)$',
      headers: { 'Access-Control-Allow-Origin': '*' },
      continue: true,
    },
    {
      src: '^404\\.html$',
      headers: { 'Cache-Control': 'max-age=300', 'Set-Cookie': 'error=404' },
      continue: true,
    },
    {
      continue: true,
      headers: {
        'on-blog': '$1',
        $1: 'blog',
      },
      src: '^\\/blog(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?$',
    },
  ];

  deepEqual(actual, expected);

  const mustMatch = [
    ['hello/world/file.eot', 'another/font.ttf', 'dir/arial.font.css'],
    ['404.html'],
    ['/blog/first-post', '/blog/another/one'],
  ];

  const mustNotMatch = [
    ['hello/file.jpg', 'hello/font-css', 'dir/arial.font-css'],
    ['403.html', '500.html'],
    ['/blogg', '/random'],
  ];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertTrailingSlash enabled', () => {
  const actual = convertTrailingSlash(true);
  const expected = [
    {
      src: '^/(.*[^\\/])$',
      headers: { Location: '/$1/' },
      status: 308,
    },
  ];
  deepEqual(actual, expected);

  const mustMatch = [['/index.html', '/dir', '/dir/index.html', '/foo/bar']];

  const mustNotMatch = [['/', '/dir/', '/dir/foo/', '/next.php?page=/']];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertTrailingSlash disabled', () => {
  const actual = convertTrailingSlash(false);
  const expected = [
    {
      src: '^/(.*)\\/$',
      headers: { Location: '/$1' },
      status: 308,
    },
  ];
  deepEqual(actual, expected);

  const mustMatch = [['/dir/', '/index.html/', '/next.php?page=/']];

  const mustNotMatch = [['/dirp', '/mkdir', '/dir/foo']];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

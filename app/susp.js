#!/usr/bin/env node

'use strict';

const env = require('../env');
const pMap = require('p-map');
const {next, request, print, hosts} = require('utils-mad');

const concurrency = 5;
const pages = 10;

const searchList = [
    'ad.', '.ad', '-ad', 'ad-',
    'ads', 'adim', 'adv', 'adx',
    'affil', 'analy',
    'banner', 'beacon',
    'count',
    'event',
    'log', 'logs',
    'marketing', 'metric',
    'pixel',
    'rum',
    'stats', 'statis',
    'telem',
    'track',
];

const exclude = [
    '-rum.cdnvideo.ru',
    '.blog',
    '.cdn.ampproject.org',
    '.nextdns.io',
    'account.',
    'accounts.',
    'blog.',
    'catalog.',
    'dnsotls-ds.metric.gstatic.com',
    'download.',
    'forum.',
    'forums.',
    'login.',
    'static.',
    'upload.',
];

(async () => {
    try {
        const suspicious = new Set();

        await pMap(searchList, async search => {
            let timestamp = '';
            let hasMore = true;

            for (let i = 1; i <= pages; i++) {
                if (hasMore) {
                    const data = await next.query({
                        path: 'logs',
                        searchParams: {search, simple: 1, lng: 'en', before: timestamp},
                    });

                    for (const {lists, name} of data.logs) {
                        if (
                            lists.length === 0
                            && !suspicious.has(name)
                            && !exclude.some(elem => name.includes(elem))
                        ) {
                            const {Answer} = await request.doh({domain: name, resolver: `https://dns.nextdns.io/${env.next.config}/${env.next.checker}`});

                            if (Answer && !Answer?.some(elem => elem.data === '0.0.0.0')) {
                                suspicious.add(name);
                            }
                        }
                    }

                    ({timestamp} = data.logs[data.logs.length - 1] || '');
                    ({hasMore} = data);
                }
            }
        }, {concurrency});

        console.log(hosts.comment(hosts.sort(suspicious)).join('\n'));
    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();

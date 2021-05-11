#!/usr/bin/env node

'use strict';

const env = require('../env');
const hexyjs = require('hexyjs');
const pMap = require('p-map');
const {cyan, dim, yellow, green} = require('chalk');
const {lists, concurrency, timeout} = require('./helpers/consts');
const {next, request, promise, print, object} = require('@k03mad/utils');

const prepareAnswer = (domain, answer) => `— ${domain} ${dim(answer
    ? answer
        .filter(elem => elem.data.match(/(\d{1,3}\.){3}\d{1,3}/))
        .map(elem => elem.data)
        .sort()
        .pop()
    : '# NO ANSWER #')}`;

const logRecords = (arr, name) => {
    if (arr.length > 0) {
        console.log(`\n${cyan(`${name}:`)}\n${arr.join('\n')}`);
    }
};

(async () => {
    try {
        const [list] = env.args;

        if (Object.keys(lists).includes(list)) {
            const listType = lists[list];
            console.log(`\n${yellow(`__${listType.toUpperCase()}__`)}`);

            const domains = await next.list({path: listType});

            if (domains.length > 0) {
                // disable personal filters
                await pMap(domains, domain => next.query({
                    method: 'PATCH',
                    path: `${listType}/hex:${hexyjs.strToHex(domain)}`,
                    json: {active: false},
                }), {concurrency});

                await promise.delay(timeout.pause);

                // get dns records
                const cloudflare = [];
                const nextdns = [];
                const common = [];

                const answers = await pMap(domains, async domain => {
                    const res = await Promise.all([
                        request.doh({domain}),
                        request.doh({domain, resolver: `https://dns.nextdns.io/${env.next.config}/${env.next.checker}`}),
                    ]);
                    return {domain, cloudflare: res[0].Answer, nextdns: res[1].Answer};
                }, {concurrency});

                answers.forEach(answer => {
                    const preparedDef = prepareAnswer(answer.domain, answer.cloudflare);
                    const preparedNext = prepareAnswer(answer.domain, answer.nextdns);

                    if (preparedDef === preparedNext) {
                        common.push(preparedDef);
                    } else {
                        cloudflare.push(preparedDef);
                        nextdns.push(preparedNext);
                    }
                });

                logRecords(cloudflare, 'cloudflare');
                logRecords(nextdns, 'nextdns');
                logRecords(common, 'common');

                await promise.delay(timeout.pause);

                // save allow/block reasons
                const foundInLists = [];
                const listsStat = {};

                const devices = await next.query({
                    path: 'analytics/top_devices',
                    searchParams: {
                        from: '-30d',
                        timezoneOffset: '-180',
                        selector: true,
                    },
                });

                const {id} = devices.find(elem => elem.name === env.next.checker);

                await pMap(domains, async domain => {
                    const {logs} = await next.query({
                        path: 'logs',
                        searchParams: {
                            device: id,
                            search: domain,
                            simple: 1,
                            lng: 'en',
                        },
                    });

                    const lastDomainLog = logs.find(elem => elem.name === domain);

                    if (lastDomainLog?.lists.length > 0) {
                        foundInLists.push(`— ${domain}\n${dim(lastDomainLog.lists.sort().join('\n'))}`);
                        lastDomainLog.lists.forEach(elem => {
                            object.count(listsStat, elem);
                        });
                    }
                }, {concurrency});

                logRecords(foundInLists.sort(), 'reasons');
                logRecords(
                    Object
                        .entries(listsStat)
                        .sort((a, b) => b[1] - a[1])
                        .map(elem => `— ${elem[0]} ${dim(elem[1])}`),
                    'lists',
                );

                // reenable filters
                await pMap(domains, domain => next.query({
                    method: 'PATCH',
                    path: `${listType}/hex:${hexyjs.strToHex(domain)}`,
                    json: {active: true},
                }), {concurrency});
            }
        } else {
            console.log(`Args: ${green('{type (-|+)}')}`);
        }

    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();

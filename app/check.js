#!/usr/bin/env node

import {next, object, print, promise, request} from '@k03mad/util';
import chalk from 'chalk';
import hexyjs from 'hexyjs';

import env from '../env.js';
import consts from './helpers/consts.js';

const {checker, lists, timeout} = consts;
const {cyan, dim, green, yellow} = chalk;

const prepareAnswer = (domain, answer) => `— ${domain} ${dim(answer
    ? answer
        .filter(elem => elem.data.match(/(\d{1,3}\.){3}\d{1,3}/))
        .map(elem => elem.data)
        .shift()
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
                await Promise.all(domains.map(domain => next.query({
                    method: 'PATCH',
                    path: `${listType}/hex:${hexyjs.strToHex(domain)}`,
                    json: {active: false},
                })));

                await promise.delay(timeout.pause);

                // get dns records
                const defResolver = [];
                const nextdns = [];
                const common = [];

                const answers = await Promise.all(domains.map(async domain => {
                    const res = await Promise.all([
                        request.doh({domain}),
                        next.doh(domain),
                    ]);

                    return {domain, defResolver: res[0].Answer, nextdns: res[1].Answer};
                }));

                answers.forEach(answer => {
                    const preparedDef = prepareAnswer(answer.domain, answer.defResolver);
                    const preparedNext = prepareAnswer(answer.domain, answer.nextdns);

                    if (preparedDef === preparedNext) {
                        common.push(preparedDef);
                    } else {
                        defResolver.push(preparedDef);
                        nextdns.push(preparedNext);
                    }
                });

                logRecords(defResolver, 'default resolver');
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

                const {id} = devices.find(elem => elem.name === checker);

                await Promise.all(domains.map(async domain => {
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
                        if (
                            listType === 'allowlist'
                            && lastDomainLog.lists.includes('Affiliate & Tracking Links')
                        ) {
                            return;
                        }

                        foundInLists.push(`— ${domain}\n${dim(lastDomainLog.lists.sort().join('\n'))}`);

                        lastDomainLog.lists.forEach(elem => {
                            object.count(listsStat, elem);
                        });
                    }
                }));

                logRecords(foundInLists.sort(), 'reasons');

                logRecords(
                    Object
                        .entries(listsStat)
                        .sort((a, b) => b[1] - a[1])
                        .map(elem => `— ${elem[0]} ${dim(elem[1])}`),
                    'lists',
                );

                // reenable filters
                await Promise.all(domains.map(domain => next.query({
                    method: 'PATCH',
                    path: `${listType}/hex:${hexyjs.strToHex(domain)}`,
                    json: {active: true},
                })));
            }
        } else {
            console.log(`Args: ${green('{type (-|+)}')}`);
        }

    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();

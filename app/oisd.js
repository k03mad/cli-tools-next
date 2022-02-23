#!/usr/bin/env node

import {next, print, progress, promise} from '@k03mad/util';
import chalk from 'chalk';
import _ from 'lodash';
import puppeteer from 'puppeteer';

import env from '../env.js';

const {blue, red, yellow} = chalk;

const DEFAULT_PAGES = 20;
const TRIES_WAIT_FOR_LOADING = 5;

const removeReport = page => page
    .$eval('#domainreport', element => element.remove()).catch();

const getBodyText = async page => {
    try {
        return await page.$eval('body', ({textContent}) => textContent);
    } catch {
        return '';
    }
};

(async () => {
    try {
        let [pages = DEFAULT_PAGES] = env.args;
        pages = Number(pages);

        const nextBar = progress.start('nextdns', pages);

        const blocked = [];

        let lastTime;

        for (let i = 1; i <= pages; i++) {
            const {logs} = await next.query({
                path: 'logs',
                searchParams: {
                    blockedQueriesOnly: 1,
                    before: lastTime || '',
                    simple: 1,
                    lng: 'en',
                },
            });

            logs.forEach(elem => {
                if (
                    !elem.lists.includes('oisd')
                    && !blocked.map(row => row.name).includes(elem.name)
                ) {
                    blocked.push(elem);
                }
            });

            lastTime = logs[logs.length - 1].timestamp;
            progress.update(nextBar, i, lastTime);
        }

        if (blocked.length > 0) {
            const oisdBar = progress.start('oisd   ', blocked.length);

            const output = [];

            const browser = await puppeteer.launch();
            const page = await browser.newPage();

            for (const [i, elem] of _.sortBy(blocked, 'name').entries()) {
                const url = `https://oisd.nl/excludes.php?w=${elem.name}`;

                await page.goto(url);
                await removeReport(page);

                let text = await getBodyText(page);

                for (let t = 0; t < TRIES_WAIT_FOR_LOADING; t++) {
                    if (!text || text.includes('Loading details')) {
                        await promise.delay(1000);
                        await removeReport(page);

                        text = await getBodyText(page);
                    } else {
                        break;
                    }
                }

                const message = [
                    blue(url),

                    red(`[${elem.lists.map(name => {
                        const [first] = name.split(' ');
                        return first;
                    }).join(', ')}]`),
                ];

                if (text) {
                    const formatted = text
                        .replace(/.+not included in the oisd blocklist\?/, '')
                        .replace(/getreport.+/, '')
                        .replace(/(\s+)?Found in: /g, '\n> wl: ')
                        .replace(/(\s+)?CNAME for: /g, '\n> cname: ')
                        .replace(/(\s+)?Parent of: /g, '\n> parent: ')
                        .trim();

                    if (
                        !formatted.includes('No info on this domain')
                    && !formatted.includes('IS being blocked by oisd')
                    ) {
                        output.push([...message, formatted]);
                    }
                } else {
                    output.push([...message, yellow("Can't parse results")]);
                }

                progress.update(oisdBar, i + 1, elem.name);
            }

            console.log(`\n${output.map(elem => elem.join('\n')).join('\n\n')}`);
            await browser.close();
        }
    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();

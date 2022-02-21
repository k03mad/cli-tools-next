#!/usr/bin/env node

import {next, print} from '@k03mad/util';
import chalk from 'chalk';
import _ from 'lodash';
import puppeteer from 'puppeteer';

import env from '../env.js';

const {blue, red} = chalk;

(async () => {
    try {
        const [pages = 50] = env.args;
        const blocked = [];

        let lastTime;

        for (let i = 1; i <= Number(pages); i++) {
            const {logs} = await next.query({
                path: 'logs',
                searchParams: {
                    before: lastTime || '',
                    simple: 1,
                    lng: 'en',
                },
            });

            logs.forEach(elem => {
                if (
                    elem.status === 2
                    && !elem.lists.includes('oisd')
                    && !blocked.map(row => row.name).includes(elem.name)
                ) {
                    blocked.push(elem);
                }
            });

            lastTime = logs[logs.length - 1].timestamp;
        }

        for (const elem of _.sortBy(blocked, 'name')) {
            const url = `https://oisd.nl/excludes.php?w=${elem.name}`;

            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.goto(url);

            const body = await page.$('body');
            const text = await body.evaluate(node => node.textContent);

            const formatted = text
                .replace(/.+not included in the oisd blocklist\?/, '')
                .replace(/getreport.+/, '')
                .replace(/-{9}.+/, '')
                .replace(/(\s+)?Found in: /g, '\n> wl: ')
                .replace(/(\s+)?CNAME for: /g, '\n> cname: ')
                .replace(/(\s+)?Parent of: /g, '\n> parent: ')
                .trim();

            if (!formatted.includes('No info on this domain')) {
                console.log(`\n${blue(url)}`);

                console.log(red(`(${elem.lists.map(name => {
                    const [first] = name.split(' ');
                    return first;
                }).join(', ')})`));

                console.log(formatted);
            }

            await browser.close();
        }

    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();

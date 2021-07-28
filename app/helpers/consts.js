'use strict';

module.exports = {
    lists: {
        '-': 'denylist',
        '+': 'allowlist',
    },
    concurrency: 10,
    timeout: {
        put: 2000,
        pause: 5000,
    },
};

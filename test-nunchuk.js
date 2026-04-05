/**
 * Wiimote + Nunchuk Test Harness
 *
 * Simple event-driven testing - logs presses as they happen.
 * Press Ctrl+C to see summary.
 *
 * Run with: node test-nunchuk.js
 */

import { scanRemotes } from './lib/index.js';

const verifiedInputs = new Set();
const startTime = Date.now();

function log(...args) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${elapsed}s]`, ...args);
}

async function main() {
    log('Wiimote + Nunchuk Test Harness');
    log('Press each button and move stick in all directions.');
    log('Press Ctrl+C when done to see summary.');
    log('');
    log('Scanning for Wiimotes...');

    let remote = null;

    // Scan until we find a Wiimote
    while (!remote) {
        const result = await scanRemotes(true, true);
        if (result.all.length > 0) {
            remote = result.all[0];
            log(`Connected to Wiimote (Player ${remote.player})`);
            log(`Nunchuk connected: ${remote.nunchukConnected}`);
        } else {
            log('No Wiimotes found. Press sync button on Wiimote.');
            await sleep(1000);
        }
    }

    // Register event listeners for all buttons
    const wiimoteButtons = ['a', 'b', '1', '2', 'home', 'plus', 'minus', 'left', 'right', 'up', 'down'];
    const nunchukButtons = ['nunchuk-c', 'nunchuk-z'];

    log('');
    log('Listening for input...');
    log('');

    // Wiimote buttons
    wiimoteButtons.forEach(btn => {
        remote.on(btn, (pressed) => {
            if (pressed) {
                verifiedInputs.add(`wiimote:${btn}`);
                log(`Wiimote: ${btn.toUpperCase()} pressed`);
            }
        });
    });

    // Nunchuk buttons
    nunchukButtons.forEach(btn => {
        remote.on(btn, (pressed) => {
            if (pressed) {
                verifiedInputs.add(`nunchuk:${btn}`);
                const name = btn === 'nunchuk-c' ? 'C' : 'Z';
                log(`Nunchuk: ${name} pressed`);
            }
        });
    });

    // Nunchuk stick - track directions
    let lastStickDir = null;
    const deadzone = 25;

    setInterval(() => {
        const x = remote.nunchukStickX;
        const y = remote.nunchukStickY;

        let dir = null;
        if (x < 128 - deadzone) dir = 'LEFT';
        else if (x > 128 + deadzone) dir = 'RIGHT';
        else if (y > 128 + deadzone) dir = 'UP';
        else if (y < 128 - deadzone) dir = 'DOWN';

        if (dir && dir !== lastStickDir) {
            verifiedInputs.add(`nunchuk-stick:${dir.toLowerCase()}`);
            log(`Nunchuk stick: ${dir} (X:${x}, Y:${y})`);
        }
        lastStickDir = dir;
    }, 200);

    // Log stick center on startup
    setTimeout(() => {
        log(`Stick center: X=${remote.nunchukStickX}, Y=${remote.nunchukStickY}`);
        log('');
    }, 1000);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('SIGINT', () => {
    console.log('');
    console.log('');
    console.log('='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));
    console.log('');

    const allInputs = [
        'wiimote:a', 'wiimote:b', 'wiimote:1', 'wiimote:2',
        'wiimote:home', 'wiimote:plus', 'wiimote:minus',
        'wiimote:left', 'wiimote:right', 'wiimote:up', 'wiimote:down',
        'nunchuk:nunchuk-c', 'nunchuk:nunchuk-z',
        'nunchuk-stick:left', 'nunchuk-stick:right',
        'nunchuk-stick:up', 'nunchuk-stick:down'
    ];

    console.log('Verified inputs:');
    for (const input of allInputs) {
        const status = verifiedInputs.has(input) ? '✓' : '○';
        const label = input.replace('wiimote:', '').replace('nunchuk:', '').replace('nunchuk-stick:', 'stick:');
        console.log(`  ${status} ${label}`);
    }

    const verifiedCount = allInputs.filter(i => verifiedInputs.has(i)).length;
    console.log('');
    console.log(`Total: ${verifiedCount}/${allInputs.length} inputs verified`);

    if (verifiedCount === allInputs.length) {
        console.log('');
        console.log('All inputs working!');
    }

    console.log('');
    process.exit(0);
});

main().catch(err => {
    log('Error:', err.message);
    process.exit(1);
});

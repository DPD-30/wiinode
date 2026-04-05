const { scanRemotes } = require('./lib');

async function main() {
    let result = await scanRemotes(true,true);

    if (result.all.length === 0) {
        console.log('No Wii remotes found');
        process.exit(0);
    }

    let remote = result.all[0];

    console.log('Listening for button presses. Press A to print "pressed". Press Home to exit.');

    remote.on('a', (pressed) => {
        if (pressed) {
            console.log('pressed');
        }
    });

    remote.on('home', async (pressed) => {
        if (pressed) {
            console.log('Home pressed, disconnecting...');
            await remote.disconnect();
            process.exit(0);
        }
    });
}

main().catch(console.error);
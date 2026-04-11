# wiinode
forked from https://github.com/TheReincarnator/wiinode

A node library for the Nintendo<sup>®</sup> Wii Remote (Wiimote), using [node-hid](https://github.com/node-hid/node-hid).

updated to support WII Nunchuk.  Also now uses node-hid async setup.  

## Updates
0.2.0 added disconnect timeout 2000ms 
also added error event data.  

## Installation

```
npm install --save @dpd-30/wiinode
```

## Getting started

First, connect the Wiimotes to your computer.

### Basic usage

```typescript
import { scanRemotes, Remote } from 'wiinode';
```

Use `scanRemotes()` to discover and connect to Wiimotes. This is an async function:

```typescript
// Scan for Wiimotes (without Nunchuk)
const result = await scanRemotes();
const remote = result.all[0];

// Listen for button events
remote.on('a', (pressed) => {
  console.log('A button:', pressed);
});

// Read button state
if (remote.buttonA) {
  console.log('A is pressed');
}

// Control LEDs and rumble
await remote.setLed(1);
await remote.rumble(500);
```

### Nunchuk support

To enable Nunchuk extension support, pass `true` as the second parameter:

```typescript
// Scan with Nunchuk support
const result = await scanRemotes(true, true); // assignPlayers=true, enableNunchuk=true
const remote = result.all[0];

// Nunchuk properties
console.log('Connected:', remote.nunchukConnected);
console.log('Stick X:', remote.nunchukStickX);
console.log('Stick Y:', remote.nunchukStickY);

// Nunchuk button events
remote.on('nunchuk-c', (pressed) => {
  console.log('C button:', pressed);
});

remote.on('nunchuk-z', (pressed) => {
  console.log('Z button:', pressed);
});
```

### Remote properties

**Buttons:** `buttonA`, `buttonB`, `button1`, `button2`, `buttonHome`, `buttonPlus`, `buttonMinus`, `padLeft`, `padRight`, `padUp`, `padDown`

**Accelerometer:** `accelerateX`, `accelerateY`, `accelerateZ`

**IR Camera:** `irx[0-3]`, `iry[0-3]`

**Nunchuk:** `nunchukConnected`, `nunchukStickX`, `nunchukStickY`, `nunchukButtonC`, `nunchukButtonZ`, `nunchukAccelX`, `nunchukAccelY`, `nunchukAccelZ`

### Remote methods

- `on(button, listener)` - Register a button event listener
- `rumble(msecs?)` - Activate rumble for specified milliseconds
- `setLed(id, rumbleMsecs?)` - Set a single LED (1-4)
- `setLeds(led1, led2, led3, led4, rumbleMsecs?)` - Set multiple LEDs
- `disconnect()` - Disconnect from the Wiimote

See the wonderful [WiiBrew Wiki](https://wiibrew.org/wiki/Wiimote) for more technical details.

## Contribute

Do you have suggestions, ideas, or even code? Please submit pull request or issue on the project.  

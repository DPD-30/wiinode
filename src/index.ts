import * as HID from "node-hid";

export class Remote {
	private hid: any;
	private listeners: { [event: string]: ((...args: any[]) => void)[] } = {};
	private ledRumbleByte: number = 0;
	private dataTimeoutTimer: NodeJS.Timeout | null = null;
	private lastDataTime: number = 0;
	private readonly DATA_TIMEOUT_MS = 2000; // 2 seconds without data = disconnected

	public devicePath: string;
	public player: number;

	public buttonA: boolean = false;
	public buttonB: boolean = false;
	public button1: boolean = false;
	public button2: boolean = false;
	public buttonHome: boolean = false;
	public buttonPlus: boolean = false;
	public buttonMinus: boolean = false;

	public padLeft: boolean = false;
	public padRight: boolean = false;
	public padUp: boolean = false;
	public padDown: boolean = false;

	public accelerateX: number = 0;
	public accelerateY: number = 0;
	public accelerateZ: number = 0;

	public irx: number[] = [1023, 1023, 1023, 1023];
	public iry: number[] = [1023, 1023, 1023, 1023];

	// Nunchuk extension
	public nunchukConnected: boolean = false;
	public nunchukStickX: number = 128;
	public nunchukStickY: number = 128;
	public nunchukButtonC: boolean = false;
	public nunchukButtonZ: boolean = false;
	public nunchukAccelX: number = 0;
	public nunchukAccelY: number = 0;
	public nunchukAccelZ: number = 0;

	private debugLogged: boolean = false;
    private debugLogCount: number = 5; 
	private constructor() {}

	public static async create(devicePath: string, enableNunchuk: boolean = false): Promise<Remote> {
		const remote = new Remote();
		remote.devicePath = devicePath;
		remote.hid = await HID.HIDAsync.open(devicePath);

		// Initialize IR sensor (required for basic operation)
		await remote.hid.write([0x12, 0x00, 0x37]);

		// Start listening for data BEFORE Nunchuk init so we don't block button presses
		remote.hid.on("data", data => {
			remote.lastDataTime = Date.now();
			remote.clearDataTimeout();
			remote.processData(data, enableNunchuk);
			remote.startDataTimeout();
		});

		// Handle HID device errors
		remote.hid.on("error", err => {
			remote.emitDisconnect();
		});

		// Handle HID close
		remote.hid.on("close", () => {
			remote.emitDisconnect();
		});

		// Start data timeout timer
		remote.startDataTimeout();

		// Initialize Nunchuk extension if requested (non-blocking after this point)
		if (enableNunchuk) {
			remote.initializeNunchuk();  // Don't await - let it run in background
		}

		return remote;
	}

	private async initializeNunchuk(): Promise<void> {
		// Enable extension controller passthrough
		// Step 1: Write 0x55 to 0xA400F0 (initialize)
		await this.hid.write([0x16, 0x00, 0xA4, 0x00, 0xF0, 0x55]);
		await this.sleep(10);

		// Step 2: Write 0x00 to 0xA400FB (enable Nunchuk extension)
		// Note: Must use 0xFB, not 0xF0
		await this.hid.write([0x16, 0x00, 0xA4, 0x00, 0xFB, 0x00]);
		await this.sleep(10);

		// Step 3: Request data reports with extension data
		// Mode 0x35 = Buttons + Accelerometer + Extension (21 bytes)
		await this.hid.write([0x12, 0x00, 0x35]);

		// Nunchuk will be detected when valid data arrives
		// Don't set connected yet - wait for valid data
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private startDataTimeout(): void {
		if (this.dataTimeoutTimer) {
			clearTimeout(this.dataTimeoutTimer);
		}
		this.dataTimeoutTimer = setTimeout(() => {
			const elapsed = Date.now() - this.lastDataTime;
			if (elapsed > this.DATA_TIMEOUT_MS) {
				this.emitDisconnect();
			}
		}, this.DATA_TIMEOUT_MS + 100); // Check slightly after timeout threshold
	}

	private clearDataTimeout(): void {
		if (this.dataTimeoutTimer) {
			clearTimeout(this.dataTimeoutTimer);
			this.dataTimeoutTimer = null;
		}
	}

	private emitDisconnect(): void {
		this.clearDataTimeout();
		// Emit disconnect event if listeners are registered
		const disconnectListeners = this.listeners["disconnect"];
		if (disconnectListeners && disconnectListeners.length > 0) {
			disconnectListeners.forEach(listener => listener(true));
		}
		// Also emit error for unhandled cases
		const errorListeners = this.listeners["error"];
		if (errorListeners && errorListeners.length > 0) {
			errorListeners.forEach(listener => listener(new Error("could not read from HID device - timeout")));
		}
	}

	public async disconnect(): Promise<void> {
		if (!this.hid) {
			return;
		}

		// Clear timeout so it doesn't fire during clean disconnect
		this.clearDataTimeout();

		// Turn off LEDs and stop rumble
		await this.hid.write([0x11, 0x00]);

		await this.hid.close();
		this.hid = undefined;

		for (let i = 0; i < remotes.length; ) {
			if (remotes[i] === this) {
				remotes.splice(i, 1);
			} else {
				i++;
			}
		}
	}

	private notifyListeners(button: string, pressed: boolean): void {
		let buttonListeners = this.listeners[button];
		if (buttonListeners !== undefined) {
			buttonListeners.forEach(listener => {
				listener(pressed);
			});
		}
	}

	public on(button: string, listener: (pressed: boolean) => void): void {
		let buttonListeners = this.listeners[button];
		if (buttonListeners === undefined) {
			buttonListeners = [];
			this.listeners[button] = buttonListeners;
		}

		buttonListeners.push(listener);
	}

	private processData(data: Uint8Array, nunchukEnabled: boolean = false): void {
		if (data.length < 17) {
			return;
		}

		// Buttons

		const b1: number = data[1];
		const b2: number = data[2];

		const buttonA: boolean = !!(b2 & 0x08);
		if (this.buttonA !== buttonA) this.notifyListeners("a", buttonA);
		this.buttonA = buttonA;

		const buttonB: boolean = !!(b2 & 0x04);
		if (this.buttonB !== buttonB) this.notifyListeners("b", buttonB);
		this.buttonB = buttonB;

		const button1: boolean = !!(b2 & 0x02);
		if (this.button1 !== button1) this.notifyListeners("1", button1);
		this.button1 = button1;

		const button2: boolean = !!(b2 & 0x01);
		if (this.button2 !== button2) this.notifyListeners("2", button2);
		this.button2 = button2;

		const buttonHome: boolean = !!(b2 & 0x80);
		if (this.buttonHome !== buttonHome)
			this.notifyListeners("home", buttonHome);
		this.buttonHome = buttonHome;

		const buttonPlus: boolean = !!(b1 & 0x10);
		if (this.buttonPlus !== buttonPlus)
			this.notifyListeners("plus", buttonPlus);
		this.buttonPlus = buttonPlus;

		const buttonMinus: boolean = !!(b2 & 0x10);
		if (this.buttonMinus !== buttonMinus)
			this.notifyListeners("minus", buttonMinus);
		this.buttonMinus = buttonMinus;

		const padLeft: boolean = !!(b1 & 0x01);
		if (this.padLeft !== padLeft) this.notifyListeners("left", padLeft);
		this.padLeft = padLeft;

		const padRight: boolean = !!(b1 & 0x02);
		if (this.padRight !== padRight) this.notifyListeners("right", padRight);
		this.padRight = padRight;

		const padUp: boolean = !!(b1 & 0x08);
		if (this.padUp !== padUp) this.notifyListeners("up", padUp);
		this.padUp = padUp;

		const padDown: boolean = !!(b1 & 0x04);
		if (this.padDown !== padDown) this.notifyListeners("down", padDown);
		this.padDown = padDown;

		// Accelerates

		this.accelerateX = ((data[3] - 0x80) << 2) + ((b1 & 0x60) >> 5);
		this.accelerateY = ((data[4] - 0x80) << 2) + ((b2 & 0x20) >> 4);
		this.accelerateZ = ((data[5] - 0x80) << 2) + ((b2 & 0x40) >> 5);

		// IR Camera

		this.irx[0] = data[6] + ((data[8] & 0x30) << 4);
		this.iry[0] = data[7] + ((data[8] & 0xc0) << 2);
		this.irx[1] = data[9] + ((data[8] & 0x03) << 8);
		this.iry[1] = data[10] + ((data[8] & 0x0c) << 6);
		this.irx[2] = data[11] + ((data[13] & 0x30) << 4);
		this.iry[2] = data[12] + ((data[13] & 0xc0) << 2);
		this.irx[3] = data[14] + ((data[13] & 0x03) << 8);
		this.iry[3] = data[15] + ((data[13] & 0x0c) << 6);

		for (let i = 0; i < 4; i++) {
			if (
				this.irx[i] < 0 ||
				this.irx[i] >= 1023 ||
				this.iry[i] < 0 ||
				this.iry[i] >= 1023
			) {
				this.irx[i] = undefined;
				this.iry[i] = undefined;
			}
		}

		// TODO: Camera

		// Nunchuk extension data
		if (nunchukEnabled) {
			this.processNunchukData(data);
		}
	}

	private processNunchukData(data: Uint8Array): void {
		// Debug: log first few packets
		if (this.debugLogCount < 5) {
			this.debugLogCount++;
			console.log(`Nunchuk packet ${this.debugLogCount}: bytes6-11=${Array.from(data.slice(6, 12)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
		}

		const rawStickX = data[6];
		const rawStickY = data[7];
		const rawButtons = data[11];

		// Skip invalid packets (all 0xFF or all 0x00 means no extension)
		if ((rawStickX === 0xFF && rawStickY === 0xFF) || (rawStickX === 0x00 && rawStickY === 0x00)) {
			return;
		}

		// Mark nunchuk as connected when we receive valid data
		this.nunchukConnected = true;

		// Stick values (0-255, center ~128)
		this.nunchukStickX = rawStickX;
		this.nunchukStickY = rawStickY;

		// Buttons: active-low (0=pressed, 1=released), bits 0-1 of byte 11
		const buttonC = !(rawButtons & 0x02);
		const buttonZ = !(rawButtons & 0x01);

		if (this.nunchukButtonC !== buttonC) {
			this.notifyListeners("nunchuk-c", buttonC);
		}
		this.nunchukButtonC = buttonC;

		if (this.nunchukButtonZ !== buttonZ) {
			this.notifyListeners("nunchuk-z", buttonZ);
		}
		this.nunchukButtonZ = buttonZ;

		// Accelerometer (6 bits each)
		this.nunchukAccelX = ((data[8] & 0xFC) << 2) | ((rawButtons >> 6) & 0x03);
		this.nunchukAccelY = ((data[9] & 0xFC) << 2) | ((rawButtons >> 4) & 0x03);
		this.nunchukAccelZ = ((data[10] & 0xFC) << 2) | ((rawButtons >> 2) & 0x03);
	}

	public async rumble(msecs?: number): Promise<void> {
		if (msecs === undefined || msecs === null) msecs = 128;
		if (msecs > 1000) msecs = 1000;

		if (msecs <= 0) {
			this.ledRumbleByte &= 0xfe;
			await this.hid.write([0x11, this.ledRumbleByte]);
			return;
		}

		this.ledRumbleByte |= 0x01;
		await this.hid.write([0x11, this.ledRumbleByte]);

		setTimeout(async () => {
			this.ledRumbleByte &= 0xfe;
			if (this.hid) {
				await this.hid.write([0x11, this.ledRumbleByte]);
			}
		}, msecs);
	}

	public async setLed(id: number, rumbleMsecs?: number): Promise<void> {
		await this.setLeds(id === 1, id === 2, id === 3, id === 4, rumbleMsecs);
	}

	public async setLeds(
		led1: boolean,
		led2: boolean,
		led3: boolean,
		led4: boolean,
		rumbleMsecs?: number
	): Promise<void> {
		this.ledRumbleByte &= 0x0f;
		this.ledRumbleByte |= led1 ? 0x10 : 0x00;
		this.ledRumbleByte |= led2 ? 0x20 : 0x00;
		this.ledRumbleByte |= led3 ? 0x40 : 0x00;
		this.ledRumbleByte |= led4 ? 0x80 : 0x00;

		if (rumbleMsecs === undefined || rumbleMsecs === null) rumbleMsecs = 0;

		// This method also sends the LED data
		await this.rumble(rumbleMsecs);
	}

	public async setLedToPlayer(rumbleMsecs?: number): Promise<void> {
		await this.setLed(this.player, rumbleMsecs);
	}
}

let remotes: Remote[] = [];

export interface ScanResult {
	all: Remote[];
	appeared: Remote[];
	disappeared: Remote[];
	players: { [player: number]: Remote };
}

export async function scanRemotes(assignPlayers?: boolean, enableNunchuk?: boolean): Promise<ScanResult> {
	if (assignPlayers === undefined) assignPlayers = true;
	if (enableNunchuk === undefined) enableNunchuk = false;

	const devices = (await HID.devicesAsync()).filter(device => {
		console.log(device.manufacturer, device.product);
		return (
			device.vendorId === 0x057e &&
			(device.productId === 0x0306 || device.productId === 0x0330)
		);
	});

	const result: ScanResult = {
		all: [],
		appeared: [],
		disappeared: [],
		players: {}
	};

	result.players = {};
	remotes.forEach(remote => {
		result.players[remote.devicePath] = remote;
		if (remote.player) {
			result.players[remote.player] = remote;
		}
	});

	const newRemotesByPath: { [path: string]: Remote } = {};
	for (const device of devices) {
		let remote = remotes.find(r => r.devicePath === device.path);
		if (remote === undefined) {
			remote = await Remote.create(device.path, enableNunchuk);
			result.appeared.push(remote);
		}

		newRemotesByPath[device.path] = remote;
		result.all.push(remote);
	}

	for (const remote of remotes) {
		if (!newRemotesByPath[remote.devicePath]) {
			if (remote.player) {
				delete result.players[remote.player];
			}

			await remote.disconnect();
			result.disappeared.push(remote);
		}
	}

	if (assignPlayers && result.appeared.length) {
		let nextFreePlayer = 1;
		while (nextFreePlayer <= 4 && result.players[nextFreePlayer])
			nextFreePlayer++;

		for (const appeared of result.appeared) {
			if (!appeared.player) {
				appeared.player = nextFreePlayer++;
				await appeared.setLedToPlayer(200);
			}
		}
	}

	remotes = result.all;

	return result;
}

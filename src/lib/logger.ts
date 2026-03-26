// Simple logger that always uses console so output is visible in all environments
// (including Vite 7's SSR module runner, which only forwards console.* calls).
//
// Log level is controlled by the LOG_LEVEL env var:
//   0 = silent, 1 = error, 2 = warn, 3 = info (default), 4 = debug, 5 = trace
//
// Set LOG_LEVEL=4 in .env to enable debug logs.

const LEVEL = process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL, 10) : 3;

function makeLogger(tag: string) {
	const prefix = `[${tag}]`;
	return {
		error: (...args: unknown[]) => { if (LEVEL >= 1) console.error(prefix, ...args); },
		warn:  (...args: unknown[]) => { if (LEVEL >= 2) console.warn(prefix,  ...args); },
		info:  (...args: unknown[]) => { if (LEVEL >= 3) console.log(prefix,   ...args); },
		debug: (...args: unknown[]) => { if (LEVEL >= 4) console.log(prefix,   ...args); },
		trace: (...args: unknown[]) => { if (LEVEL >= 5) console.log(prefix,   ...args); },
	};
}

export const logger = {
	withTag: makeLogger,
	error: (...args: unknown[]) => { if (LEVEL >= 1) console.error(...args); },
	warn:  (...args: unknown[]) => { if (LEVEL >= 2) console.warn(...args);  },
	info:  (...args: unknown[]) => { if (LEVEL >= 3) console.log(...args);   },
	debug: (...args: unknown[]) => { if (LEVEL >= 4) console.log(...args);   },
	trace: (...args: unknown[]) => { if (LEVEL >= 5) console.log(...args);   },
};

import sharp from 'sharp';
import { MAX_DIMENSION } from './constants';

export const MAX_INPUT_PIXELS = MAX_DIMENSION * MAX_DIMENSION;

export interface RgbaColor {
	r: number;
	g: number;
	b: number;
	alpha: number;
}

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_REGEX =
	/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;

const NAMED_COLORS: Record<string, string> = {
	transparent: '#00000000',
	white: '#ffffff',
	black: '#000000',
	red: '#ff0000',
	green: '#008000',
	blue: '#0000ff',
	yellow: '#ffff00',
	cyan: '#00ffff',
	magenta: '#ff00ff',
	gray: '#808080',
	grey: '#808080',
	orange: '#ffa500',
	purple: '#800080',
	pink: '#ffc0cb',
};

/**
 * Creates a Sharp instance configured with `limitInputPixels` (`MAX_DIMENSION * MAX_DIMENSION`)
 * to prevent decompression-bomb Out-Of-Memory crashes on untrusted image inputs.
 */
export function createSafeSharp(
	input?: Buffer | Uint8Array | string | { create: sharp.Create },
	options?: sharp.SharpOptions,
): sharp.Sharp {
	const safeOptions: sharp.SharpOptions = {
		limitInputPixels: MAX_INPUT_PIXELS,
		...options,
	};
	if (input !== undefined && typeof input === 'object' && 'create' in input) {
		return sharp({ create: input.create, ...safeOptions });
	}
	return sharp(input as Buffer | Uint8Array | string | undefined, safeOptions);
}

/**
 * Validates that an input image's dimensions do not exceed `MAX_DIMENSION`.
 */
export async function assertSafeInputMetadata(
	instance: sharp.Sharp,
	context: string,
): Promise<sharp.Metadata> {
	const meta = await instance.metadata();
	if (
		(meta.width !== undefined && meta.width > MAX_DIMENSION) ||
		(meta.height !== undefined && meta.height > MAX_DIMENSION)
	) {
		throw new Error(
			`${context}: Input image dimensions (${meta.width}×${meta.height}) exceed maximum allowed size of ${MAX_DIMENSION}×${MAX_DIMENSION} pixels.`,
		);
	}
	return meta;
}

/**
 * Converts a byte (0-255) to a 2-digit lowercase hex string.
 */
function byteToHex(n: number): string {
	const clamped = Math.max(0, Math.min(255, Math.round(n)));
	return clamped.toString(16).padStart(2, '0');
}

/**
 * Validates and sanitizes a CSS colour string (hex, rgb/rgba, or common named colour)
 * for safe interpolation inside SVG attributes.
 * Falls back to `fallback` if `color` is missing or invalid.
 */
export function sanitizeCssColor(color: unknown, fallback: string): string {
	if (typeof color !== 'string') return fallback;
	const trimmed = color.trim();
	if (!trimmed) return fallback;

	const named = NAMED_COLORS[trimmed.toLowerCase()];
	if (named) {
		return named;
	}

	if (HEX_COLOR_REGEX.test(trimmed)) {
		return trimmed;
	}

	const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
	if (HEX_COLOR_REGEX.test(withHash)) {
		return withHash;
	}

	const rgbMatch = RGB_COLOR_REGEX.exec(trimmed);
	if (rgbMatch) {
		const r = Number(rgbMatch[1]);
		const g = Number(rgbMatch[2]);
		const b = Number(rgbMatch[3]);
		if (r <= 255 && g <= 255 && b <= 255) {
			if (rgbMatch[4] !== undefined) {
				const a = Math.max(0, Math.min(1, Number(rgbMatch[4])));
				return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}${byteToHex(a * 255)}`;
			}
			return `#${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`;
		}
	}

	return fallback;
}

/**
 * Converts a CSS-style colour (#RGB, #RGBA, #RRGGBB, #RRGGBBAA, rgb(), rgba(), or named colour)
 * to a Sharp RGBA object. Correctly preserves `00` alpha as `0` instead of coercing to `1`.
 */
export function hexToRgba(hex: unknown, fallback = '#000000'): RgbaColor {
	const safeColor = sanitizeCssColor(hex, fallback);
	const safeHex = (safeColor.startsWith('#') ? safeColor : sanitizeCssColor(fallback, '#000000')).slice(1);
	let expanded = safeHex;

	if (safeHex.length === 3) {
		expanded = safeHex[0] + safeHex[0] + safeHex[1] + safeHex[1] + safeHex[2] + safeHex[2];
	} else if (safeHex.length === 4) {
		expanded =
			safeHex[0] +
			safeHex[0] +
			safeHex[1] +
			safeHex[1] +
			safeHex[2] +
			safeHex[2] +
			safeHex[3] +
			safeHex[3];
	}

	const rParsed = parseInt(expanded.substring(0, 2), 16);
	const gParsed = parseInt(expanded.substring(2, 4), 16);
	const bParsed = parseInt(expanded.substring(4, 6), 16);
	const aParsed = expanded.length === 8 ? parseInt(expanded.substring(6, 8), 16) : 255;

	return {
		r: Number.isNaN(rParsed) ? 0 : rParsed,
		g: Number.isNaN(gParsed) ? 0 : gParsed,
		b: Number.isNaN(bParsed) ? 0 : bParsed,
		alpha: Number.isNaN(aParsed) ? 1 : Math.round((aParsed / 255) * 1000) / 1000,
	};
}

/**
 * Word-wraps text to a maximum number of characters per line, preserving explicit newlines
 * and breaking single tokens that exceed `maxLineLength`.
 */
export function wrapText(text: string, maxLineLength: number): string {
	const safeMax = Math.max(1, Math.floor(Number(maxLineLength) || 40));
	const normalized = String(text ?? '').replace(/\r\n/g, '\n');
	const lines: string[] = [];

	for (const paragraph of normalized.split('\n')) {
		let current = '';
		for (const rawWord of paragraph.split(' ')) {
			let word = rawWord;
			while (word.length > safeMax) {
				if (current.length > 0) {
					lines.push(current.trimEnd());
					current = '';
				}
				lines.push(word.slice(0, safeMax));
				word = word.slice(safeMax);
			}
			if (current.length + word.length > safeMax && current.length > 0) {
				lines.push(current.trimEnd());
				current = `${word} `;
			} else {
				current += `${word} `;
			}
		}
		lines.push(current.trimEnd());
	}
	return lines.join('\n');
}

/**
 * Escapes characters that would break inline SVG text or attributes, and strips invalid XML 1.0 control chars.
 */
export function escapeSvg(str: unknown): string {
	return String(str ?? '')
		// eslint-disable-next-line no-control-regex
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Extracts the primary font-family name from a raw value and strips unsafe characters.
 * Handles legacy CSS stacks like `"Playfair Display", serif` as well as plain names like `Arial`.
 */
export function normalizeFontFamily(raw: unknown, fallback = 'Arial'): string {
	if (typeof raw !== 'string' || !raw.trim() || raw === 'custom') return fallback;
	const primary = raw.split(',')[0].trim().replace(/^["']|["']$/g, '');
	const sanitized = primary.replace(/[^a-zA-Z0-9\s_\-.]/g, '').trim();
	return sanitized || fallback;
}

/**
 * Returns a font-family value safe for use inside a double-quoted SVG attribute.
 * NOTE: librsvg fails to parse font-family strings containing single or double quotes,
 * so we return the sanitized unquoted family name.
 */
export function toSvgFontFamily(raw: unknown, fallback = 'Arial'): string {
	return escapeSvg(normalizeFontFamily(raw, fallback));
}

/**
 * Clamps a numeric input between `min` and `max`, returning `fallback` if not finite.
 */
export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
	if (value === undefined || value === null || value === '') return fallback;
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	return Math.min(max, Math.max(min, num));
}

/**
 * Validates canvas/image width and height against `MAX_DIMENSION` to prevent OOM crashes.
 */
export function validateDimensions(
	width: unknown,
	height: unknown,
	context: string,
	defaultWidth = 1080,
	defaultHeight = 1080,
): { width: number; height: number } {
	const w = Math.round(Number(width ?? defaultWidth));
	const h = Math.round(Number(height ?? defaultHeight));

	if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
		throw new Error(
			`${context}: Image width (${width}) and height (${height}) must be positive integers >= 1.`,
		);
	}
	if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
		throw new Error(
			`${context}: Requested dimensions (${w}×${h}) exceed maximum allowed size of ${MAX_DIMENSION}×${MAX_DIMENSION} pixels.`,
		);
	}
	return { width: w, height: h };
}

/**
 * Sanitizes a user-supplied output filename against path traversal (`../`, `/`, `\`),
 * control/reserved characters, and ensures its extension matches the output `format`.
 */
export function normalizeOutputFileName(rawFileName: unknown, format: string): string {
	const ext = format.toLowerCase();
	const trimmed = typeof rawFileName === 'string' ? rawFileName.trim() : '';
	if (!trimmed) {
		return `image.${ext}`;
	}

	// Strip directory traversal components by extracting only the final path segment
	const baseSegment = trimmed.split(/[/\\]/).pop() ?? '';
	// Remove control chars, Windows/POSIX reserved filename chars, and leading dots/spaces
	const safeSegment = baseSegment
		// eslint-disable-next-line no-control-regex
		.replace(/[\x00-\x1F<>:"/\\|?*]/g, '')
		.replace(/^\.+/, '')
		.trim();

	if (!safeSegment) {
		return `image.${ext}`;
	}

	const extMatch = /^(.*?)\.(png|jpe?g|webp|avif|tiff?|gif)$/i.exec(safeSegment);
	if (extMatch) {
		const stem = extMatch[1].trim() || 'image';
		const existingExt = extMatch[2].toLowerCase();
		if (
			existingExt === ext ||
			(ext === 'jpeg' && existingExt === 'jpg') ||
			(ext === 'tiff' && existingExt === 'tif')
		) {
			return `${stem}.${existingExt}`;
		}
		return `${stem}.${ext}`;
	}

	return `${safeSegment}.${ext}`;
}

/**
 * Converts Sharp metadata into a JSON-safe object by replacing raw binary `Buffer` fields
 * (`exif`, `icc`, `iptc`, `xmp`, `tifftagPhotoshop`) with boolean/byte-length summaries.
 */
export function formatSafeMetadata(meta: sharp.Metadata): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(meta)) {
		if (Buffer.isBuffer(val)) {
			const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
			out[`has${capitalized}`] = val.length > 0;
			out[`${key}ByteLength`] = val.length;
		} else if (Array.isArray(val)) {
			out[key] = val.map((item) =>
				item && typeof item === 'object' && 'data' in item && Buffer.isBuffer(item.data)
					? { ...item, data: undefined, byteLength: item.data.length }
					: item,
			);
		} else {
			out[key] = val;
		}
	}
	return out;
}



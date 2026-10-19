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
 * Internal helper that parses any supported CSS colour string (#RGB, #RGBA, #RRGGBB, #RRGGBBAA,
 * rgb(), rgba(), or named colour) into an `RgbaColor`, or returns `null` if invalid.
 */
function parseCssColorToRgba(color: unknown): RgbaColor | null {
	if (typeof color !== 'string') return null;
	const trimmed = color.trim();
	if (!trimmed) return null;

	const resolved = NAMED_COLORS[trimmed.toLowerCase()] ?? trimmed;
	const hexCandidate = resolved.startsWith('#') ? resolved : `#${resolved}`;

	if (HEX_COLOR_REGEX.test(hexCandidate)) {
		const rawHex = hexCandidate.slice(1);
		let expanded = rawHex;
		if (rawHex.length === 3) {
			expanded = rawHex[0] + rawHex[0] + rawHex[1] + rawHex[1] + rawHex[2] + rawHex[2];
		} else if (rawHex.length === 4) {
			expanded =
				rawHex[0] +
				rawHex[0] +
				rawHex[1] +
				rawHex[1] +
				rawHex[2] +
				rawHex[2] +
				rawHex[3] +
				rawHex[3];
		}

		const rParsed = parseInt(expanded.substring(0, 2), 16);
		const gParsed = parseInt(expanded.substring(2, 4), 16);
		const bParsed = parseInt(expanded.substring(4, 6), 16);
		const aParsed = expanded.length === 8 ? parseInt(expanded.substring(6, 8), 16) : 255;

		if (
			!Number.isNaN(rParsed) &&
			!Number.isNaN(gParsed) &&
			!Number.isNaN(bParsed) &&
			!Number.isNaN(aParsed)
		) {
			return {
				r: rParsed,
				g: gParsed,
				b: bParsed,
				alpha: Math.round((aParsed / 255) * 1000) / 1000,
			};
		}
	}

	const rgbMatch = RGB_COLOR_REGEX.exec(resolved);
	if (rgbMatch) {
		const r = Number(rgbMatch[1]);
		const g = Number(rgbMatch[2]);
		const b = Number(rgbMatch[3]);
		if (r <= 255 && g <= 255 && b <= 255) {
			const a =
				rgbMatch[4] !== undefined
					? Math.round(Math.max(0, Math.min(1, Number(rgbMatch[4]))) * 1000) / 1000
					: 1;
			return { r, g, b, alpha: a };
		}
	}

	return null;
}

/**
 * Validates and sanitizes a CSS colour string (hex, rgb/rgba, or common named colour)
 * for safe interpolation inside SVG 1.1 attributes (`fill`, `stroke`, `stop-color`, `flood-color`).
 * Emits `#rrggbb` for opaque colours and `rgba(r, g, b, a)` for translucent colours (`alpha < 1`)
 * so `librsvg` reliably renders alpha channels across all versions.
 */
export function sanitizeCssColor(color: unknown, fallback: string): string {
	const parsed = parseCssColorToRgba(color);
	if (!parsed) {
		const fbParsed = parseCssColorToRgba(fallback);
		if (!fbParsed) return fallback;
		if (fbParsed.alpha < 1) {
			return `rgba(${fbParsed.r}, ${fbParsed.g}, ${fbParsed.b}, ${fbParsed.alpha})`;
		}
		return `#${byteToHex(fbParsed.r)}${byteToHex(fbParsed.g)}${byteToHex(fbParsed.b)}`;
	}

	if (parsed.alpha < 1) {
		return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${parsed.alpha})`;
	}
	return `#${byteToHex(parsed.r)}${byteToHex(parsed.g)}${byteToHex(parsed.b)}`;
}

/**
 * Converts a CSS-style colour (#RGB, #RGBA, #RRGGBB, #RRGGBBAA, rgb(), rgba(), or named colour)
 * to a Sharp RGBA object. Correctly preserves `00` alpha as `0` instead of coercing to `1`.
 */
export function hexToRgba(hex: unknown, fallback = '#000000'): RgbaColor {
	return (
		parseCssColorToRgba(hex) ??
		parseCssColorToRgba(fallback) ?? { r: 0, g: 0, b: 0, alpha: 1 }
	);
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



import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import type sharp from 'sharp';
import { MAX_BORDER, MAX_DIMENSION, MAX_SHEAR_DEGREES, MIN_SHEAR_DEGREES } from './constants';
import { OPERATION_PARAM_MAP } from './properties';
import { buildTemplateInstance } from './templateBuilder';
import {
	assertSafeInputMetadata,
	clampNumber,
	createSafeSharp,
	escapeSvg,
	hexToRgba,
	sanitizeCssColor,
	toSvgFontFamily,
	validateDimensions,
	wrapText,
} from './utils';

/**
 * Collects parameters for single-step mode using the auto-derived `OPERATION_PARAM_MAP`.
 */
export function buildSingleOpParams(
	ctx: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): IDataObject {
	const result: IDataObject = {};
	const params = OPERATION_PARAM_MAP[operation] ?? [];
	for (const p of params) {
		try {
			result[p] = ctx.getNodeParameter(p, itemIndex);
		} catch {
			// Parameter hidden by displayOptions (e.g. fontFamilyCustom when fontFamily !== 'custom')
		}
	}
	return result;
}

/**
 * Creates a blank RGBA Sharp canvas with validated dimensions.
 */
export function createBlankCanvas(op: IDataObject): sharp.Sharp {
	const { width, height } = validateDimensions(
		op.width,
		op.height,
		'Create operation',
		1080,
		1080,
	);
	const bg = hexToRgba(op.backgroundColor, '#ffffff');
	return createSafeSharp({
		create: {
			width,
			height,
			channels: 4,
			background: { r: bg.r, g: bg.g, b: bg.b, alpha: bg.alpha },
		},
	});
}

/**
 * Normalizes SVG text-anchor values, preserving backwards compatibility with legacy `'center'` defaults.
 */
function normalizeTextAlign(align: unknown): 'start' | 'middle' | 'end' {
	if (align === 'start' || align === 'left') return 'start';
	if (align === 'end' || align === 'right') return 'end';
	return 'middle';
}

/**
 * Applies a single image operation to the given Sharp instance.
 */
export async function applyOperation(
	ctx: IExecuteFunctions,
	instance: sharp.Sharp,
	op: IDataObject,
	itemIndex: number,
	stepIndex = 0,
): Promise<sharp.Sharp> {
	const operation = op.operation as string;

	if (operation === 'blur') {
		const sigma = clampNumber(op.sigma, 0.3, 1000, 3);
		return instance.blur(sigma);
	}

	if (operation === 'border') {
		const bw = Math.round(clampNumber(op.borderWidth, 0, MAX_BORDER, 20));
		const bh = Math.round(clampNumber(op.borderHeight, 0, MAX_BORDER, 20));
		const meta = await instance.metadata();
		if (meta.width !== undefined && meta.height !== undefined) {
			const newW = meta.width + bw * 2;
			const newH = meta.height + bh * 2;
			if (newW > MAX_DIMENSION || newH > MAX_DIMENSION) {
				throw new Error(
					`Border operation: Resulting dimensions (${newW}×${newH}) exceed maximum allowed size of ${MAX_DIMENSION}×${MAX_DIMENSION} pixels.`,
				);
			}
		}
		const col = hexToRgba(op.borderColor, '#000000');
		return instance.extend({
			top: bh,
			bottom: bh,
			left: bw,
			right: bw,
			background: { r: col.r, g: col.g, b: col.b, alpha: col.alpha },
		});
	}

	if (operation === 'composite') {
		const propName = ((op.dataPropertyNameComposite as string) || 'data2').trim();
		ctx.helpers.assertBinaryData(itemIndex, propName);
		const overlayBuf = await ctx.helpers.getBinaryDataBuffer(itemIndex, propName);

		const baseMeta = await instance.metadata();
		const baseW = baseMeta.width ?? 800;
		const baseH = baseMeta.height ?? 600;

		const overlaySharp = createSafeSharp(overlayBuf);
		const overlayMeta = await assertSafeInputMetadata(overlaySharp, 'Composite operation');
		const ovW = overlayMeta.width ?? baseW;
		const ovH = overlayMeta.height ?? baseH;

		const rawLeft = Math.round(clampNumber(op.positionX, -MAX_DIMENSION, MAX_DIMENSION, 0));
		const rawTop = Math.round(clampNumber(op.positionY, -MAX_DIMENSION, MAX_DIMENSION, 0));

		// Calculate visible intersection rectangle on the base canvas
		const srcLeft = Math.max(0, -rawLeft);
		const srcTop = Math.max(0, -rawTop);
		const dstLeft = Math.max(0, rawLeft);
		const dstTop = Math.max(0, rawTop);
		const visibleW = Math.min(ovW - srcLeft, baseW - dstLeft);
		const visibleH = Math.min(ovH - srcTop, baseH - dstTop);

		if (visibleW <= 0 || visibleH <= 0) {
			throw new Error(
				`Composite operation: Overlay placed at (${rawLeft}, ${rawTop}) with size ${ovW}×${ovH} lies completely outside the base canvas (${baseW}×${baseH}).`,
			);
		}

		let preparedOverlay: Buffer = overlayBuf;
		if (srcLeft > 0 || srcTop > 0 || visibleW < ovW || visibleH < ovH) {
			preparedOverlay = await createSafeSharp(overlayBuf)
				.extract({ left: srcLeft, top: srcTop, width: visibleW, height: visibleH })
				.toBuffer();
		}

		return instance.composite([
			{
				input: preparedOverlay,
				left: dstLeft,
				top: dstTop,
				blend: (op.operator as sharp.Blend) || 'over',
			},
		]);
	}

	if (operation === 'create') {
		if (stepIndex === 0) {
			return instance;
		}
		return createBlankCanvas(op);
	}

	if (operation === 'template') {
		if (stepIndex === 0) {
			return instance;
		}
		return buildTemplateInstance(op);
	}

	if (operation === 'crop') {
		const left = Math.round(Number(op.positionX ?? 0));
		const top = Math.round(Number(op.positionY ?? 0));
		const { width, height } = validateDimensions(op.width, op.height, 'Crop operation', 500, 500);

		if (!Number.isFinite(left) || !Number.isFinite(top) || left < 0 || top < 0) {
			throw new Error(
				`Crop operation: Position X (${op.positionX}) and Position Y (${op.positionY}) must be non-negative integers.`,
			);
		}

		const meta = await instance.metadata();
		if (meta.width !== undefined && meta.height !== undefined) {
			if (left + width > meta.width || top + height > meta.height) {
				throw new Error(
					`Crop operation: Crop region (left=${left}, top=${top}, width=${width}, height=${height}) exceeds source image dimensions (${meta.width}×${meta.height}).`,
				);
			}
		}

		return instance.extract({ left, top, width, height });
	}

	if (operation === 'draw') {
		const meta = await instance.metadata();
		const imgW = meta.width ?? 800;
		const imgH = meta.height ?? 600;
		const fillColor = sanitizeCssColor(op.color, '#ff0000');
		const strokeColor = sanitizeCssColor(op.strokeColor, '#000000');
		const strokeWidth = clampNumber(op.strokeWidth, 0, 1000, 0);
		const x1 = clampNumber(op.startPositionX, -MAX_DIMENSION, MAX_DIMENSION, 0);
		const y1 = clampNumber(op.startPositionY, -MAX_DIMENSION, MAX_DIMENSION, 0);
		const x2 = clampNumber(op.endPositionX, -MAX_DIMENSION, MAX_DIMENSION, 100);
		const y2 = clampNumber(op.endPositionY, -MAX_DIMENSION, MAX_DIMENSION, 100);
		const primitive = (op.primitive as string) ?? 'rectangle';
		const cr = clampNumber(op.cornerRadius, 0, MAX_DIMENSION, 0);
		const strokeAttr =
			strokeWidth > 0 ? `stroke="${strokeColor}" stroke-width="${strokeWidth}"` : 'stroke="none"';

		let shapeSvg = '';
		if (primitive === 'rectangle') {
			const w = Math.abs(x2 - x1);
			const h = Math.abs(y2 - y1);
			shapeSvg = `<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${w}" height="${h}" rx="${cr}" ry="${cr}" fill="${fillColor}" ${strokeAttr}/>`;
		} else if (primitive === 'circle') {
			const cx = (x1 + x2) / 2;
			const cy = (y1 + y2) / 2;
			const rx = Math.abs(x2 - x1) / 2;
			const ry = Math.abs(y2 - y1) / 2;
			shapeSvg = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fillColor}" ${strokeAttr}/>`;
		} else if (primitive === 'line') {
			shapeSvg = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${fillColor}" stroke-width="${Math.max(1, strokeWidth || 2)}" stroke-linecap="round"/>`;
		}

		const svg = `<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">${shapeSvg}</svg>`;
		return instance.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
	}

	if (operation === 'flip') {
		return instance.flip();
	}

	if (operation === 'flop') {
		return instance.flop();
	}

	if (operation === 'gamma') {
		const g = clampNumber(op.gammaValue, 1.0, 3.0, 2.2);
		return instance.gamma(g);
	}

	if (operation === 'grayscale') {
		return instance.grayscale();
	}

	if (operation === 'normalize') {
		return instance.normalize();
	}

	if (operation === 'resize') {
		const fitMap: Record<string, keyof sharp.FitEnum> = {
			cover: 'cover',
			contain: 'contain',
			fill: 'fill',
			inside: 'inside',
			outside: 'outside',
		};
		const fit = fitMap[(op.resizeOption as string) ?? 'cover'] ?? 'cover';
		const { width, height } = validateDimensions(op.width, op.height, 'Resize operation', 1080, 1080);
		const bg = op.resizeBackground
			? hexToRgba(op.resizeBackground, '#000000')
			: { r: 0, g: 0, b: 0, alpha: 1 };
		return instance.resize({
			width,
			height,
			fit,
			background: { r: bg.r, g: bg.g, b: bg.b, alpha: bg.alpha },
			withoutEnlargement: false,
		});
	}

	if (operation === 'rotate') {
		const bg = hexToRgba(op.backgroundColor, '#00000000');
		const angle = clampNumber(op.rotate, -360, 360, 0);
		return instance.rotate(angle, {
			background: { r: bg.r, g: bg.g, b: bg.b, alpha: bg.alpha },
		});
	}

	if (operation === 'sepia') {
		return instance.toColorspace('srgb').recomb([
			[0.3588, 0.7044, 0.1368],
			[0.299, 0.587, 0.114],
			[0.2392, 0.4696, 0.0912],
		]);
	}

	if (operation === 'sharpen') {
		const sigma = clampNumber(op.sharpenSigma, 0.01, 10000, 1);
		const flat = clampNumber(op.sharpenFlat, 0, 10000, 1);
		const jagged = clampNumber(op.sharpenJagged, 0, 10000, 2);
		return instance.sharpen({ sigma, m1: flat, m2: jagged });
	}

	if (operation === 'shear') {
		const dx = clampNumber(op.degreesX, MIN_SHEAR_DEGREES, MAX_SHEAR_DEGREES, 0);
		const dy = clampNumber(op.degreesY, MIN_SHEAR_DEGREES, MAX_SHEAR_DEGREES, 10);
		const tanX = Math.tan((dx * Math.PI) / 180);
		const tanY = Math.tan((dy * Math.PI) / 180);
		const det = 1 - tanX * tanY;
		if (Math.abs(det) < 1e-3) {
			throw new Error(
				`Shear operation: Combined X (${dx}°) and Y (${dy}°) shear angles produce a degenerate (singular) transformation matrix.`,
			);
		}
		const meta = await instance.metadata();
		if (meta.width !== undefined && meta.height !== undefined) {
			const shearedW = Math.ceil(meta.width + meta.height * Math.abs(tanX));
			const shearedH = Math.ceil(meta.height + meta.width * Math.abs(tanY));
			if (shearedW > MAX_DIMENSION || shearedH > MAX_DIMENSION) {
				throw new Error(
					`Shear operation: Resulting dimensions (${shearedW}×${shearedH}) exceed maximum allowed size of ${MAX_DIMENSION}×${MAX_DIMENSION} pixels.`,
				);
			}
		}
		return instance.affine([1, tanX, tanY, 1], {
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		});
	}

	if (operation === 'text') {
		const meta = await instance.metadata();
		const imgW = meta.width ?? 800;
		const imgH = meta.height ?? 600;

		const rawText = (op.text as string) ?? '';
		const lineLen = clampNumber(op.lineLength, 1, 10000, 40);
		const wrapped = wrapText(rawText, lineLen);
		const lines = wrapped.split('\n');

		const fontSize = clampNumber(op.fontSize, 1, 4000, 48);
		const fontColor = sanitizeCssColor(op.fontColor, '#ffffff');
		const rawStyle = (op.fontStyle as string) ?? 'normal';
		// Preserve backwards compatibility with legacy saved workflows using `fontWeight`
		const fontWeight =
			rawStyle.includes('bold') || (op.fontWeight as string) === 'bold' ? 'bold' : 'normal';
		const fontStyle = rawStyle.includes('italic') ? 'italic' : 'normal';

		const rawFamily = (op.fontFamily as string) ?? 'Arial';
		const resolvedFamily =
			rawFamily === 'custom' ? (op.fontFamilyCustom as string) || 'Arial' : rawFamily;
		const fontFamily = toSvgFontFamily(resolvedFamily, 'Arial');

		const textAlign = normalizeTextAlign(op.textAlign);
		const isUntouchedDefaultCenter =
			op.positionX === 540 && op.positionY === 540 && (imgW < 540 || imgH < 540);
		const posX = isUntouchedDefaultCenter
			? Math.round(imgW / 2)
			: clampNumber(op.positionX, -MAX_DIMENSION, MAX_DIMENSION, Math.round(imgW / 2));
		const posY = isUntouchedDefaultCenter
			? Math.round(imgH / 2)
			: clampNumber(op.positionY, -MAX_DIMENSION, MAX_DIMENSION, Math.round(imgH / 2));
		const lineHeight = clampNumber(op.lineHeight, 0.5, 5, 1.4) * fontSize;
		const shadow = Boolean(op.textShadow);

		const shadowFilter = shadow
			? '<filter id="ts" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/></filter>'
			: '';
		const filterAttr = shadow ? ' filter="url(#ts)"' : '';

		const startY = Math.round(posY - ((lines.length - 1) * lineHeight) / 2);
		const tspans = lines
			.map((line, i) => `<tspan x="${posX}" dy="${i === 0 ? 0 : lineHeight}">${escapeSvg(line)}</tspan>`)
			.join('');

		const svg = `<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">
  <defs>${shadowFilter}</defs>
  <text
    x="${posX}" y="${startY}"
    font-family="${fontFamily}"
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    font-style="${fontStyle}"
    text-anchor="${textAlign}"
    dominant-baseline="middle"
    fill="${fontColor}"${filterAttr}>${tspans}</text>
</svg>`;

		return instance.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
	}

	if (operation === 'tint') {
		const col = hexToRgba(op.tintColor, '#ff6b35');
		return instance.toColorspace('srgb').tint({ r: col.r, g: col.g, b: col.b });
	}

	if (operation === 'transparent') {
		await assertSafeInputMetadata(instance, 'Transparent operation');
		const targetCol = hexToRgba(op.transparentColor, '#ffffff');
		const tolerance = clampNumber(op.tolerance, 0, 255, 30);

		const { data: rawData, info } = await instance
			.toColorspace('srgb')
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		const totalBytes = rawData.length;
		for (let idx = 0; idx < totalBytes; idx += 4) {
			const dr = Math.abs(rawData[idx] - targetCol.r);
			const dg = Math.abs(rawData[idx + 1] - targetCol.g);
			const db = Math.abs(rawData[idx + 2] - targetCol.b);
			if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
				rawData[idx + 3] = 0;
			}
		}

		return createSafeSharp(rawData, {
			raw: { width: info.width, height: info.height, channels: info.channels },
		});
	}

	if (operation === 'watermark') {
		const wmProp = ((op.watermarkProperty as string) || 'watermark').trim();
		ctx.helpers.assertBinaryData(itemIndex, wmProp);
		const wmBuf = await ctx.helpers.getBinaryDataBuffer(itemIndex, wmProp);

		const meta = await instance.metadata();
		const imgW = meta.width ?? 800;
		const imgH = meta.height ?? 600;
		const scalePercent = clampNumber(op.watermarkScale, 1, 100, 20);
		const opacity = clampNumber(op.watermarkOpacity, 0, 100, 50) / 100;
		const gravity = (op.watermarkGravity as string) ?? 'southeast';

		const maxDim = Math.max(1, Math.round(Math.max(imgW, imgH) * (scalePercent / 100)));
		const targetW = Math.max(1, Math.min(imgW, maxDim));
		const targetH = Math.max(1, Math.min(imgH, maxDim));

		const wmSharp = createSafeSharp(wmBuf);
		await assertSafeInputMetadata(wmSharp, 'Watermark operation');

		const { data: wmRaw, info: wmInfo } = await wmSharp
			.resize(targetW, targetH, { fit: 'inside', withoutEnlargement: true })
			.toColorspace('srgb')
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		// Mutate alpha channel in-place without extra buffer copies
		for (let idx = 3; idx < wmRaw.length; idx += 4) {
			wmRaw[idx] = Math.round(wmRaw[idx] * opacity);
		}

		const wmProcessed = await createSafeSharp(wmRaw, {
			raw: { width: wmInfo.width, height: wmInfo.height, channels: wmInfo.channels },
		})
			.png()
			.toBuffer();

		return instance.composite([
			{
				input: wmProcessed,
				gravity: gravity as sharp.Gravity,
				blend: 'over',
			},
		]);
	}

	return instance;
}


import type { IDataObject } from 'n8n-workflow';
import type sharp from 'sharp';
import { IMAGE_TEMPLATES } from './constants';
import {
	clampNumber,
	createSafeSharp,
	escapeSvg,
	sanitizeCssColor,
	toSvgFontFamily,
	validateDimensions,
	wrapText,
} from './utils';

function parseFontStyle(styleStr: string): string {
	let attrs = '';
	if (styleStr.includes('bold')) attrs += ' font-weight="bold"';
	if (styleStr.includes('italic')) attrs += ' font-style="italic"';
	return attrs;
}

/**
 * Builds a Sharp pipeline containing a rendered social media / graphic template canvas.
 */
export async function buildTemplateInstance(op: IDataObject): Promise<sharp.Sharp> {
	const templateName = (op.templateName as string) || 'Instagram Post (1:1)';
	const tpl = IMAGE_TEMPLATES.find((t) => t.name === templateName) ?? IMAGE_TEMPLATES[0];
	const rawWidth = templateName === 'Custom' ? (op.customWidth ?? 800) : tpl.width;
	const rawHeight = templateName === 'Custom' ? (op.customHeight ?? 600) : tpl.height;
	const { width, height } = validateDimensions(rawWidth, rawHeight, 'Template operation', 800, 600);

	const bgColorHex = sanitizeCssColor(op.templateBgColor, '#1a1a2e');
	const layout = ((op.templateLayout as string) ?? 'standard').trim();

	const rawTitleText = ((op.templateTitle as string) ?? '').trim();
	const rawSubtitleText = ((op.templateSubtitle as string) ?? '').trim();
	const titleColor = sanitizeCssColor(op.templateTitleColor, '#ffffff');
	const subtitleColor = sanitizeCssColor(op.templateSubtitleColor, '#cccccc');
	const accentColor = sanitizeCssColor(op.templateAccentColor, '#e94560');
	const gradientColor = sanitizeCssColor(op.templateGradientColor, accentColor);

	const rawQuoteText = ((op.templateQuote as string) ?? '').trim();
	const quoteAuthor = escapeSvg(((op.templateQuoteAuthor as string) ?? '').trim());

	const rawMemeTop = ((op.templateMemeTop as string) ?? '').toUpperCase().trim();
	const rawMemeBottom = ((op.templateMemeBottom as string) ?? '').toUpperCase().trim();

	// Fonts — sanitized via toSvgFontFamily
	const titleFont = toSvgFontFamily(
		op.templateTitleFont === 'custom' ? op.templateTitleFontCustom : op.templateTitleFont,
		'Arial',
	);
	const subtitleFont = toSvgFontFamily(
		op.templateSubtitleFont === 'custom' ? op.templateSubtitleFontCustom : op.templateSubtitleFont,
		'Arial',
	);
	const quoteFont = toSvgFontFamily(
		op.templateQuoteFont === 'custom' ? op.templateQuoteFontCustom : op.templateQuoteFont,
		'Georgia',
	);
	const authorFont = toSvgFontFamily(
		op.templateQuoteAuthorFont === 'custom'
			? op.templateQuoteAuthorFontCustom
			: op.templateQuoteAuthorFont,
		'Arial',
	);
	const memeTopFont = toSvgFontFamily(
		op.templateMemeTopFont === 'custom' ? op.templateMemeTopFontCustom : op.templateMemeTopFont,
		'Impact',
	);
	const memeBottomFont = toSvgFontFamily(
		op.templateMemeBottomFont === 'custom'
			? op.templateMemeBottomFontCustom
			: op.templateMemeBottomFont,
		'Impact',
	);

	const titleStyleAttr = parseFontStyle((op.templateTitleFontStyle as string) ?? 'bold');
	const subtitleStyleAttr = parseFontStyle((op.templateSubtitleFontStyle as string) ?? 'normal');
	const quoteStyleAttr = parseFontStyle((op.templateQuoteFontStyle as string) ?? 'italic');
	const authorStyleAttr = parseFontStyle((op.templateQuoteAuthorFontStyle as string) ?? 'normal');
	const memeTopStyleAttr = parseFontStyle((op.templateMemeTopFontStyle as string) ?? 'bold');
	const memeBottomStyleAttr = parseFontStyle((op.templateMemeBottomFontStyle as string) ?? 'bold');

	// Quote Watermark
	const quoteWmText = escapeSvg(((op.quoteWatermarkText as string) ?? '').trim());
	const quoteWmFont = toSvgFontFamily(
		op.quoteWatermarkFont === 'custom' ? op.quoteWatermarkFontCustom : op.quoteWatermarkFont,
		'Arial',
	);
	const quoteWmColor = sanitizeCssColor(op.quoteWatermarkColor, '#ffffff');
	const quoteWmOpacity = clampNumber(op.quoteWatermarkOpacity, 0, 100, 30) / 100;
	const quoteWmX = clampNumber(op.quoteWatermarkX, 0, 100, 50);
	const quoteWmY = clampNumber(op.quoteWatermarkY, 0, 100, 95);

	// Text Effects
	const textEffect = (op.templateTextEffect as string) ?? 'default';
	const effectColor = sanitizeCssColor(op.templateEffectColor, '#000000');
	const effectOpacity = clampNumber(op.templateEffectOpacity, 0, 100, 50) / 100;
	const effectBlur = clampNumber(op.templateEffectBlur, 0, 200, 4);
	const effectOffsetX = clampNumber(op.templateEffectOffsetX, -1000, 1000, 2);
	const effectOffsetY = clampNumber(op.templateEffectOffsetY, -1000, 1000, 2);
	const effectOutlineWidth = clampNumber(op.templateEffectOutlineWidth, 0, 200, 2);

	let customFilterSvg = '';
	let applyFilterAttr = '';
	let applyStrokeAttr = '';

	if (textEffect === 'default') {
		customFilterSvg = `
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="2" dy="2" stdDeviation="4" flood-opacity="0.5"/>
    </filter>`;
		applyFilterAttr = 'filter="url(#shadow)"';
	} else if (textEffect === 'shadow') {
		customFilterSvg = `
    <filter id="customEffect" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="${effectOffsetX}" dy="${effectOffsetY}" stdDeviation="${effectBlur}" flood-color="${effectColor}" flood-opacity="${effectOpacity}"/>
    </filter>`;
		applyFilterAttr = 'filter="url(#customEffect)"';
	} else if (textEffect === 'glow') {
		customFilterSvg = `
    <filter id="customEffect" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="${effectBlur}" flood-color="${effectColor}" flood-opacity="${effectOpacity}"/>
    </filter>`;
		applyFilterAttr = 'filter="url(#customEffect)"';
	} else if (textEffect === 'outline') {
		applyStrokeAttr = `stroke="${effectColor}" stroke-width="${effectOutlineWidth}" stroke-linejoin="round" paint-order="stroke fill"`;
	}

	const effectAttrMain =
		textEffect === 'default'
			? 'filter="url(#shadow)"'
			: `${applyFilterAttr} ${applyStrokeAttr}`.trim();
	const effectAttrSub =
		textEffect === 'default' ? '' : `${applyFilterAttr} ${applyStrokeAttr}`.trim();

	// Responsive font sizes
	const titleFontSize = Math.max(24, Math.round(width * 0.065));
	const subtitleFontSize = Math.max(16, Math.round(width * 0.033));
	const padding = Math.round(width * 0.06);
	const accentBarH = Math.max(4, Math.round(height * 0.006));

	// Title Y position — roughly 45% from top
	const titleY = Math.round(height * 0.45);
	const titleLineHeight = Math.round(titleFontSize * 1.25);
	const subtitleLineHeight = Math.round(subtitleFontSize * 1.35);

	// Accent bar X and Y
	let accentBarX = padding;
	let accentBarY = titleY - titleFontSize * 1.4;

	let titleSvg = '';
	let titleLineCount = 1;
	if (rawTitleText && layout === 'standard') {
		const maxTitleChars = Math.max(10, Math.floor((width - padding * 2) / (titleFontSize * 0.58)));
		const titleLines = wrapText(rawTitleText, maxTitleChars).split('\n');
		titleLineCount = titleLines.length;
		const titleTspans = titleLines
			.map((l, i) => `<tspan x="${padding}" dy="${i === 0 ? 0 : titleLineHeight}">${escapeSvg(l)}</tspan>`)
			.join('');

		titleSvg = `
		<text
			x="${padding}" y="${titleY}"
			font-family="${titleFont}"
			font-size="${titleFontSize}"${titleStyleAttr}
			fill="${titleColor}"
			${effectAttrMain}
		>${titleTspans}</text>`;
	}

	const subtitleY = Math.round(
		titleY + Math.max(0, titleLineCount - 1) * titleLineHeight + titleFontSize * 1.2,
	);

	let subtitleSvg = '';
	if (rawSubtitleText && layout === 'standard') {
		const maxSubChars = Math.max(15, Math.floor((width - padding * 2) / (subtitleFontSize * 0.55)));
		const subLines = wrapText(rawSubtitleText, maxSubChars).split('\n');
		const subTspans = subLines
			.map((l, i) => `<tspan x="${padding}" dy="${i === 0 ? 0 : subtitleLineHeight}">${escapeSvg(l)}</tspan>`)
			.join('');

		subtitleSvg = `
		<text
			x="${padding}" y="${subtitleY}"
			font-family="${subtitleFont}"
			font-size="${subtitleFontSize}"${subtitleStyleAttr}
			fill="${subtitleColor}"
			opacity="0.9"
			${effectAttrSub}
		>${subTspans}</text>`;
	}

	let quoteSvg = '';
	if (rawQuoteText && layout === 'quote') {
		const qFontSize = Math.max(24, Math.round(width * 0.055));
		const maxCharsPerLine = Math.max(10, Math.floor(width / (qFontSize * 0.6)));
		// Wrap raw text BEFORE escaping XML entities so entity lengths don't skew line wrapping
		const wrappedQuote = wrapText(rawQuoteText, maxCharsPerLine);
		const lines = wrappedQuote.split('\n');

		// Center vertically, accounting for multi-line
		const startY = Math.round(height * 0.5) - ((lines.length - 1) * (qFontSize * 1.5)) / 2;

		// Update accent bar to sit above the quote
		accentBarX = padding;
		accentBarY = startY - qFontSize * 1.5;

		const tspans = lines
			.map((l, i) => `<tspan x="${width / 2}" dy="${i === 0 ? 0 : qFontSize * 1.5}">${escapeSvg(l)}</tspan>`)
			.join('');

		quoteSvg = `
		<text
			x="${width / 2}" y="${startY}"
			font-family="${quoteFont}"
			font-size="${qFontSize}"${quoteStyleAttr}
			fill="${titleColor}"
			text-anchor="middle"
			${effectAttrMain}
		>${tspans}</text>`;
	}

	let authorSvg = '';
	if (quoteAuthor && layout === 'quote') {
		const aFontSize = Math.max(16, Math.round(width * 0.035));
		authorSvg = `
		<text
			x="${width / 2}" y="${height - padding}"
			font-family="${authorFont}"
			font-size="${aFontSize}"${authorStyleAttr}
			fill="${subtitleColor}"
			text-anchor="middle"
			opacity="0.9"
			${effectAttrSub}
		>— ${quoteAuthor}</text>`;
	}

	let memeSvg = '';
	if (layout === 'meme') {
		const mFontSize = Math.max(30, Math.round(height * 0.1));
		const memeLineHeight = Math.round(mFontSize * 1.15);
		const maxMemeChars = Math.max(10, Math.floor((width - padding) / (mFontSize * 0.6)));
		const defaultMemeStroke = `stroke="#000000" stroke-width="${Math.max(1, Math.round(mFontSize * 0.08))}" stroke-linejoin="round" paint-order="stroke fill"`;
		const memeEffectAttr =
			textEffect === 'default'
				? defaultMemeStroke
				: `${applyFilterAttr} ${applyStrokeAttr}`.trim();

		// Hide the accent bar off-screen for meme layout
		accentBarY = -1000;
		if (rawMemeTop) {
			const topLines = wrapText(rawMemeTop, maxMemeChars).split('\n');
			const topTspans = topLines
				.map((l, i) => `<tspan x="${width / 2}" dy="${i === 0 ? 0 : memeLineHeight}">${escapeSvg(l)}</tspan>`)
				.join('');
			memeSvg += `
			<text
				x="${width / 2}" y="${Math.round(mFontSize * 1.1)}"
				font-family="${memeTopFont}"
				font-size="${mFontSize}"${memeTopStyleAttr}
				fill="${titleColor}"
				${memeEffectAttr}
				text-anchor="middle"
			>${topTspans}</text>`;
		}
		if (rawMemeBottom) {
			const bottomLines = wrapText(rawMemeBottom, maxMemeChars).split('\n');
			const bottomStartY = Math.round(
				height - mFontSize * 0.35 - (bottomLines.length - 1) * memeLineHeight,
			);
			const bottomTspans = bottomLines
				.map((l, i) => `<tspan x="${width / 2}" dy="${i === 0 ? 0 : memeLineHeight}">${escapeSvg(l)}</tspan>`)
				.join('');
			memeSvg += `
			<text
				x="${width / 2}" y="${bottomStartY}"
				font-family="${memeBottomFont}"
				font-size="${mFontSize}"${memeBottomStyleAttr}
				fill="${titleColor}"
				${memeEffectAttr}
				text-anchor="middle"
			>${bottomTspans}</text>`;
		}
	}

	let quoteWatermarkSvg = '';
	if (quoteWmText && layout === 'quote') {
		const wmFontSize = Math.max(12, Math.round(width * 0.025));
		const wmX = (width * quoteWmX) / 100;
		const wmY = (height * quoteWmY) / 100;
		quoteWatermarkSvg = `
		<text
			x="${wmX}" y="${wmY}"
			font-family="${quoteWmFont}"
			font-size="${wmFontSize}"
			fill="${quoteWmColor}"
			opacity="${quoteWmOpacity}"
			text-anchor="middle"
		>${quoteWmText}</text>`;
	}

	const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
${customFilterSvg}
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${gradientColor}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${gradientColor}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${bgColorHex}"/>
  <!-- Subtle gradient overlay -->
  <rect width="${width}" height="${height}" fill="url(#grad)"/>
  <!-- Accent bar -->
  <rect x="${accentBarX}" y="${accentBarY}" width="${Math.round(width * 0.12)}" height="${accentBarH}" fill="${accentColor}" rx="${Math.round(accentBarH / 2)}"/>
  ${titleSvg}
  ${subtitleSvg}
  ${quoteSvg}
  ${authorSvg}
  ${memeSvg}
  ${quoteWatermarkSvg}
  <!-- Corner decoration -->
  <rect x="${width - 60}" y="${height - 60}" width="40" height="4" fill="${accentColor}" opacity="0.6" rx="2"/>
  <rect x="${width - 24}" y="${height - 60}" width="4" height="40" fill="${accentColor}" opacity="0.6" rx="2"/>
</svg>`;

	const base = createSafeSharp({
		create: {
			width,
			height,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	});

	return base.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
}



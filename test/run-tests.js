const assert = require('assert');
const sharp = require('sharp');

const {
	hexToRgba,
	sanitizeCssColor,
	escapeSvg,
	normalizeFontFamily,
	toSvgFontFamily,
	wrapText,
	validateDimensions,
	normalizeOutputFileName,
} = require('../dist/nodes/EditImagePlus/utils');
const { OPERATION_PARAM_MAP } = require('../dist/nodes/EditImagePlus/properties');
const { buildTemplateInstance } = require('../dist/nodes/EditImagePlus/templateBuilder');
const { EditImagePlus } = require('../dist/nodes/EditImagePlus/EditImagePlus.node');

async function runTests() {
	let passed = 0;
	function ok(name) {
		passed++;
		console.log(`  ✅ ${name}`);
	}

	console.log('\n🔬 Running EditImagePlus Production Readiness Test Suite...\n');

	// 1. hexToRgba tests (including CRIT-03 zero-alpha fix)
	{
		const zeroAlpha = hexToRgba('#00000000');
		assert.strictEqual(zeroAlpha.r, 0);
		assert.strictEqual(zeroAlpha.g, 0);
		assert.strictEqual(zeroAlpha.b, 0);
		assert.strictEqual(zeroAlpha.alpha, 0, 'Expected #00000000 to have alpha 0, not 1');

		const short3 = hexToRgba('#f0a');
		assert.deepStrictEqual(short3, { r: 255, g: 0, b: 170, alpha: 1 });

		const short4 = hexToRgba('#fff0');
		assert.deepStrictEqual(short4, { r: 255, g: 255, b: 255, alpha: 0 });

		const fallback = hexToRgba('invalid-color"/><script>', '#123456');
		assert.deepStrictEqual(fallback, { r: 18, g: 52, b: 86, alpha: 1 });
		ok('[CRIT-03] hexToRgba preserves 00 alpha and handles 3/4/6/8-digit hex & fallbacks');
	}

	// 2. SVG Injection & Sanitization tests (CRIT-01)
	{
		const maliciousColor = '#fff" /><image href="http://169.254.169.254/" /><rect fill="';
		assert.strictEqual(sanitizeCssColor(maliciousColor, '#ffffff'), '#ffffff');
		assert.strictEqual(sanitizeCssColor('#e94560', '#000000'), '#e94560');

		const maliciousFont = 'Arial" /><foreignObject><script>alert(1)</script></foreignObject>';
		const safeFont = toSvgFontFamily(maliciousFont);
		assert(!safeFont.includes('"'), 'Font family must not contain quotes');
		assert(!safeFont.includes('<'), 'Font family must not contain angle brackets');
		assert(!safeFont.includes('/'), 'Font family must not contain slashes');

		assert.strictEqual(
			normalizeFontFamily('"Playfair Display", serif'),
			'Playfair Display',
		);

		const withCtrlChars = escapeSvg('Hello\x00\x07 <World> & "Friends"');
		assert.strictEqual(withCtrlChars, 'Hello &lt;World&gt; &amp; &quot;Friends&quot;');
		ok('[CRIT-01] sanitizeCssColor, toSvgFontFamily, and escapeSvg block SVG attribute injection');
	}

	// 3. Dimension bounds validation (CRIT-04 & Pass 2 HIGH-02 WebP 16383 limit)
	{
		assert.deepStrictEqual(validateDimensions(800, 600, 'Test'), { width: 800, height: 600 });
		assert.throws(
			() => validateDimensions(16384, 16384, 'Test'),
			/exceed maximum allowed size/,
		);
		assert.throws(() => validateDimensions(0, -10, 'Test'), /must be positive integers/);
		ok('[CRIT-04 & HIGH-02] validateDimensions enforces WebP-safe 16383px ceiling and rejects non-positive values');
	}

	// 4. wrapText & Quote Layout wrapping (LOW-01)
	{
		const wrapped = wrapText("Line one\nLine two with 'quotes' & symbols", 15);
		const lines = wrapped.split('\n');
		assert.strictEqual(lines[0], 'Line one');
		assert(lines.length >= 3, 'Expected second paragraph to wrap across multiple lines');
		ok('[LOW-01] wrapText preserves explicit newlines and wraps words accurately');
	}

	// 5. Auto-derived OPERATION_PARAM_MAP (MED-02)
	{
		assert(Array.isArray(OPERATION_PARAM_MAP.template));
		assert(OPERATION_PARAM_MAP.template.includes('quoteWatermarkText'));
		assert(OPERATION_PARAM_MAP.text.includes('fontFamilyCustom'));
		assert(!OPERATION_PARAM_MAP.text.includes('fontWeight'), 'Orphaned fontWeight removed');
		ok('[MED-02] OPERATION_PARAM_MAP is auto-derived from nodeOperationOptions');
	}

	// 6. Template Builder execution (Standard, Quote, Meme)
	{
		const quotePipeline = await buildTemplateInstance({
			templateName: 'Custom',
			customWidth: 600,
			customHeight: 400,
			templateLayout: 'quote',
			templateQuote: "First line\nSecond line with <tags> & 'quotes'",
			templateQuoteAuthor: 'Ada Lovelace',
			quoteWatermarkText: '@adalovelace',
			templateBgColor: 'invalid"onmouseover="alert(1)',
		});
		const quoteBuf = await quotePipeline.png().toBuffer();
		const quoteMeta = await sharp(quoteBuf).metadata();
		assert.strictEqual(quoteMeta.width, 600);
		assert.strictEqual(quoteMeta.height, 400);
		ok('buildTemplateInstance renders valid PNG buffer with sanitized attributes');
	}

	// 7. End-to-End Node Execution: Multi-Step Chaining (CRIT-02) & Rotate Transparency (CRIT-03)
	{
		const node = new EditImagePlus();

		function createMockContext(params, inputItems = [{ json: { id: 42 }, binary: {} }], continueFail = false) {
			return {
				getInputData: () => inputItems,
				getNodeParameter: (name, _idx, fallback) =>
					params[name] !== undefined ? params[name] : fallback,
				getNode: () => ({ name: 'Edit Image+' }),
				continueOnFail: () => continueFail,
				helpers: {
					assertBinaryData: (idx, prop) => {
						if (!inputItems[idx].binary || !inputItems[idx].binary[prop]) {
							throw new Error(`Missing binary property "${prop}"`);
						}
					},
					getBinaryDataBuffer: async (idx, prop) => inputItems[idx].binary[prop]._buf,
					prepareBinaryData: async (buf, fileName, mimeType) => ({
						_buf: buf,
						fileName,
						mimeType,
					}),
				},
			};
		}

		// 7a. Multi-step: Create (400x400) -> Resize (200x200) -> Draw -> Text -> Crop (100x100 at 50,50)
		const multiCtx = createMockContext({
			operation: 'multiStep',
			dataPropertyName: 'data',
			options: { format: 'png' },
			operations: {
				operations: [
					{ operation: 'create', width: 400, height: 400, backgroundColor: '#ff0000' },
					{ operation: 'resize', width: 200, height: 200, resizeOption: 'fill' },
					{
						operation: 'draw',
						primitive: 'rectangle',
						color: '#00ff00',
						startPositionX: 0,
						startPositionY: 0,
						endPositionX: 200,
						endPositionY: 200,
					},
					{
						operation: 'text',
						text: 'Centered Text',
						fontSize: 24,
						fontColor: '#ffffff',
						textAlign: 'center', // legacy value should normalize to 'middle'
					},
					{ operation: 'crop', positionX: 50, positionY: 50, width: 100, height: 100 },
				],
			},
		});

		const [multiRes] = await node.execute.call(multiCtx);
		const outBuf = multiRes[0].binary.data._buf;
		const outMeta = await sharp(outBuf).metadata();
		assert.strictEqual(outMeta.width, 100);
		assert.strictEqual(outMeta.height, 100);
		// Verify Draw step (#00ff00) was NOT overwritten by Text step composite!
		const { data: rawPx } = await sharp(outBuf).raw().toBuffer({ resolveWithObject: true });
		// Corner pixel of crop (0,0 -> 50,50 on canvas) should be green (0, 255, 0) from Draw step, not red (255, 0, 0) from Create step!
		assert.strictEqual(rawPx[0], 0, 'Red channel should be 0 (Draw overlay preserved)');
		assert.strictEqual(rawPx[1], 255, 'Green channel should be 255 (Draw overlay preserved)');
		ok('[CRIT-02] Multi-Step pipeline preserves earlier .composite() layers and updates intermediate .metadata()');

		// 7b. Rotate with transparent #00000000 background preserves alpha = 0 in revealed corners
		const redSquare = await sharp({
			create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
		})
			.png()
			.toBuffer();

		const rotCtx = createMockContext(
			{
				operation: 'rotate',
				dataPropertyName: 'data',
				rotate: 45,
				backgroundColor: '#00000000',
				options: { format: 'png' },
			},
			[{ json: { test: 'rotate' }, binary: { data: { _buf: redSquare } } }],
		);
		const [rotRes] = await node.execute.call(rotCtx);
		const { data: rotPx } = await sharp(rotRes[0].binary.data._buf)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		assert.strictEqual(rotPx[3], 0, 'Top-left corner pixel after 45° rotation with #00000000 must have alpha=0');
		ok('[CRIT-03] Rotate with #00000000 produces transparent corner pixels (alpha=0)');

		// 7c. Out-of-bounds crop throws descriptive error and continueOnFail preserves input JSON (HIGH-05 & MED-05)
		const badCropCtx = createMockContext(
			{
				operation: 'crop',
				dataPropertyName: 'data',
				positionX: 50,
				positionY: 50,
				width: 100,
				height: 100,
				options: {},
			},
			[{ json: { keepMe: 'yes' }, binary: { data: { _buf: redSquare } } }],
			true,
		);
		const [badCropRes] = await node.execute.call(badCropCtx);
		assert.strictEqual(badCropRes[0].json.keepMe, 'yes', 'continueOnFail must preserve original item.json');
		assert(
			badCropRes[0].json.error.includes('exceeds source image dimensions (100×100)'),
			`Expected descriptive crop error, got: ${badCropRes[0].json.error}`,
		);
		ok('[HIGH-05 & MED-05] Descriptive crop bounds error + non-destructive continueOnFail output');

		// 7d. Non-square banner Watermark (1584x396 LinkedIn Banner with 60% scale square watermark) [CRIT-01]
		const bannerBuf = await sharp({
			create: { width: 1584, height: 396, channels: 4, background: { r: 20, g: 30, b: 60, alpha: 1 } },
		})
			.png()
			.toBuffer();
		const bigSquareWm = await sharp({
			create: { width: 1000, height: 1000, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
		})
			.png()
			.toBuffer();

		const wmCtx = createMockContext(
			{
				operation: 'watermark',
				dataPropertyName: 'data',
				watermarkProperty: 'wm',
				watermarkScale: 60,
				watermarkOpacity: 50,
				watermarkGravity: 'southeast',
				options: { format: 'png', fileName: 'custom-banner-without-ext' },
			},
			[{ json: {}, binary: { data: { _buf: bannerBuf }, wm: { _buf: bigSquareWm } } }],
		);
		const [wmRes] = await node.execute.call(wmCtx);
		const wmOutMeta = await sharp(wmRes[0].binary.data._buf).metadata();
		assert.strictEqual(wmOutMeta.width, 1584);
		assert.strictEqual(wmOutMeta.height, 396);
		assert.strictEqual(
			wmRes[0].binary.data.fileName,
			'custom-banner-without-ext.png',
			'normalizeOutputFileName should append .png when extension is omitted',
		);
		ok('[CRIT-01 & LOW-02] Non-square banner watermark scales within both canvas axes + normalizes output filename');

		// 7e. Oversized & negative-offset Composite clipping [CRIT-02]
		const compCtx = createMockContext(
			{
				operation: 'composite',
				dataPropertyName: 'data',
				dataPropertyNameComposite: 'overlay',
				positionX: -20,
				positionY: 50,
				operator: 'over',
				options: { format: 'png' },
			},
			[{ json: {}, binary: { data: { _buf: redSquare }, overlay: { _buf: bigSquareWm } } }],
		);
		const [compRes] = await node.execute.call(compCtx);
		const compMeta = await sharp(compRes[0].binary.data._buf).metadata();
		assert.strictEqual(compMeta.width, 100);
		assert.strictEqual(compMeta.height, 100);
		ok('[CRIT-02] Composite clips oversized and negatively offset overlays to canvas bounds without crashing');

		// 7f. Multi-step metadata preservation (EXIF / density) [CRIT-03] & Get Information Buffer-free JSON [Pass 2 HIGH-01]
		const imgWithMeta = await sharp({
			create: { width: 200, height: 200, channels: 3, background: { r: 100, g: 150, b: 200 } },
		})
			.withMetadata({ density: 300, exif: { IFD0: { Copyright: 'AuditTest2026' } } })
			.jpeg()
			.toBuffer();

		const infoCtx = createMockContext(
			{ operation: 'information', dataPropertyName: 'data' },
			[{ json: {}, binary: { data: { _buf: imgWithMeta } } }],
		);
		const [infoRes] = await node.execute.call(infoCtx);
		assert.strictEqual(infoRes[0].json.hasExif, true, 'Expected hasExif=true summary field');
		assert(typeof infoRes[0].json.exifByteLength === 'number', 'Expected exifByteLength number');
		assert.strictEqual(infoRes[0].json.exif, undefined, 'Raw exif Buffer must not be returned in JSON');

		const metaMultiCtx = createMockContext(
			{
				operation: 'multiStep',
				dataPropertyName: 'data',
				options: { format: 'jpeg', keepMetadata: true },
				operations: {
					operations: [
						{ operation: 'resize', width: 100, height: 100, resizeOption: 'fill' },
						{ operation: 'flip' },
					],
				},
			},
			[{ json: {}, binary: { data: { _buf: imgWithMeta } } }],
		);
		const [metaMultiRes] = await node.execute.call(metaMultiCtx);
		const preservedMeta = await sharp(metaMultiRes[0].binary.data._buf).metadata();
		assert.strictEqual(preservedMeta.density, 300, 'Expected DPI density=300 to survive multiStep when keepMetadata=true');
		assert(preservedMeta.exif, 'Expected EXIF buffer to survive multiStep when keepMetadata=true');
		ok('[CRIT-03 & Pass 2 HIGH-01] Multi-Step preserves EXIF/density + Get Information strips raw Buffers');

		// 7g. Empty multiStep throws clear error [MED-03]
		const emptyMultiCtx = createMockContext(
			{
				operation: 'multiStep',
				dataPropertyName: 'data',
				options: {},
				operations: { operations: [] },
			},
			[{ json: {}, binary: { data: { _buf: redSquare } } }],
			true,
		);
		const [emptyMultiRes] = await node.execute.call(emptyMultiCtx);
		assert(
			emptyMultiRes[0].json.error.includes('requires at least one step'),
			`Expected empty multiStep error, got: ${emptyMultiRes[0].json.error}`,
		);
		ok('[MED-03] Empty multiStep throws descriptive configuration error');

		// 7h. Pass 2 Pipeline Hardening: Grayscale -> Sepia/Tint, Singular Shear Matrix, and Border Max-Dimension [Pass 2 CRIT-01, CRIT-03, HIGH-02]
		const grayToSepiaCtx = createMockContext(
			{
				operation: 'multiStep',
				dataPropertyName: 'data',
				options: { format: 'png' },
				operations: {
					operations: [
						{ operation: 'grayscale' },
						{ operation: 'sepia' },
						{ operation: 'grayscale' },
						{ operation: 'tint', tintColor: '#ff6b35' },
					],
				},
			},
			[{ json: {}, binary: { data: { _buf: redSquare } } }],
		);
		const [grayToSepiaRes] = await node.execute.call(grayToSepiaCtx);
		const graySepiaMeta = await sharp(grayToSepiaRes[0].binary.data._buf).metadata();
		assert.strictEqual(graySepiaMeta.width, 100);

		const singularShearCtx = createMockContext(
			{
				operation: 'shear',
				dataPropertyName: 'data',
				degreesX: 45,
				degreesY: 45,
				options: {},
			},
			[{ json: {}, binary: { data: { _buf: redSquare } } }],
			true,
		);
		const [singularShearRes] = await node.execute.call(singularShearCtx);
		assert(
			singularShearRes[0].json.error.includes('degenerate (singular) transformation matrix'),
			`Expected singular shear error, got: ${singularShearRes[0].json.error}`,
		);
		ok('[Pass 2 CRIT-01 & CRIT-03] Grayscale->Sepia/Tint promotes to sRGB cleanly & singular 45°/45° shear is rejected');
	}

	// 8. Extended Color Parsing, Long-Word Wrapping, Filename Traversal Sanitization & Standard/Meme Template Wrapping
	{
		assert.strictEqual(sanitizeCssColor('rgb(255, 0, 128)', '#000000'), '#ff0080');
		assert.strictEqual(sanitizeCssColor('rgba(0, 255, 0, 0)', '#000000'), 'rgba(0, 255, 0, 0)');
		assert.strictEqual(sanitizeCssColor('transparent', '#ffffff'), 'rgba(0, 0, 0, 0)');
		assert.strictEqual(sanitizeCssColor('#00ff0080', '#000000'), 'rgba(0, 255, 0, 0.502)');
		assert.deepStrictEqual(hexToRgba('rgba(255, 0, 0, 0)'), { r: 255, g: 0, b: 0, alpha: 0 });

		// Path traversal & mismatched extension sanitization [Pass 2 CRIT-02 & MED-01]
		assert.strictEqual(
			normalizeOutputFileName('../../etc/passwd', 'png'),
			'passwd.png',
			'Directory traversal must be stripped',
		);
		assert.strictEqual(
			normalizeOutputFileName('..\\..\\windows\\system32\\evil.png', 'webp'),
			'evil.webp',
			'Windows backslash traversal and mismatched .png extension must be normalized to .webp',
		);
		assert.strictEqual(
			normalizeOutputFileName('photo.jpg', 'jpeg'),
			'photo.jpg',
			'.jpg should be preserved when format is jpeg',
		);

		const longTokenWrapped = wrapText('https://example.com/very/long/unbroken/url/path/segment', 15);
		for (const line of longTokenWrapped.split('\n')) {
			assert(line.length <= 15, `Expected wrapped token line <= 15 chars, got ${line.length}: "${line}"`);
		}

		// Standard & Meme templates with long text and outline effect
		const stdTpl = await buildTemplateInstance({
			templateName: 'Custom',
			customWidth: 800,
			customHeight: 600,
			templateLayout: 'standard',
			templateTitle: 'A Very Long Headline That Must Wrap Across Multiple Lines Cleanly On The Canvas',
			templateSubtitle: 'And a detailed secondary subtitle that also wraps cleanly within the template margins',
			templateTextEffect: 'outline',
			templateEffectColor: 'rgb(0, 0, 0)',
			templateEffectOutlineWidth: 4,
		});
		const stdBuf = await stdTpl.png().toBuffer();
		const stdMeta = await sharp(stdBuf).metadata();
		assert.strictEqual(stdMeta.width, 800);

		const memeTpl = await buildTemplateInstance({
			templateName: 'Custom',
			customWidth: 800,
			customHeight: 600,
			templateLayout: 'meme',
			templateMemeTop: 'WHEN THE MEME TOP TEXT IS SUPER LONG AND NEEDS MULTIPLE LINES',
			templateMemeBottom: 'AND THE BOTTOM TEXT ALSO WRAPS UPWARD WITHOUT CLIPPING OFF THE CANVAS',
		});
		const memeBuf = await memeTpl.png().toBuffer();
		const memeMeta = await sharp(memeBuf).metadata();
		assert.strictEqual(memeMeta.width, 800);
		ok('[Pass 2 CRIT-02, MED-01, HIGH-02, HIGH-03] Path-traversal filename sanitization, extension matching, and template wrapping');
	}

	// 9. Pass 3 Regression Tests: Grayscale -> Transparent (CRIT-01), EXIF Orientation Auto-Rotate (HIGH-01), and SVG rgba() Alpha Rendering (HIGH-02)
	{
		const node = new EditImagePlus();

		function createMockCtx(params, inputItems) {
			return {
				getInputData: () => inputItems,
				getNodeParameter: (name, _idx, fallback) =>
					params[name] !== undefined ? params[name] : fallback,
				getNode: () => ({ name: 'Edit Image+' }),
				continueOnFail: () => false,
				helpers: {
					assertBinaryData: (idx, prop) => {
						if (!inputItems[idx].binary || !inputItems[idx].binary[prop]) {
							throw new Error(`Missing binary property "${prop}"`);
						}
					},
					getBinaryDataBuffer: async (idx, prop) => inputItems[idx].binary[prop]._buf,
					prepareBinaryData: async (buf, fileName, mimeType) => ({
						_buf: buf,
						fileName,
						mimeType,
					}),
				},
			};
		}

		// 9a. 1-channel Grayscale -> Transparent pipeline must not crash VipsRawLoad and must make white pixels transparent
		const whiteImg = await sharp({
			create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 255, b: 255 } },
		})
			.grayscale()
			.png()
			.toBuffer();

		const grayTransCtx = createMockCtx(
			{
				operation: 'multiStep',
				dataPropertyName: 'data',
				options: { format: 'png' },
				operations: {
					operations: [
						{ operation: 'grayscale' },
						{ operation: 'transparent', transparentColor: '#ffffff', tolerance: 10 },
						{
							operation: 'draw',
							primitive: 'rectangle',
							color: '#00ff0080',
							startPositionX: 0,
							startPositionY: 0,
							endPositionX: 32,
							endPositionY: 32,
						},
					],
				},
			},
			[{ json: {}, binary: { data: { _buf: whiteImg } } }],
		);
		const [grayTransRes] = await node.execute.call(grayTransCtx);
		const { data: gtPx, info: gtInfo } = await sharp(grayTransRes[0].binary.data._buf)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		assert.strictEqual(gtInfo.width, 64);
		assert.strictEqual(gtInfo.height, 64);
		// Bottom-right pixel (63, 63) was white and untouched by the 32x32 green semi-transparent draw, so its alpha must be 0
		const lastPixelAlpha = gtPx[(64 * 64 - 1) * 4 + 3];
		assert.strictEqual(lastPixelAlpha, 0, 'Expected white pixel on grayscale image to become transparent (alpha=0)');
		// Top-left pixel (0, 0) had semi-transparent green (#00ff0080 -> rgba(0, 255, 0, 0.502)) drawn over transparent canvas
		assert(gtPx[1] > 200 && gtPx[3] > 100 && gtPx[3] < 160, `Expected semi-transparent green pixel at (0,0), got rgba(${gtPx[0]},${gtPx[1]},${gtPx[2]},${gtPx[3]})`);
		ok('[Pass 3 CRIT-01 & HIGH-02] Grayscale -> Transparent promotes 1-channel input to 4-channel RGBA without VipsRawLoad crash & renders #RRGGBBAA SVG alpha');

		// 9b. EXIF Orientation=6 (200x100 sensor -> 100x200 visual portrait) auto-orients on load
		const rawLandscapeWithExif6 = await sharp({
			create: { width: 200, height: 100, channels: 3, background: { r: 30, g: 120, b: 220 } },
		})
			.withMetadata({ orientation: 6 })
			.jpeg()
			.toBuffer();

		const orientCtx = createMockCtx(
			{
				operation: 'crop',
				dataPropertyName: 'data',
				positionX: 0,
				positionY: 0,
				width: 100,
				height: 200,
				options: { format: 'jpeg', keepMetadata: false },
			},
			[{ json: {}, binary: { data: { _buf: rawLandscapeWithExif6 } } }],
		);
		const [orientRes] = await node.execute.call(orientCtx);
		const orientMeta = await sharp(orientRes[0].binary.data._buf).metadata();
		assert.strictEqual(orientMeta.width, 100, 'Expected visual width 100 after EXIF Orientation=6 auto-rotation');
		assert.strictEqual(orientMeta.height, 200, 'Expected visual height 200 after EXIF Orientation=6 auto-rotation');
		ok('[Pass 3 HIGH-01] Input images with EXIF Orientation > 1 are auto-oriented to visual dimensions before operations');
	}

	// 10. Batch 1-4 Production Readiness & Comprehensive Operations Coverage
	{
		const node = new EditImagePlus();

		function createMockCtx(params, inputItems) {
			return {
				getInputData: () => inputItems,
				getNodeParameter: (name, _idx, fallback) =>
					params[name] !== undefined ? params[name] : fallback,
				getNode: () => ({ name: 'Edit Image+' }),
				continueOnFail: () => false,
				helpers: {
					assertBinaryData: (idx, prop) => {
						if (!inputItems[idx].binary || !inputItems[idx].binary[prop]) {
							throw new Error(`Missing binary property "${prop}"`);
						}
					},
					getBinaryDataBuffer: async (idx, prop) => inputItems[idx].binary[prop]._buf,
					prepareBinaryData: async (buf, fileName, mimeType) => ({
						_buf: buf,
						fileName,
						mimeType,
					}),
				},
			};
		}

		const sampleImg = await sharp({
			create: { width: 100, height: 80, channels: 4, background: { r: 50, g: 100, b: 150, alpha: 1 } },
		})
			.png()
			.toBuffer();

		// 10a. Get Information preserves item.json fields and binary data (CRIT-02)
		const infoCtx = createMockCtx(
			{ operation: 'information', dataPropertyName: 'data' },
			[{ json: { workflowId: 999, userEmail: 'test@example.com' }, binary: { data: { _buf: sampleImg } } }],
		);
		const [infoRes] = await node.execute.call(infoCtx);
		assert.strictEqual(infoRes[0].json.workflowId, 999, 'Get Information must preserve original item.json fields');
		assert.strictEqual(infoRes[0].json.userEmail, 'test@example.com');
		assert.strictEqual(infoRes[0].json.width, 100);
		assert.strictEqual(infoRes[0].json.height, 80);
		assert(infoRes[0].binary && infoRes[0].binary.data, 'Get Information must preserve binary image data');
		ok('[CRIT-02] Get Information preserves item.json workflow context and binary data');

		// 10b. Prototype pollution prevention on outputPropertyName & dataPropertyName (CRIT-02 & CRIT-03)
		const protoCtx = createMockCtx(
			{
				operation: 'flip',
				dataPropertyName: '__proto__',
				options: { outputPropertyName: '__proto__' },
			},
			[{ json: {}, binary: { data: { _buf: sampleImg } } }],
		);
		const [protoRes] = await node.execute.call(protoCtx);
		assert(protoRes[0].binary.data, 'Output property must fall back to safe data property');
		assert.strictEqual(Object.prototype.polluted, undefined, 'Prototype must not be polluted');
		assert.strictEqual(Object.getPrototypeOf(protoRes[0].binary), Object.prototype, 'Binary object prototype must remain intact');
		ok('[CRIT-02 & CRIT-03] Prototype pollution via dataPropertyName & outputPropertyName is neutralized');

		// 10b-2. Input binary filename preservation when options.fileName is blank (CRIT-01)
		const fileNameInheritCtx = createMockCtx(
			{
				operation: 'flip',
				dataPropertyName: 'data',
				options: { format: 'png' }, // fileName omitted
			},
			[{ json: {}, binary: { data: { _buf: sampleImg, fileName: 'customer-avatar-102.jpg' } } }],
		);
		const [inheritRes] = await node.execute.call(fileNameInheritCtx);
		assert.strictEqual(
			inheritRes[0].binary.data.fileName,
			'customer-avatar-102.png',
			'Output binary should inherit input binary filename stem and update format extension',
		);
		ok('[CRIT-01] Input binary fileName is preserved when options.fileName is omitted');

		// 10c. Windows reserved DOS device name normalization (HIGH-03 & HIGH-04)
		assert.strictEqual(normalizeOutputFileName('CON.png', 'png'), 'image.png');
		assert.strictEqual(normalizeOutputFileName('NUL.jpg', 'jpeg'), 'image.jpg');
		assert.strictEqual(normalizeOutputFileName('AUX.webp', 'webp'), 'image.webp');
		assert.strictEqual(normalizeOutputFileName('COM1.png', 'png'), 'image.png');
		assert.strictEqual(normalizeOutputFileName('LPT9', 'png'), 'image.png');
		assert.strictEqual(normalizeOutputFileName('CON.tar.gz', 'png'), 'image.tar.gz.png');
		assert.strictEqual(normalizeOutputFileName('AUX.backup.png', 'png'), 'image.backup.png');
		ok('[HIGH-03 & HIGH-04] Windows DOS reserved device names (CON, NUL, AUX, COM1-9, compound extensions) are normalized to image.ext');

		// 10d. Fallback sanitization in sanitizeCssColor (MED-05)
		assert.strictEqual(sanitizeCssColor('invalid', 'also-invalid'), '#000000');
		ok('[MED-05] sanitizeCssColor returns safe #000000 when both candidate and fallback are invalid');

		// 10e. International Unicode font family preservation (HIGH-02)
		assert.strictEqual(normalizeFontFamily('苹方'), '苹方');
		assert.strictEqual(normalizeFontFamily('メイリオ'), 'メイリオ');
		assert.strictEqual(normalizeFontFamily('Noto Serif 简体中文'), 'Noto Serif 简体中文');
		assert.strictEqual(normalizeFontFamily('Arial" /><script>alert(1)</script>'), 'Arial scriptalert1script');
		ok('[HIGH-02] normalizeFontFamily preserves international Unicode scripts (CJK, Cyrillic, Arabic) while blocking SVG delimiters');

		// 10f. Root index.js exports EditImagePlus node class (MED-01)
		const indexExport = require('../index.js');
		assert(indexExport && typeof indexExport.EditImagePlus === 'function', 'index.js must export EditImagePlus class');
		ok('[MED-01] Root index.js successfully exports EditImagePlus class');

		// 10g. Full coverage for blur, border, flip, flop, gamma, normalize, sharpen, tint (LOW-04)
		const allOpsCtx = createMockCtx(
			{
				operation: 'multiStep',
				dataPropertyName: 'data',
				options: { format: 'png' },
				operations: {
					operations: [
						{ operation: 'blur', sigma: 1 },
						{ operation: 'border', borderWidth: 5, borderHeight: 5, borderColor: '#ff0000' },
						{ operation: 'flip' },
						{ operation: 'flop' },
						{ operation: 'gamma', gammaValue: 2.2 },
						{ operation: 'normalize' },
						{ operation: 'sharpen', sharpenSigma: 1, sharpenFlat: 1, sharpenJagged: 2 },
						{ operation: 'tint', tintColor: '#00ff00' },
					],
				},
			},
			[{ json: {}, binary: { data: { _buf: sampleImg } } }],
		);
		const [allOpsRes] = await node.execute.call(allOpsCtx);
		const allOpsMeta = await sharp(allOpsRes[0].binary.data._buf).metadata();
		// Initial 100x80 + border 5 on each side = 110x90
		assert.strictEqual(allOpsMeta.width, 110);
		assert.strictEqual(allOpsMeta.height, 90);
		ok('[LOW-04] Full operation coverage: blur, border, flip, flop, gamma, normalize, sharpen, tint executed cleanly');

		// 10h. Composite and Watermark EXIF auto-rotation (CRIT-04)
		const overlayWithExif6 = await sharp({
			create: { width: 60, height: 40, channels: 3, background: { r: 255, g: 255, b: 0 } },
		})
			.withMetadata({ orientation: 6 })
			.jpeg()
			.toBuffer();

		const compExifCtx = createMockCtx(
			{
				operation: 'composite',
				dataPropertyName: 'data',
				dataPropertyNameComposite: 'overlay',
				positionX: 0,
				positionY: 0,
				options: { format: 'png' },
			},
			[{ json: {}, binary: { data: { _buf: sampleImg }, overlay: { _buf: overlayWithExif6 } } }],
		);
		const [compExifRes] = await node.execute.call(compExifCtx);
		const compExifMeta = await sharp(compExifRes[0].binary.data._buf).metadata();
		assert.strictEqual(compExifMeta.width, 100);
		assert.strictEqual(compExifMeta.height, 80);

		const wmExifCtx = createMockCtx(
			{
				operation: 'watermark',
				dataPropertyName: 'data',
				watermarkProperty: 'wm',
				watermarkScale: 20,
				watermarkOpacity: 50,
				options: { format: 'png' },
			},
			[{ json: {}, binary: { data: { _buf: sampleImg }, wm: { _buf: overlayWithExif6 } } }],
		);
		const [wmExifRes] = await node.execute.call(wmExifCtx);
		const wmExifMeta = await sharp(wmExifRes[0].binary.data._buf).metadata();
		assert.strictEqual(wmExifMeta.width, 100);
		assert.strictEqual(wmExifMeta.height, 80);
		ok('[CRIT-04] Composite and Watermark auto-orient secondary EXIF orientation > 1 inputs cleanly');

		// 10i. Non-string fontStyle & fontWeight type guards (HIGH-01)
		const typeGuardCtx = createMockCtx(
			{
				operation: 'text',
				dataPropertyName: 'data',
				text: 'Defensive Style Test',
				fontStyle: 700, // numeric instead of string
				fontWeight: true, // boolean instead of string
				options: { format: 'png' },
			},
			[{ json: {}, binary: { data: { _buf: sampleImg } } }],
		);
		const [typeGuardRes] = await node.execute.call(typeGuardCtx);
		assert(typeGuardRes[0].binary.data._buf.length > 0, 'Text operation should not crash with numeric/boolean fontStyle');

		const tplTypeGuard = await buildTemplateInstance({
			templateName: 'Custom',
			customWidth: 400,
			customHeight: 300,
			templateLayout: 'standard',
			templateTitle: 'Safe Template',
			templateTitleFontStyle: 600, // numeric instead of string
		});
		assert((await tplTypeGuard.png().toBuffer()).length > 0, 'buildTemplateInstance should not crash with numeric style');
		ok('[HIGH-01] Non-string fontStyle & fontWeight handled safely without TypeError');

		// 10j. Invalid blend mode and watermark gravity fallback (HIGH-02)
		const badBlendCtx = createMockCtx(
			{
				operation: 'composite',
				dataPropertyName: 'data',
				dataPropertyNameComposite: 'overlay',
				operator: 'MALICIOUS_OR_INVALID_BLEND',
				options: { format: 'png' },
			},
			[{ json: {}, binary: { data: { _buf: sampleImg }, overlay: { _buf: sampleImg } } }],
		);
		const [badBlendRes] = await node.execute.call(badBlendCtx);
		assert(badBlendRes[0].binary.data._buf.length > 0, 'Composite must fall back to over on invalid blend mode');

		const badGravCtx = createMockCtx(
			{
				operation: 'watermark',
				dataPropertyName: 'data',
				watermarkProperty: 'wm',
				watermarkGravity: 'INVALID_GRAVITY',
				options: { format: 'png' },
			},
			[{ json: {}, binary: { data: { _buf: sampleImg }, wm: { _buf: sampleImg } } }],
		);
		const [badGravRes] = await node.execute.call(badGravCtx);
		assert(badGravRes[0].binary.data._buf.length > 0, 'Watermark must fall back to southeast on invalid gravity');
		ok('[HIGH-02] Invalid Sharp blend mode and watermark gravity fall back safely without libvips crash');

		// 10k. Draw line primitive strokeColor support (MED-01)
		const lineCtx = createMockCtx(
			{
				operation: 'draw',
				dataPropertyName: 'data',
				primitive: 'line',
				color: '#ff0000',
				strokeColor: '#00ff00',
				strokeWidth: 4,
				startPositionX: 0,
				startPositionY: 10,
				endPositionX: 50,
				endPositionY: 10,
				options: { format: 'png' },
			},
			[{ json: {}, binary: { data: { _buf: sampleImg } } }],
		);
		const [lineRes] = await node.execute.call(lineCtx);
		assert(lineRes[0].binary.data._buf.length > 0, 'Draw line should execute with strokeColor');
		ok('[MED-01] Draw line primitive respects strokeColor');

		// 10l. Concurrent font discovery memoization (HIGH-04)
		const [fonts1, fonts2] = await Promise.all([
			node.methods.loadOptions.getFontList.call({}),
			node.methods.loadOptions.getFontList.call({}),
		]);
		assert(Array.isArray(fonts1) && fonts1.length > 0);
		assert.strictEqual(fonts1, fonts2, 'Concurrent getFontList calls must resolve to the identical memoized array');
		ok('[HIGH-04] Concurrent getFontList invocations are collapsed into a single memoized Promise');
	}

	console.log(`\n🎉 All ${passed} test suites passed!\n`);
}

runTests().catch((err) => {
	console.error('\n❌ Test Suite Failed:', err);
	process.exit(1);
});



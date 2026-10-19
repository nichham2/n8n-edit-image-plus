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
		assert.strictEqual(sanitizeCssColor('rgba(0, 255, 0, 0)', '#000000'), '#00ff0000');
		assert.strictEqual(sanitizeCssColor('transparent', '#ffffff'), '#00000000');
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

	console.log(`\n🎉 All ${passed} test suites passed!\n`);
}

runTests().catch((err) => {
	console.error('\n❌ Test Suite Failed:', err);
	process.exit(1);
});



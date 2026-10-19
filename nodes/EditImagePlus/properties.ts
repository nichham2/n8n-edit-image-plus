import type { INodeProperties } from 'n8n-workflow';
import {
	IMAGE_TEMPLATES,
	MAX_BORDER,
	MAX_DIMENSION,
	MAX_SHEAR_DEGREES,
	MIN_SHEAR_DEGREES,
	fontStyleOptions,
} from './constants';

export const nodeOperationOptions: INodeProperties[] = [
	// ────────────────────────────────────────────────────────────────────────
	// create
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Background Color',
		name: 'backgroundColor',
		type: 'color',
		default: '#ffffff',
		typeOptions: { showAlpha: true },
		displayOptions: { show: { operation: ['create'] } },
		description: 'Background colour of the new image',
	},
	{
		displayName: 'Image Width',
		name: 'width',
		type: 'number',
		default: 1080,
		typeOptions: { minValue: 1, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['create'] } },
		description: 'Width of the new image in pixels',
	},
	{
		displayName: 'Image Height',
		name: 'height',
		type: 'number',
		default: 1080,
		typeOptions: { minValue: 1, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['create'] } },
		description: 'Height of the new image in pixels',
	},

	// ────────────────────────────────────────────────────────────────────────
	// template
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Template',
		name: 'templateName',
		type: 'options',
		default: 'Instagram Post (1:1)',
		displayOptions: { show: { operation: ['template'] } },
		options: IMAGE_TEMPLATES.map((t) => ({
			name: `${t.name} (${t.width}×${t.height})`,
			value: t.name,
			description: t.description,
		})),
		description: 'Choose a preset canvas size',
	},
	{
		displayName: 'Custom Width',
		name: 'customWidth',
		type: 'number',
		default: 800,
		typeOptions: { minValue: 1, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['template'], templateName: ['Custom'] } },
		description: 'Custom canvas width in pixels',
	},
	{
		displayName: 'Custom Height',
		name: 'customHeight',
		type: 'number',
		default: 600,
		typeOptions: { minValue: 1, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['template'], templateName: ['Custom'] } },
		description: 'Custom canvas height in pixels',
	},
	{
		displayName: 'Background Color',
		name: 'templateBgColor',
		type: 'color',
		default: '#1a1a2e',
		typeOptions: { showAlpha: false },
		displayOptions: { show: { operation: ['template'] } },
		description: 'Background fill colour for the template canvas',
	},
	{
		displayName: 'Gradient Overlay Color',
		name: 'templateGradientColor',
		type: 'color',
		default: '#e94560',
		typeOptions: { showAlpha: false },
		displayOptions: { show: { operation: ['template'] } },
		description: 'Color of the subtle gradient overlay on the background',
	},
	{
		displayName: 'Layout Type',
		name: 'templateLayout',
		type: 'options',
		options: [
			{ name: 'Standard (Title & Subtitle)', value: 'standard' },
			{ name: 'Quote', value: 'quote' },
			{ name: 'Meme (Top & Bottom Text)', value: 'meme' },
		],
		default: 'standard',
		displayOptions: { show: { operation: ['template'] } },
		description: 'The layout of the text on the canvas',
	},
	{
		displayName: 'Title Text',
		name: 'templateTitle',
		type: 'string',
		default: '',
		placeholder: 'e.g. My Brand',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'] } },
		description: 'Primary headline text (leave blank to skip)',
	},
	{
		displayName: 'Title Font',
		name: 'templateTitleFont',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getFontList' },
		default: 'Arial',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'] } },
		description: 'Font family for the title (Note: Custom fonts must be installed on your n8n OS)',
	},
	{
		displayName: 'Title Font (Custom)',
		name: 'templateTitleFontCustom',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['template'],
				templateLayout: ['standard'],
				templateTitleFont: ['custom'],
			},
		},
		description: 'Type the exact font-family name (e.g. "Playfair Display", serif)',
	},
	{
		displayName: 'Title Font Style',
		name: 'templateTitleFontStyle',
		type: 'options',
		options: fontStyleOptions,
		default: 'bold',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'] } },
		description: 'Font style for the title',
	},
	{
		displayName: 'Title Color',
		name: 'templateTitleColor',
		type: 'color',
		default: '#ffffff',
		displayOptions: {
			show: { operation: ['template'], templateLayout: ['standard', 'quote', 'meme'] },
		},
		description: 'Primary text colour',
	},
	{
		displayName: 'Subtitle Text',
		name: 'templateSubtitle',
		type: 'string',
		default: '',
		placeholder: 'e.g. Your tagline here',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'] } },
		description: 'Secondary subtitle text (leave blank to skip)',
	},
	{
		displayName: 'Subtitle Font',
		name: 'templateSubtitleFont',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getFontList' },
		default: 'Arial',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'] } },
		description: 'Font family for the subtitle',
	},
	{
		displayName: 'Subtitle Font (Custom)',
		name: 'templateSubtitleFontCustom',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['template'],
				templateLayout: ['standard'],
				templateSubtitleFont: ['custom'],
			},
		},
		description: 'Type the exact font-family name (e.g. "Playfair Display", serif)',
	},
	{
		displayName: 'Subtitle Font Style',
		name: 'templateSubtitleFontStyle',
		type: 'options',
		options: fontStyleOptions,
		default: 'normal',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard'] } },
		description: 'Font style for the subtitle',
	},
	{
		displayName: 'Subtitle Color',
		name: 'templateSubtitleColor',
		type: 'color',
		default: '#cccccc',
		displayOptions: { show: { operation: ['template'], templateLayout: ['standard', 'quote'] } },
		description: 'Secondary text colour',
	},
	{
		displayName: 'Quote Text',
		name: 'templateQuote',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		placeholder: 'e.g. "To be or not to be..."',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'A centered quote to display on the template. Wraps automatically.',
	},
	{
		displayName: 'Quote Font',
		name: 'templateQuoteFont',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getFontList' },
		default: 'Georgia',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Font family for the quote',
	},
	{
		displayName: 'Quote Font (Custom)',
		name: 'templateQuoteFontCustom',
		type: 'string',
		default: '',
		displayOptions: {
			show: { operation: ['template'], templateLayout: ['quote'], templateQuoteFont: ['custom'] },
		},
		description: 'Type the exact font-family name',
	},
	{
		displayName: 'Quote Font Style',
		name: 'templateQuoteFontStyle',
		type: 'options',
		options: fontStyleOptions,
		default: 'italic',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Font style for the quote',
	},
	{
		displayName: 'Quote Author',
		name: 'templateQuoteAuthor',
		type: 'string',
		default: '',
		placeholder: 'e.g. William Shakespeare',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'The author of the quote, displayed centered at the bottom',
	},
	{
		displayName: 'Quote Author Font',
		name: 'templateQuoteAuthorFont',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getFontList' },
		default: 'Arial',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Font family for the author',
	},
	{
		displayName: 'Quote Author Font (Custom)',
		name: 'templateQuoteAuthorFontCustom',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['template'],
				templateLayout: ['quote'],
				templateQuoteAuthorFont: ['custom'],
			},
		},
		description: 'Type the exact font-family name',
	},
	{
		displayName: 'Quote Author Font Style',
		name: 'templateQuoteAuthorFontStyle',
		type: 'options',
		options: fontStyleOptions,
		default: 'normal',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Font style for the quote author',
	},
	{
		displayName: 'Top Text',
		name: 'templateMemeTop',
		type: 'string',
		default: '',
		placeholder: 'e.g. WHEN YOU REALIZE...',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'] } },
		description: 'Text displayed at the top of the meme',
	},
	{
		displayName: 'Top Text Font',
		name: 'templateMemeTopFont',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getFontList' },
		default: 'Impact',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'] } },
		description: 'Font family for the top text',
	},
	{
		displayName: 'Top Text Font (Custom)',
		name: 'templateMemeTopFontCustom',
		type: 'string',
		default: '',
		displayOptions: {
			show: { operation: ['template'], templateLayout: ['meme'], templateMemeTopFont: ['custom'] },
		},
		description: 'Type the exact font-family name',
	},
	{
		displayName: 'Top Text Font Style',
		name: 'templateMemeTopFontStyle',
		type: 'options',
		options: fontStyleOptions,
		default: 'bold',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'] } },
		description: 'Font style for the top text',
	},
	{
		displayName: 'Bottom Text',
		name: 'templateMemeBottom',
		type: 'string',
		default: '',
		placeholder: 'e.g. ITS FRIDAY',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'] } },
		description: 'Text displayed at the bottom of the meme',
	},
	{
		displayName: 'Bottom Text Font',
		name: 'templateMemeBottomFont',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getFontList' },
		default: 'Impact',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'] } },
		description: 'Font family for the bottom text',
	},
	{
		displayName: 'Bottom Text Font (Custom)',
		name: 'templateMemeBottomFontCustom',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				operation: ['template'],
				templateLayout: ['meme'],
				templateMemeBottomFont: ['custom'],
			},
		},
		description: 'Type the exact font-family name',
	},
	{
		displayName: 'Bottom Text Font Style',
		name: 'templateMemeBottomFontStyle',
		type: 'options',
		options: fontStyleOptions,
		default: 'bold',
		displayOptions: { show: { operation: ['template'], templateLayout: ['meme'] } },
		description: 'Font style for the bottom text',
	},
	{
		displayName: 'Accent Color',
		name: 'templateAccentColor',
		type: 'color',
		default: '#e94560',
		displayOptions: { show: { operation: ['template'] } },
		description: 'Accent bar / decorative element colour',
	},

	// -- Global Text Effects --
	{
		displayName: 'Global Text Effect',
		name: 'templateTextEffect',
		type: 'options',
		options: [
			{ name: 'Default (Subtle Shadow for Standard, Outline for Meme)', value: 'default' },
			{ name: 'Drop Shadow', value: 'shadow' },
			{ name: 'Glow', value: 'glow' },
			{ name: 'None', value: 'none' },
			{ name: 'Outline', value: 'outline' },
		],
		default: 'default',
		displayOptions: { show: { operation: ['template'] } },
		description: 'Apply an effect to all main text elements on the canvas',
	},
	{
		displayName: 'Effect Color',
		name: 'templateEffectColor',
		type: 'color',
		default: '#000000',
		displayOptions: {
			show: { operation: ['template'], templateTextEffect: ['shadow', 'glow', 'outline'] },
		},
	},
	{
		displayName: 'Effect Opacity (%)',
		name: 'templateEffectOpacity',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 50,
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['shadow', 'glow'] } },
	},
	{
		displayName: 'Shadow/Glow Blur Size',
		name: 'templateEffectBlur',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 200 },
		default: 4,
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['shadow', 'glow'] } },
	},
	{
		displayName: 'Shadow Offset X',
		name: 'templateEffectOffsetX',
		type: 'number',
		default: 2,
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['shadow'] } },
	},
	{
		displayName: 'Shadow Offset Y',
		name: 'templateEffectOffsetY',
		type: 'number',
		default: 2,
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['shadow'] } },
	},
	{
		displayName: 'Outline Width',
		name: 'templateEffectOutlineWidth',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 200 },
		default: 2,
		displayOptions: { show: { operation: ['template'], templateTextEffect: ['outline'] } },
	},

	// -- Watermark (Quote Layout) --
	{
		displayName: 'Watermark Text',
		name: 'quoteWatermarkText',
		type: 'string',
		default: '',
		placeholder: 'e.g. @yourhandle',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Optional watermark text (leave blank to skip)',
	},
	{
		displayName: 'Watermark Font',
		name: 'quoteWatermarkFont',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getFontList' },
		default: 'Arial',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Font family for the watermark',
	},
	{
		displayName: 'Watermark Font (Custom)',
		name: 'quoteWatermarkFontCustom',
		type: 'string',
		default: '',
		displayOptions: {
			show: { operation: ['template'], templateLayout: ['quote'], quoteWatermarkFont: ['custom'] },
		},
		description: 'Type the exact font-family name',
	},
	{
		displayName: 'Watermark Color',
		name: 'quoteWatermarkColor',
		type: 'color',
		default: '#ffffff',
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
	},
	{
		displayName: 'Watermark Opacity (%)',
		name: 'quoteWatermarkOpacity',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 30,
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
	},
	{
		displayName: 'Watermark X Position (%)',
		name: 'quoteWatermarkX',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 50,
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Horizontal position from 0 (left) to 100 (right)',
	},
	{
		displayName: 'Watermark Y Position (%)',
		name: 'quoteWatermarkY',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 95,
		displayOptions: { show: { operation: ['template'], templateLayout: ['quote'] } },
		description: 'Vertical position from 0 (top) to 100 (bottom)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// draw
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Primitive',
		name: 'primitive',
		type: 'options',
		displayOptions: { show: { operation: ['draw'] } },
		options: [
			{ name: 'Circle', value: 'circle' },
			{ name: 'Line', value: 'line' },
			{ name: 'Rectangle', value: 'rectangle' },
		],
		default: 'rectangle',
		description: 'Shape to draw',
	},
	{
		displayName: 'Color',
		name: 'color',
		type: 'color',
		default: '#ff0000',
		typeOptions: { showAlpha: true },
		displayOptions: { show: { operation: ['draw'] } },
		description: 'Fill colour of the shape',
	},
	{
		displayName: 'Stroke Color',
		name: 'strokeColor',
		type: 'color',
		default: '#000000',
		typeOptions: { showAlpha: true },
		displayOptions: { show: { operation: ['draw'] } },
		description: 'Outline stroke colour (set alpha to 0 for no stroke)',
	},
	{
		displayName: 'Stroke Width',
		name: 'strokeWidth',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: 1000 },
		displayOptions: { show: { operation: ['draw'] } },
		description: 'Width of the stroke outline in pixels (0 = no stroke)',
	},
	{
		displayName: 'Start Position X',
		name: 'startPositionX',
		type: 'number',
		default: 50,
		displayOptions: { show: { operation: ['draw'], primitive: ['circle', 'line', 'rectangle'] } },
		description: 'X start position of the shape',
	},
	{
		displayName: 'Start Position Y',
		name: 'startPositionY',
		type: 'number',
		default: 50,
		displayOptions: { show: { operation: ['draw'], primitive: ['circle', 'line', 'rectangle'] } },
		description: 'Y start position of the shape',
	},
	{
		displayName: 'End Position X',
		name: 'endPositionX',
		type: 'number',
		default: 250,
		displayOptions: { show: { operation: ['draw'], primitive: ['circle', 'line', 'rectangle'] } },
		description: 'X end position of the shape',
	},
	{
		displayName: 'End Position Y',
		name: 'endPositionY',
		type: 'number',
		default: 250,
		displayOptions: { show: { operation: ['draw'], primitive: ['circle', 'line', 'rectangle'] } },
		description: 'Y end position of the shape',
	},
	{
		displayName: 'Corner Radius',
		name: 'cornerRadius',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['draw'], primitive: ['rectangle'] } },
		description: 'Radius for rounded rectangle corners',
	},

	// ────────────────────────────────────────────────────────────────────────
	// text
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		placeholder: 'Text to render',
		displayOptions: { show: { operation: ['text'] } },
		description: 'Text content to add to the image',
	},
	{
		displayName: 'Font Size',
		name: 'fontSize',
		type: 'number',
		default: 48,
		typeOptions: { minValue: 1, maxValue: 4000 },
		displayOptions: { show: { operation: ['text'] } },
		description: 'Font size in pixels',
	},
	{
		displayName: 'Font Family',
		name: 'fontFamily',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getFontList' },
		default: 'Arial',
		displayOptions: { show: { operation: ['text'] } },
		description: 'Font family to use. The font must be installed on your n8n server.',
	},
	{
		displayName: 'Font Family (Custom)',
		name: 'fontFamilyCustom',
		type: 'string',
		default: '',
		placeholder: 'e.g. Montserrat, sans-serif',
		displayOptions: { show: { operation: ['text'], fontFamily: ['custom'] } },
		description: 'Type the exact font-family CSS value (e.g. "Playfair Display", serif)',
	},
	{
		displayName: 'Font Color',
		name: 'fontColor',
		type: 'color',
		default: '#ffffff',
		displayOptions: { show: { operation: ['text'] } },
		description: 'Text colour',
	},
	{
		displayName: 'Font Style',
		name: 'fontStyle',
		type: 'options',
		default: 'normal',
		displayOptions: { show: { operation: ['text'] } },
		options: fontStyleOptions,
	},
	{
		displayName: 'Text Align',
		name: 'textAlign',
		type: 'options',
		default: 'middle',
		displayOptions: { show: { operation: ['text'] } },
		options: [
			{ name: 'Left', value: 'start' },
			{ name: 'Center', value: 'middle' },
			{ name: 'Right', value: 'end' },
		],
		description: 'Horizontal text alignment',
	},
	{
		displayName: 'Position X',
		name: 'positionX',
		type: 'number',
		default: 540,
		displayOptions: { show: { operation: ['text'] } },
		description: 'X coordinate of the text anchor point',
	},
	{
		displayName: 'Position Y',
		name: 'positionY',
		type: 'number',
		default: 540,
		displayOptions: { show: { operation: ['text'] } },
		description: 'Y coordinate of the text anchor point (baseline)',
	},
	{
		displayName: 'Line Height',
		name: 'lineHeight',
		type: 'number',
		default: 1.4,
		typeOptions: { minValue: 0.5, maxValue: 5, numberPrecision: 1 },
		displayOptions: { show: { operation: ['text'] } },
		description: 'Line height multiplier (e.g. 1.4 = 140% of font size)',
	},
	{
		displayName: 'Max Line Length (Chars)',
		name: 'lineLength',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 10000 },
		default: 40,
		displayOptions: { show: { operation: ['text'] } },
		description: 'Maximum characters per line before wrapping',
	},
	{
		displayName: 'Text Shadow',
		name: 'textShadow',
		type: 'boolean',
		default: false,
		displayOptions: { show: { operation: ['text'] } },
		description: 'Whether to add a drop shadow behind the text',
	},

	// ────────────────────────────────────────────────────────────────────────
	// blur
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Sigma',
		name: 'sigma',
		type: 'number',
		typeOptions: { minValue: 0.3, maxValue: 1000, numberPrecision: 1 },
		default: 3,
		displayOptions: { show: { operation: ['blur'] } },
		description: 'Blur radius (sigma). Higher = more blur.',
	},

	// ────────────────────────────────────────────────────────────────────────
	// border
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Border Width',
		name: 'borderWidth',
		type: 'number',
		default: 20,
		typeOptions: { minValue: 0, maxValue: MAX_BORDER },
		displayOptions: { show: { operation: ['border'] } },
		description: 'Left and right border width in pixels',
	},
	{
		displayName: 'Border Height',
		name: 'borderHeight',
		type: 'number',
		default: 20,
		typeOptions: { minValue: 0, maxValue: MAX_BORDER },
		displayOptions: { show: { operation: ['border'] } },
		description: 'Top and bottom border height in pixels',
	},
	{
		displayName: 'Border Color',
		name: 'borderColor',
		type: 'color',
		default: '#000000',
		displayOptions: { show: { operation: ['border'] } },
		description: 'Colour of the border',
	},

	// ────────────────────────────────────────────────────────────────────────
	// composite
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Composite Image Property',
		name: 'dataPropertyNameComposite',
		type: 'string',
		default: 'data2',
		placeholder: 'data2',
		displayOptions: { show: { operation: ['composite'] } },
		description: 'Binary property name that contains the image to overlay',
	},
	{
		displayName: 'Blend Mode',
		name: 'operator',
		type: 'options',
		displayOptions: { show: { operation: ['composite'] } },
		options: [
			{ name: 'Add', value: 'add' },
			{ name: 'Atop', value: 'atop' },
			{ name: 'Clear', value: 'clear' },
			{ name: 'Colour Burn', value: 'colour-burn' },
			{ name: 'Colour Dodge', value: 'colour-dodge' },
			{ name: 'Darken', value: 'darken' },
			{ name: 'Destination Atop', value: 'dest-atop' },
			{ name: 'Destination In', value: 'dest-in' },
			{ name: 'Destination Out', value: 'dest-out' },
			{ name: 'Destination Over', value: 'dest-over' },
			{ name: 'Difference', value: 'difference' },
			{ name: 'Exclusion', value: 'exclusion' },
			{ name: 'Hard Light', value: 'hard-light' },
			{ name: 'In', value: 'in' },
			{ name: 'Lighten', value: 'lighten' },
			{ name: 'Multiply', value: 'multiply' },
			{ name: 'Out', value: 'out' },
			{ name: 'Over (Normal)', value: 'over' },
			{ name: 'Overlay', value: 'overlay' },
			{ name: 'Saturate', value: 'saturate' },
			{ name: 'Screen', value: 'screen' },
			{ name: 'Soft Light', value: 'soft-light' },
			{ name: 'Source', value: 'source' },
			{ name: 'Xor', value: 'xor' },
		],
		default: 'over',
		description: 'Blending mode for compositing',
	},
	{
		displayName: 'Position X',
		name: 'positionX',
		type: 'number',
		default: 0,
		displayOptions: { show: { operation: ['composite'] } },
		description: 'X offset of the overlay image (pixels from left)',
	},
	{
		displayName: 'Position Y',
		name: 'positionY',
		type: 'number',
		default: 0,
		displayOptions: { show: { operation: ['composite'] } },
		description: 'Y offset of the overlay image (pixels from top)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// crop
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Width',
		name: 'width',
		type: 'number',
		default: 500,
		typeOptions: { minValue: 1, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['crop'] } },
		description: 'Width of the crop region',
	},
	{
		displayName: 'Height',
		name: 'height',
		type: 'number',
		default: 500,
		typeOptions: { minValue: 1, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['crop'] } },
		description: 'Height of the crop region',
	},
	{
		displayName: 'Position X',
		name: 'positionX',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['crop'] } },
		description: 'X coordinate (from left) of the crop start',
	},
	{
		displayName: 'Position Y',
		name: 'positionY',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['crop'] } },
		description: 'Y coordinate (from top) of the crop start',
	},

	// ────────────────────────────────────────────────────────────────────────
	// resize
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Width',
		name: 'width',
		type: 'number',
		default: 1080,
		typeOptions: { minValue: 1, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['resize'] } },
		description: 'Target width in pixels',
	},
	{
		displayName: 'Height',
		name: 'height',
		type: 'number',
		default: 1080,
		typeOptions: { minValue: 1, maxValue: MAX_DIMENSION },
		displayOptions: { show: { operation: ['resize'] } },
		description: 'Target height in pixels',
	},
	{
		displayName: 'Fit',
		name: 'resizeOption',
		type: 'options',
		options: [
			{ name: 'Contain (Letterbox)', value: 'contain', description: 'Scales to fit, adds padding' },
			{ name: 'Cover (Crop to Fill)', value: 'cover', description: 'Scales to fill, crops excess' },
			{
				name: 'Fill (Ignore Aspect Ratio)',
				value: 'fill',
				description: 'Stretches to exact dimensions',
			},
			{
				name: 'Inside (Max Area)',
				value: 'inside',
				description: 'Scales down only if larger than dimensions',
			},
			{
				name: 'Outside (Min Area)',
				value: 'outside',
				description: 'Scales up only if smaller than dimensions',
			},
		],
		default: 'cover',
		displayOptions: { show: { operation: ['resize'] } },
		description: 'How to fit the image into the target dimensions',
	},
	{
		displayName: 'Background Color (for Contain)',
		name: 'resizeBackground',
		type: 'color',
		default: '#000000',
		typeOptions: { showAlpha: true },
		displayOptions: { show: { operation: ['resize'], resizeOption: ['contain'] } },
		description: 'Background fill colour when using "Contain" fit',
	},

	// ────────────────────────────────────────────────────────────────────────
	// rotate
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Degrees',
		name: 'rotate',
		type: 'number',
		typeOptions: { minValue: -360, maxValue: 360 },
		default: 90,
		displayOptions: { show: { operation: ['rotate'] } },
		description: 'Angle to rotate (positive = clockwise)',
	},
	{
		displayName: 'Background Color',
		name: 'backgroundColor',
		type: 'color',
		default: '#00000000',
		typeOptions: { showAlpha: true },
		displayOptions: { show: { operation: ['rotate'] } },
		description: 'Fill colour for the area revealed by rotation',
	},

	// ────────────────────────────────────────────────────────────────────────
	// shear
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Shear X (Degrees)',
		name: 'degreesX',
		type: 'number',
		typeOptions: { minValue: MIN_SHEAR_DEGREES, maxValue: MAX_SHEAR_DEGREES, numberPrecision: 1 },
		default: 0,
		displayOptions: { show: { operation: ['shear'] } },
		description: 'Horizontal shear angle in degrees (-85 to 85)',
	},
	{
		displayName: 'Shear Y (Degrees)',
		name: 'degreesY',
		type: 'number',
		typeOptions: { minValue: MIN_SHEAR_DEGREES, maxValue: MAX_SHEAR_DEGREES, numberPrecision: 1 },
		default: 10,
		displayOptions: { show: { operation: ['shear'] } },
		description: 'Vertical shear angle in degrees (-85 to 85)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// transparent (PNG output, trims near-white/black to alpha)
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Background Color to Remove',
		name: 'transparentColor',
		type: 'color',
		default: '#ffffff',
		displayOptions: { show: { operation: ['transparent'] } },
		description: 'The background colour to replace with transparency',
	},
	{
		displayName: 'Tolerance',
		name: 'tolerance',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 255 },
		default: 30,
		displayOptions: { show: { operation: ['transparent'] } },
		description: 'Colour matching tolerance (0 = exact match only, 255 = match everything)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// sharpen
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Sigma',
		name: 'sharpenSigma',
		type: 'number',
		typeOptions: { minValue: 0.5, maxValue: 5, numberPrecision: 1 },
		default: 1,
		displayOptions: { show: { operation: ['sharpen'] } },
		description: 'Unsharp mask sigma. Higher = wider radius.',
	},
	{
		displayName: 'Flat Area Threshold',
		name: 'sharpenFlat',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 10000, numberPrecision: 1 },
		default: 1,
		displayOptions: { show: { operation: ['sharpen'] } },
		description: 'Threshold of flat areas (lower = sharpen more of the image)',
	},
	{
		displayName: 'Jagged Area Threshold',
		name: 'sharpenJagged',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 10000, numberPrecision: 1 },
		default: 2,
		displayOptions: { show: { operation: ['sharpen'] } },
		description: 'Threshold of jagged edges (higher = sharpen edges more aggressively)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// gamma
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Gamma Value',
		name: 'gammaValue',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 3, numberPrecision: 1 },
		default: 2.2,
		displayOptions: { show: { operation: ['gamma'] } },
		description: 'Gamma value between 1.0 (darker) and 3.0 (brighter)',
	},

	// ────────────────────────────────────────────────────────────────────────
	// tint
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Tint Color',
		name: 'tintColor',
		type: 'color',
		default: '#ff6b35',
		displayOptions: { show: { operation: ['tint'] } },
		description: 'Colour to tint the image with',
	},

	// ────────────────────────────────────────────────────────────────────────
	// watermark
	// ────────────────────────────────────────────────────────────────────────
	{
		displayName: 'Watermark Image Property',
		name: 'watermarkProperty',
		type: 'string',
		default: 'watermark',
		placeholder: 'watermark',
		displayOptions: { show: { operation: ['watermark'] } },
		description: 'Binary property name containing the watermark image',
	},
	{
		displayName: 'Gravity (Position)',
		name: 'watermarkGravity',
		type: 'options',
		displayOptions: { show: { operation: ['watermark'] } },
		options: [
			{ name: 'Bottom Center', value: 'south' },
			{ name: 'Bottom Left', value: 'southwest' },
			{ name: 'Bottom Right', value: 'southeast' },
			{ name: 'Center', value: 'centre' },
			{ name: 'Middle Left', value: 'west' },
			{ name: 'Middle Right', value: 'east' },
			{ name: 'Top Center', value: 'north' },
			{ name: 'Top Left', value: 'northwest' },
			{ name: 'Top Right', value: 'northeast' },
		],
		default: 'southeast',
		description: 'Where to place the watermark',
	},
	{
		displayName: 'Opacity (%)',
		name: 'watermarkOpacity',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 100 },
		default: 50,
		displayOptions: { show: { operation: ['watermark'] } },
		description: 'Watermark opacity from 0 (invisible) to 100 (fully opaque)',
	},
	{
		displayName: 'Max Size (% of Canvas)',
		name: 'watermarkScale',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 20,
		displayOptions: { show: { operation: ['watermark'] } },
		description: 'Scale the watermark so its longest side is this % of the canvas',
	},
];

/**
 * Single Source of Truth: Auto-derive operation -> parameter names map directly from `nodeOperationOptions`.
 */
export const OPERATION_PARAM_MAP: Record<string, string[]> = (() => {
	const map: Record<string, Set<string>> = {};
	for (const prop of nodeOperationOptions) {
		const ops = prop.displayOptions?.show?.operation;
		if (Array.isArray(ops)) {
			for (const op of ops) {
				if (typeof op === 'string') {
					if (!map[op]) {
						map[op] = new Set<string>();
					}
					map[op].add(prop.name);
				}
			}
		}
	}
	const out: Record<string, string[]> = {};
	for (const [op, set] of Object.entries(map)) {
		out[op] = [...set];
	}
	return out;
})();

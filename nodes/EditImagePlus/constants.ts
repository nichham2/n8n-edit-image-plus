import type { INodePropertyOptions } from 'n8n-workflow';

export const MAX_DIMENSION = 16383;
export const MAX_BORDER = 4096;
export const MIN_SHEAR_DEGREES = -85;
export const MAX_SHEAR_DEGREES = 85;

export interface ImageTemplate {
	name: string;
	width: number;
	height: number;
	description: string;
}

export const IMAGE_TEMPLATES: ImageTemplate[] = [
	{ name: 'Instagram Post (1:1)', width: 1080, height: 1080, description: 'Instagram square post' },
	{
		name: 'Instagram Story (9:16)',
		width: 1080,
		height: 1920,
		description: 'Instagram/TikTok story',
	},
	{
		name: 'Instagram Portrait (4:5)',
		width: 1080,
		height: 1350,
		description: 'Instagram portrait',
	},
	{ name: 'Twitter/X Post (16:9)', width: 1200, height: 675, description: 'Twitter card image' },
	{ name: 'YouTube Thumbnail', width: 1280, height: 720, description: 'YouTube video thumbnail' },
	{ name: 'Facebook Post', width: 1200, height: 630, description: 'Facebook link preview' },
	{ name: 'LinkedIn Banner', width: 1584, height: 396, description: 'LinkedIn profile banner' },
	{ name: 'LinkedIn Post', width: 1200, height: 627, description: 'LinkedIn post image' },
	{ name: 'Pinterest Pin', width: 1000, height: 1500, description: 'Pinterest tall pin' },
	{ name: 'Open Graph (OG)', width: 1200, height: 630, description: 'General Open Graph image' },
	{ name: 'Email Header', width: 600, height: 200, description: 'Email header banner' },
	{ name: 'Presentation Slide (16:9)', width: 1920, height: 1080, description: 'Full-HD slide' },
	{ name: 'Business Card', width: 1050, height: 600, description: 'Standard business card' },
	{ name: 'A4 Document', width: 2480, height: 3508, description: 'A4 at 300 DPI' },
	{ name: 'Custom', width: 800, height: 600, description: 'Enter your own dimensions' },
];

export const DEFAULT_FONT_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Arial', value: 'Arial' },
	{ name: 'Cinzel', value: 'Cinzel' },
	{ name: 'Cormorant Garamond', value: 'Cormorant Garamond' },
	{ name: 'Courier New', value: 'Courier New' },
	{ name: 'Georgia', value: 'Georgia' },
	{ name: 'Impact', value: 'Impact' },
	{ name: 'Inter', value: 'Inter' },
	{ name: 'Montserrat', value: 'Montserrat' },
	{ name: 'Playfair Display', value: 'Playfair Display' },
	{ name: 'Times New Roman', value: 'Times New Roman' },
	{ name: 'Trebuchet MS', value: 'Trebuchet MS' },
	{ name: 'Verdana', value: 'Verdana' },
	{ name: 'Custom (Type Below)', value: 'custom' },
];

export const fontStyleOptions: INodePropertyOptions[] = [
	{ name: 'Normal', value: 'normal' },
	{ name: 'Bold', value: 'bold' },
	{ name: 'Italic', value: 'italic' },
	{ name: 'Bold Italic', value: 'bold italic' },
];

export const nodeOperations: INodePropertyOptions[] = [
	{
		name: 'Blur',
		value: 'blur',
		description: 'Apply Gaussian blur to the image',
		action: 'Blur image',
	},
	{
		name: 'Border',
		value: 'border',
		description: 'Add a solid-colour border',
		action: 'Add border',
	},
	{
		name: 'Composite',
		value: 'composite',
		description: 'Overlay one image on top of another',
		action: 'Composite image',
	},
	{
		name: 'Create',
		value: 'create',
		description: 'Generate a blank canvas',
		action: 'Create image',
	},
	{
		name: 'Crop',
		value: 'crop',
		description: 'Extract a region from the image',
		action: 'Crop image',
	},
	{
		name: 'Draw',
		value: 'draw',
		description: 'Draw shapes (rectangle, circle, line)',
		action: 'Draw on image',
	},
	{
		name: 'Flip',
		value: 'flip',
		description: 'Flip the image vertically (top ↔ bottom)',
		action: 'Flip image',
	},
	{
		name: 'Flop',
		value: 'flop',
		description: 'Flop the image horizontally (left ↔ right)',
		action: 'Flop image',
	},
	{ name: 'Gamma', value: 'gamma', description: 'Apply gamma correction', action: 'Apply gamma' },
	{
		name: 'Grayscale',
		value: 'grayscale',
		description: 'Convert image to grayscale',
		action: 'Convert to grayscale',
	},
	{
		name: 'Normalize',
		value: 'normalize',
		description: 'Stretch contrast to full dynamic range',
		action: 'Normalize image',
	},
	{
		name: 'Resize',
		value: 'resize',
		description: 'Change image dimensions',
		action: 'Resize image',
	},
	{
		name: 'Rotate',
		value: 'rotate',
		description: 'Rotate the image by an angle',
		action: 'Rotate image',
	},
	{
		name: 'Sepia',
		value: 'sepia',
		description: 'Apply a warm sepia tone',
		action: 'Apply sepia tone',
	},
	{
		name: 'Sharpen',
		value: 'sharpen',
		description: 'Increase image sharpness',
		action: 'Sharpen image',
	},
	{
		name: 'Shear',
		value: 'shear',
		description: 'Shear the image along X or Y axis',
		action: 'Shear image',
	},
	{
		name: 'Template',
		value: 'template',
		description: 'Create from a preset canvas template',
		action: 'Create from template',
	},
	{ name: 'Text', value: 'text', description: 'Render text onto the image', action: 'Add text' },
	{ name: 'Tint', value: 'tint', description: 'Apply a colour tint', action: 'Tint image' },
	{
		name: 'Transparent',
		value: 'transparent',
		description: 'Make the image background transparent (PNG)',
		action: 'Make transparent',
	},
	{
		name: 'Watermark',
		value: 'watermark',
		description: 'Overlay a watermark image with configurable opacity',
		action: 'Add watermark',
	},
];

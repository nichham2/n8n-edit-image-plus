import { execFile } from 'child_process';
import { promisify } from 'util';
import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError, deepCopy } from 'n8n-workflow';
import type sharp from 'sharp';
import { DEFAULT_FONT_OPTIONS, nodeOperations } from './constants';
import { applyOperation, buildSingleOpParams, createBlankCanvas } from './operations';
import { nodeOperationOptions } from './properties';
import { buildTemplateInstance } from './templateBuilder';
import {
	assertSafeInputMetadata,
	createSafeSharp,
	formatSafeMetadata,
	normalizeOutputFileName,
} from './utils';

const execFileAsync = promisify(execFile);

/**
 * Module-scoped cache for `fc-list` font discovery so opening multiple font dropdowns
 * in the n8n UI does not repeatedly spawn subprocesses.
 */
let cachedFontList: INodePropertyOptions[] | null = null;

export class EditImagePlus implements INodeType {
	methods = {
		loadOptions: {
			async getFontList(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				if (cachedFontList) {
					return cachedFontList;
				}

				const families = new Set<string>();

				try {
					const { stdout } = await execFileAsync('fc-list', ['--format=%{family}\\n'], {
						timeout: 5000,
					});
					for (const line of stdout.split('\n')) {
						for (const part of line.split(',')) {
							const name = part.trim().replace(/^["']|["']$/g, '');
							if (name && name.length > 1) {
								families.add(name);
							}
						}
					}
				} catch {
					cachedFontList = DEFAULT_FONT_OPTIONS;
					return cachedFontList;
				}

				if (families.size === 0) {
					cachedFontList = DEFAULT_FONT_OPTIONS;
					return cachedFontList;
				}

				const sorted = [...families].sort((a, b) =>
					a.toLowerCase().localeCompare(b.toLowerCase()),
				);

				const options: INodePropertyOptions[] = sorted.map((family) => ({
					name: family,
					value: family,
				}));

				options.push({ name: 'Custom (Type Below)', value: 'custom' });
				cachedFontList = options;
				return cachedFontList;
			},
		},
	};

	description: INodeTypeDescription = {
		displayName: 'Edit Image+',
		name: 'editImagePlus',
		icon: 'fa:image',
		group: ['transform'],
		version: 1,
		description:
			'Advanced image editing: blur, crop, resize, text, templates, effects and more — powered by Sharp',
		defaults: {
			name: 'Edit Image+',
			color: '#553399',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			// ────────────────────────────────────────────────────────────────
			// Top-level operation selector
			// ────────────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Information',
						value: 'information',
						description: 'Return image metadata (size, format, DPI, …)',
						action: 'Get image information',
					},
					{
						name: 'Multi Step',
						value: 'multiStep',
						description: 'Chain multiple operations in one node',
						action: 'Apply multiple operations',
					},
					...nodeOperations,
				].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
				default: 'resize',
			},
			// Input binary property (hidden only for standalone create & template)
			{
				displayName: 'Input Property Name',
				name: 'dataPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					hide: { operation: ['create', 'template'] },
				},
				description: 'Name of the binary property that contains the input image',
			},

			// ────────────────────────────────────────────────────────────────
			// multiStep fixed-collection
			// ────────────────────────────────────────────────────────────────
			{
				displayName: 'Operations',
				name: 'operations',
				placeholder: 'Add Operation',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, sortable: true },
				displayOptions: { show: { operation: ['multiStep'] } },
				description: 'Operations to apply in sequence',
				default: {},
				options: [
					{
						name: 'operations',
						displayName: 'Operations',
						values: [
							{
								displayName: 'Operation',
								name: 'operation',
								type: 'options',
								noDataExpression: true,
								options: nodeOperations,
								default: 'resize',
							},
							...nodeOperationOptions,
						],
					},
				],
			},

			// Spread single-step operation params
			...nodeOperationOptions,

			// ────────────────────────────────────────────────────────────────
			// Output options
			// ────────────────────────────────────────────────────────────────
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Output Option',
				default: {},
				displayOptions: { hide: { operation: ['information'] } },
				options: [
					{
						displayName: 'File Name',
						name: 'fileName',
						type: 'string',
						default: '',
						description: 'Override the file name stored in binary data',
					},
					{
						displayName: 'Format',
						name: 'format',
						type: 'options',
						options: [
							{ name: 'AVIF', value: 'avif' },
							{ name: 'GIF', value: 'gif' },
							{ name: 'JPEG', value: 'jpeg' },
							{ name: 'PNG', value: 'png' },
							{ name: 'TIFF', value: 'tiff' },
							{ name: 'WebP', value: 'webp' },
						],
						default: 'png',
						description: 'Output image format',
					},
					{
						displayName: 'Keep Metadata (EXIF / ICC)',
						name: 'keepMetadata',
						type: 'boolean',
						default: false,
						description: 'Whether to preserve EXIF metadata and ICC colour profiles in the output image',
					},
					{
						displayName: 'Output Property Name',
						name: 'outputPropertyName',
						type: 'string',
						default: '',
						placeholder: 'Leave blank to overwrite input property',
						description: 'Binary property name for the output image',
					},
					{
						displayName: 'PNG Compression Level',
						name: 'pngCompressionLevel',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 9 },
						default: 6,
						displayOptions: { show: { format: ['png'] } },
						description: 'PNG compression level 0 (fastest) to 9 (smallest)',
					},
					{
						displayName: 'Quality (JPEG / WebP / AVIF / TIFF)',
						name: 'quality',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 100 },
						default: 90,
						displayOptions: { show: { format: ['jpeg', 'webp', 'avif', 'tiff'] } },
						description: 'Output quality 1–100 (higher = better quality, larger file)',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex];
			try {
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const dataPropertyName = this.getNodeParameter(
					'dataPropertyName',
					itemIndex,
					'data',
				) as string;
				const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;

				// ── Get information ─────────────────────────────────────────
				if (operation === 'information') {
					this.helpers.assertBinaryData(itemIndex, dataPropertyName);
					const buf = await this.helpers.getBinaryDataBuffer(itemIndex, dataPropertyName);
					const infoSharp = createSafeSharp(buf);
					const meta = await assertSafeInputMetadata(infoSharp, 'Get Information operation');
					returnData.push({
						json: formatSafeMetadata(meta) as IDataObject,
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				// Determine which operations list to process
				let operations: IDataObject[] = [];
				if (operation === 'multiStep') {
					const operationsData = this.getNodeParameter('operations', itemIndex, {
						operations: [],
					}) as IDataObject;
					operations = (operationsData.operations as IDataObject[]) ?? [];
					if (operations.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'Multi Step operation requires at least one step to be configured.',
							{ itemIndex },
						);
					}
				} else {
					const singleOp = buildSingleOpParams(this, operation, itemIndex);
					operations = [{ operation, ...singleOp }];
				}

				const outputPropertyName =
					((options.outputPropertyName as string) || '').trim() || dataPropertyName;
				const keepMetadata = options.keepMetadata === true;

				// ── Initialize base Sharp pipeline ──────────────────────────
				let sharpInstance: sharp.Sharp;
				const firstOp = operations[0]?.operation as string | undefined;

				if (firstOp === 'create') {
					sharpInstance = createBlankCanvas(operations[0]);
				} else if (firstOp === 'template') {
					sharpInstance = await buildTemplateInstance(operations[0]);
				} else {
					this.helpers.assertBinaryData(itemIndex, dataPropertyName);
					const buf = await this.helpers.getBinaryDataBuffer(itemIndex, dataPropertyName);
					sharpInstance = createSafeSharp(buf);
					const inputMeta = await assertSafeInputMetadata(sharpInstance, 'Input image');
					if (inputMeta.orientation !== undefined && inputMeta.orientation > 1) {
						const orientedPipe = keepMetadata
							? sharpInstance.rotate().withMetadata({ orientation: 1 })
							: sharpInstance.rotate();
						const orientedBuf = await orientedPipe.png().toBuffer();
						sharpInstance = createSafeSharp(orientedBuf);
					}
				}

				// ── Apply each operation in sequence ────────────────────────
				for (let stepIdx = 0; stepIdx < operations.length; stepIdx++) {
					const op = operations[stepIdx];
					const opName = (op.operation as string) || 'unknown';
					try {
						sharpInstance = await applyOperation(this, sharpInstance, op, itemIndex, stepIdx);
						// When chaining multiple steps, materialize after each intermediate step so the next
						// step sees accurate post-transform .metadata() and does not overwrite .composite()
						if (operations.length > 1 && stepIdx < operations.length - 1) {
							if (keepMetadata) {
								sharpInstance = sharpInstance.withMetadata();
							}
							const stepBuf = await sharpInstance.png().toBuffer();
							sharpInstance = createSafeSharp(stepBuf);
						}
					} catch (stepError) {
						const prefix =
							operations.length > 1
								? `Step ${stepIdx + 1}/${operations.length} (${opName}) failed: `
								: '';
						throw new NodeOperationError(
							this.getNode(),
							`${prefix}${(stepError as Error).message}`,
							{ itemIndex },
						);
					}
				}

				// ── Optional metadata preservation ──────────────────────────
				if (keepMetadata) {
					sharpInstance = sharpInstance.withMetadata();
				}

				// ── Output format ───────────────────────────────────────────
				const fmt = ((options.format as string) || 'png').toLowerCase();
				const mimeType = `image/${fmt}`;
				const quality = (options.quality as number) ?? 90;
				const pngLevel = (options.pngCompressionLevel as number) ?? 6;

				if (fmt === 'jpeg') {
					sharpInstance = sharpInstance.jpeg({ quality });
				} else if (fmt === 'webp') {
					sharpInstance = sharpInstance.webp({ quality });
				} else if (fmt === 'avif') {
					sharpInstance = sharpInstance.avif({ quality });
				} else if (fmt === 'png') {
					sharpInstance = sharpInstance.png({ compressionLevel: pngLevel });
				} else if (fmt === 'tiff') {
					sharpInstance = sharpInstance.tiff({ quality });
				} else if (fmt === 'gif') {
					sharpInstance = sharpInstance.gif();
				} else {
					sharpInstance = sharpInstance.png({ compressionLevel: pngLevel });
				}

				const outputBuffer = await sharpInstance.toBuffer();

				// ── Assemble output item ────────────────────────────────────
				const newItem: INodeExecutionData = {
					json: deepCopy(item.json),
					binary: item.binary ? deepCopy(item.binary) : {},
					pairedItem: { item: itemIndex },
				};

				const fileName = normalizeOutputFileName(options.fileName, fmt);
				const binaryData = await this.helpers.prepareBinaryData(outputBuffer, fileName, mimeType);
				newItem.binary![outputPropertyName] = binaryData;

				returnData.push(newItem);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							...deepCopy(item.json),
							error: (error as Error).message,
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}


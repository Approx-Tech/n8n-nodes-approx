import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
} from 'n8n-workflow';

import { approxApiRequest, buildDqbQuery, unwrapList } from '../../utils/GenericFunctions';

export class Approx implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Approx',
        name: 'approx',
        icon: 'file:approx.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: 'Automate Approx construction cost-estimation and quantity-takeoff workflows.',
        defaults: { name: 'Approx' },
        inputs: ['main'] as any,
        outputs: ['main'] as any,
        credentials: [{ name: 'approxOAuth2Api', required: true }],
        properties: [
            // =========================================================
            // Resource
            // =========================================================
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                default: 'project',
                options: [
                    { name: 'Authority', value: 'authority', description: 'Pricing authorities (kurumlar)' },
                    { name: 'File', value: 'file', description: 'Download a file by blob ID' },
                    { name: 'Original File', value: 'originalFile', description: 'AutoCAD / source files attached to a work-group type' },
                    { name: 'Pricing', value: 'pricing', description: 'Unit prices inside a pricing library' },
                    { name: 'Pricing Library', value: 'pricingLibrary', description: 'Pricing libraries available to the tenant' },
                    { name: 'Project', value: 'project', description: 'Approx project (top-level resource)' },
                    { name: 'Property', value: 'property', description: 'Properties (mahaller) inside a project' },
                    { name: 'Property Type', value: 'propertyType', description: 'Property-type tree exposed by a takeoff template or project' },
                    { name: 'Report', value: 'report', description: 'Project reports (generate, poll, download)' },
                    { name: 'Report Template', value: 'reportTemplate', description: 'Report templates belonging to a takeoff template' },
                    { name: 'Static File', value: 'staticFile', description: 'Static (image/PDF) files attached to a property' },
                    { name: 'Takeoff Template', value: 'takeoffTemplate', description: 'Takeoff (metraj) templates' },
                    { name: 'Work Group Type', value: 'workGroupType', description: 'Work-group types derived from a project\u2019s takeoff template' },
                ],
            },

            // =========================================================
            // Authority — operations + fields
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['authority'] } },
                default: 'getMany',
                options: [
                    { name: 'Create', value: 'create', action: 'Create an authority', description: 'Create a new authority' },
                    { name: 'Delete', value: 'delete', action: 'Delete an authority', description: 'Delete an authority by ID' },
                    { name: 'Get', value: 'get', action: 'Get an authority', description: 'Retrieve an authority by ID' },
                    { name: 'Get Many', value: 'getMany', action: 'Get many authorities', description: 'List all authorities for the tenant' },
                    { name: 'Update Logo', value: 'updateLogo', action: 'Update an authority logo', description: 'Update an authority logo (Base64)' },
                    { name: 'Update Name', value: 'updateName', action: 'Update an authority name', description: 'Update an authority name' },
                ],
            },
            {
                displayName: 'Authority ID',
                name: 'authorityId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['authority'], operation: ['get', 'delete', 'updateName', 'updateLogo'] } },
                description: 'The ID of the authority',
            },
            {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['authority'], operation: ['create'] } },
                description: 'Authority display name (minimum 3 characters)',
            },
            {
                displayName: 'Base64 Logo',
                name: 'base64Logo',
                type: 'string',
                default: '',
                displayOptions: { show: { resource: ['authority'], operation: ['create'] } },
                description: 'Optional Base64-encoded logo image',
            },
            {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['authority'], operation: ['updateName'] } },
                description: 'New authority name (minimum 3 characters)',
            },
            {
                displayName: 'Base64 Logo',
                name: 'base64Logo',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['authority'], operation: ['updateLogo'] } },
                description: 'Base64-encoded logo image',
            },

            // =========================================================
            // File (download by blob ID)
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['file'] } },
                default: 'download',
                options: [
                    { name: 'Download', value: 'download', action: 'Download a file', description: 'Download a file by blob ID' },
                ],
            },
            {
                displayName: 'Blob ID',
                name: 'blobId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['file'], operation: ['download'] } },
                description: 'Blob ID of the file to download',
            },
            {
                displayName: 'Put Output File in Field',
                name: 'binaryPropertyName',
                type: 'string',
                required: true,
                default: 'data',
                displayOptions: { show: { resource: ['file'], operation: ['download'] } },
                description: 'Name of the binary property to write the downloaded file to',
                hint: 'The name of the output binary field to store the file in',
            },

            // =========================================================
            // Original File / Static File — shared operations + fields
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['originalFile'] } },
                default: 'getMany',
                options: [
                    { name: 'Delete', value: 'delete', action: 'Delete an original file', description: 'Delete an original file' },
                    { name: 'Get Many', value: 'getMany', action: 'Get many original files', description: 'List original files for a work-group type' },
                    { name: 'Upload Many', value: 'uploadMany', action: 'Upload many original files', description: 'Bulk-upload up to 100 files per request' },
                ],
            },
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['staticFile'] } },
                default: 'getMany',
                options: [
                    { name: 'Delete', value: 'delete', action: 'Delete a static file', description: 'Delete a static file' },
                    { name: 'Get Many', value: 'getMany', action: 'Get many static files', description: 'List static files attached to a property' },
                    { name: 'Upload Many', value: 'uploadMany', action: 'Upload many static files', description: 'Bulk-upload up to 100 files per request' },
                ],
            },
            {
                displayName: 'Project ID',
                name: 'projectId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['originalFile', 'staticFile'] } },
                description: 'The owning project ID',
            },
            {
                displayName: 'Work Group Type ID',
                name: 'workGroupTypeId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['originalFile', 'staticFile'] } },
                description: 'Work-group type ID the files belong to',
            },
            {
                displayName: 'Property ID',
                name: 'propertyId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['staticFile'] } },
                description: 'Property ID the static files are attached to',
            },
            {
                displayName: 'File ID',
                name: 'fileId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['originalFile', 'staticFile'], operation: ['delete'] } },
                description: 'File ID to delete',
            },
            {
                displayName: 'Input Binary Fields',
                name: 'binaryPropertyNames',
                type: 'string',
                required: true,
                default: 'data',
                displayOptions: { show: { resource: ['originalFile', 'staticFile'], operation: ['uploadMany'] } },
                description: 'Comma-separated list of binary fields on the input item to upload (each maps to one file)',
                hint: 'The names of the input binary fields containing the files to upload',
            },

            // =========================================================
            // Pricing Library
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['pricingLibrary'] } },
                default: 'getMany',
                options: [
                    { name: 'Get Many', value: 'getMany', action: 'Get many pricing libraries', description: 'List pricing libraries available to the tenant' },
                ],
            },
            {
                displayName: 'Query Options',
                name: 'queryOptions',
                type: 'collection',
                placeholder: 'Add option',
                default: {},
                displayOptions: { show: { resource: ['pricingLibrary'], operation: ['getMany'] } },
                options: [
                    { displayName: 'Order By', name: 'orderBy', type: 'string', default: '', placeholder: 'name asc', description: 'DQB order-by expression' },
                    { displayName: 'Skip', name: 'skip', type: 'number', default: 0, description: 'Number of items to skip' },
                    { displayName: 'Take', name: 'take', type: 'number', default: 50, description: 'Number of items to return (max 200)' },
                    { displayName: 'Where', name: 'where', type: 'string', default: '', placeholder: 'name|Contains|foo', description: 'DQB where expression' },
                ],
            },

            // =========================================================
            // Pricing
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['pricing'] } },
                default: 'getMany',
                options: [
                    { name: 'Get Many', value: 'getMany', action: 'Get many pricings', description: 'List unit prices inside a library' },
                ],
            },
            {
                displayName: 'Library ID',
                name: 'libraryId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['pricing'] } },
                description: 'Pricing library ID',
            },
            {
                displayName: 'Valid From',
                name: 'validFrom',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'YYYY-MM-DD',
                displayOptions: { show: { resource: ['pricing'] } },
                description: 'Lower bound (inclusive) of the pricing validity window. Format: YYYY-MM-DD.',
            },
            {
                displayName: 'Valid To',
                name: 'validTo',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'YYYY-MM-DD',
                displayOptions: { show: { resource: ['pricing'] } },
                description: 'Upper bound (inclusive) of the pricing validity window. Format: YYYY-MM-DD.',
            },
            {
                displayName: 'Query Options',
                name: 'queryOptions',
                type: 'collection',
                placeholder: 'Add option',
                default: {},
                displayOptions: { show: { resource: ['pricing'], operation: ['getMany'] } },
                options: [
                    { displayName: 'Order By', name: 'orderBy', type: 'string', default: '', placeholder: 'name asc', description: 'DQB order-by expression' },
                    { displayName: 'Skip', name: 'skip', type: 'number', default: 0, description: 'Number of items to skip' },
                    { displayName: 'Take', name: 'take', type: 'number', default: 50, description: 'Items per page (max 200)' },
                    { displayName: 'Where', name: 'where', type: 'string', default: '', placeholder: 'name|Contains|foo', description: 'DQB where expression' },
                ],
            },

            // =========================================================
            // Project
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['project'] } },
                default: 'getMany',
                options: [
                    { name: 'Create', value: 'create', action: 'Create a project', description: 'Create a new project' },
                    { name: 'Delete', value: 'delete', action: 'Delete a project', description: 'Delete a project' },
                    { name: 'Get', value: 'get', action: 'Get a project', description: 'Retrieve a project by ID' },
                    { name: 'Get Many', value: 'getMany', action: 'Get many projects', description: 'List projects (paginated)' },
                    { name: 'Update', value: 'update', action: 'Update a project', description: 'Update a project' },
                ],
            },
            {
                displayName: 'Project ID',
                name: 'projectId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['project'], operation: ['get', 'update', 'delete'] } },
                description: 'The ID of the project',
            },
            {
                displayName: 'Name',
                name: 'projectName',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['project'], operation: ['create'] } },
                description: 'Display name for the project',
            },
            {
                displayName: 'Authority ID',
                name: 'authorityId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['project'], operation: ['create'] } },
                description: 'Authority (pricing authority) ID to associate with the project',
            },
            {
                displayName: 'Takeoff Template ID',
                name: 'takeoffTemplateId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['project'], operation: ['create'] } },
                description: 'Takeoff template ID to apply to the project',
            },
            {
                displayName: 'Report Template ID',
                name: 'reportTemplateId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['project'], operation: ['create'] } },
                description: 'Report template ID to assign to the project',
            },
            {
                displayName: 'Carriage Percentage',
                name: 'carriagePercentage',
                type: 'number',
                required: true,
                typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 4 },
                default: 0,
                displayOptions: { show: { resource: ['project'], operation: ['create'] } },
                description: 'Carriage (nakliye) percentage between 0 and 1 (e.g. 0.04 = 4%)',
            },
            {
                displayName: 'Expand Custom Pricings',
                name: 'expandCustomPricings',
                type: 'boolean',
                default: false,
                displayOptions: { show: { resource: ['project'], operation: ['create'] } },
                description: 'Whether to expand custom pricings into individual rows',
            },
            {
                displayName: 'Project Name',
                name: 'projectName',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['project'], operation: ['update'] } },
                description: 'New project name',
            },
            {
                displayName: 'Report Template ID',
                name: 'reportTemplateId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['project'], operation: ['update'] } },
                description: 'Report template ID to assign to the project',
            },
            {
                displayName: 'Carriage Percentage',
                name: 'carriagePercentage',
                type: 'number',
                required: true,
                typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 4 },
                default: 0,
                displayOptions: { show: { resource: ['project'], operation: ['update'] } },
                description: 'Carriage (nakliye) percentage between 0 and 1',
            },
            {
                displayName: 'Expand Custom Pricings',
                name: 'expandCustomPricings',
                type: 'boolean',
                default: false,
                displayOptions: { show: { resource: ['project'], operation: ['update'] } },
                description: 'Whether to expand custom pricings into individual rows',
            },
            {
                displayName: 'Query Options',
                name: 'queryOptions',
                type: 'collection',
                placeholder: 'Add option',
                default: {},
                displayOptions: { show: { resource: ['project'], operation: ['getMany'] } },
                options: [
                    { displayName: 'Order By', name: 'orderBy', type: 'string', default: '', placeholder: 'name asc', description: 'DQB order-by expression' },
                    { displayName: 'Skip', name: 'skip', type: 'number', default: 0, description: 'Number of items to skip' },
                    { displayName: 'Take', name: 'take', type: 'number', default: 50, description: 'Number of items to return (max 200)' },
                    { displayName: 'Where', name: 'where', type: 'string', default: '', placeholder: 'name|Contains|foo', description: 'DQB where expression' },
                ],
            },

            // =========================================================
            // Property
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['property'] } },
                default: 'getMany',
                options: [
                    { name: 'Create', value: 'create', action: 'Create a property', description: 'Create a single property' },
                    { name: 'Create Many', value: 'createMany', action: 'Create many properties', description: 'Bulk-create properties' },
                    { name: 'Delete', value: 'delete', action: 'Delete a property', description: 'Delete a property' },
                    { name: 'Get', value: 'get', action: 'Get a property', description: 'Get a property by ID' },
                    { name: 'Get Many', value: 'getMany', action: 'Get many properties', description: 'List properties of a project (paginated)' },
                    { name: 'Update Multiplier', value: 'updateMultiplier', action: 'Update a property multiplier', description: 'Set the multiplier on a multiplexable property' },
                    { name: 'Update Name', value: 'updateName', action: 'Update a property name', description: 'Rename a property' },
                ],
            },
            {
                displayName: 'Project ID',
                name: 'projectId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['property'] } },
                description: 'The owning project ID',
            },
            {
                displayName: 'Property ID',
                name: 'propertyId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['property'], operation: ['get', 'delete', 'updateName', 'updateMultiplier'] } },
                description: 'The ID of the property',
            },
            {
                displayName: 'Property (JSON)',
                name: 'propertyJson',
                type: 'json',
                required: true,
                default: '{\n  "propertyTypeId": "",\n  "name": ""\n}',
                displayOptions: { show: { resource: ['property'], operation: ['create'] } },
                description: 'Property payload. Shape is defined by the project\u2019s takeoff template (Excel import schema). Minimum keys: propertyTypeId, name. Use the Template resource to discover the exact columns for your template.',
            },
            {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['property'], operation: ['updateName'] } },
                description: 'New property name',
            },
            {
                displayName: 'Multiplier',
                name: 'multiplier',
                type: 'number',
                required: true,
                typeOptions: { minValue: 1 },
                default: 1,
                displayOptions: { show: { resource: ['property'], operation: ['updateMultiplier'] } },
                description: 'Multiplier value (must be greater than 0)',
            },
            {
                displayName: 'Properties (JSON)',
                name: 'propertiesJson',
                type: 'json',
                required: true,
                default: '[\n  {\n    "propertyTypeId": "",\n    "name": "",\n    "code": ""\n  }\n]',
                displayOptions: { show: { resource: ['property'], operation: ['createMany'] } },
                description: 'Array of property objects. Required keys per item: propertyTypeId. Optional: name, code.',
            },
            {
                displayName: 'Query Options',
                name: 'queryOptions',
                type: 'collection',
                placeholder: 'Add option',
                default: {},
                displayOptions: { show: { resource: ['property'], operation: ['getMany'] } },
                options: [
                    { displayName: 'Order By', name: 'orderBy', type: 'string', default: '', description: 'DQB order-by expression' },
                    { displayName: 'Skip', name: 'skip', type: 'number', default: 0, description: 'Number of items to skip' },
                    { displayName: 'Take', name: 'take', type: 'number', default: 50, description: 'Number of items to return (max 200)' },
                    { displayName: 'Where', name: 'where', type: 'string', default: '', description: 'DQB where expression' },
                ],
            },

            // =========================================================
            // Property Type
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['propertyType'] } },
                default: 'getByTakeoffTemplate',
                options: [
                    { name: 'Get by Project', value: 'getByProject', action: 'Get property types by project', description: 'Get the root property type (with descendants) for a project' },
                    { name: 'Get by Takeoff Template', value: 'getByTakeoffTemplate', action: 'Get property types by takeoff template', description: 'Get the root property type (with descendants) defined on a takeoff template' },
                ],
            },
            {
                displayName: 'Takeoff Template ID',
                name: 'takeoffTemplateId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['propertyType'], operation: ['getByTakeoffTemplate'] } },
                description: 'The owning takeoff template whose property-type tree to fetch',
            },
            {
                displayName: 'Project ID',
                name: 'projectId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['propertyType'], operation: ['getByProject'] } },
                description: 'The owning project whose property-type tree to fetch',
            },

            // =========================================================
            // Report
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['report'] } },
                default: 'create',
                options: [
                    { name: 'Create', value: 'create', action: 'Create a report', description: 'Queue a new report for a project' },
                    { name: 'Download', value: 'download', action: 'Download a report', description: 'Download a completed report (returns ZIP). Fails with 409 if not completed.' },
                    { name: 'Get', value: 'get', action: 'Get a report', description: 'Get report metadata (status, timestamps)' },
                ],
            },
            {
                displayName: 'Project ID',
                name: 'projectId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['report'], operation: ['create'] } },
                description: 'Project ID to generate the report for',
            },
            {
                displayName: 'Report ID',
                name: 'reportId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['report'], operation: ['get', 'download'] } },
                description: 'The ID of the report',
            },
            {
                displayName: 'Put Output File in Field',
                name: 'binaryPropertyName',
                type: 'string',
                required: true,
                default: 'data',
                displayOptions: { show: { resource: ['report'], operation: ['download'] } },
                description: 'Name of the binary property to write the downloaded report ZIP to',
                hint: 'The name of the output binary field to store the file in',
            },

            // =========================================================
            // Report Template
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['reportTemplate'] } },
                default: 'getMany',
                options: [
                    { name: 'Get Many', value: 'getMany', action: 'Get many report templates', description: 'List report templates belonging to a takeoff template' },
                ],
            },
            {
                displayName: 'Takeoff Template ID',
                name: 'takeoffTemplateId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['reportTemplate'] } },
                description: 'The owning takeoff template ID',
            },

            // =========================================================
            // Takeoff Template
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['takeoffTemplate'] } },
                default: 'getMany',
                options: [
                    { name: 'Get', value: 'get', action: 'Get a takeoff template', description: 'Retrieve a takeoff template by ID' },
                    { name: 'Get Many', value: 'getMany', action: 'Get many takeoff templates', description: 'List takeoff templates for the tenant in a given culture' },
                ],
            },
            {
                displayName: 'Culture',
                name: 'culture',
                type: 'string',
                required: true,
                default: 'tr-TR',
                placeholder: 'tr-TR',
                displayOptions: { show: { resource: ['takeoffTemplate'], operation: ['getMany'] } },
                description: 'Template culture (e.g. tr-TR, en-US)',
            },
            {
                displayName: 'Takeoff Template ID',
                name: 'takeoffTemplateId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['takeoffTemplate'], operation: ['get'] } },
                description: 'The ID of the takeoff template',
            },

            // =========================================================
            // Work Group Type
            // =========================================================
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['workGroupType'] } },
                default: 'getMany',
                options: [
                    { name: 'Get Many', value: 'getMany', action: 'Get many work group types', description: 'List work-group types for a project' },
                ],
            },
            {
                displayName: 'Project ID',
                name: 'projectId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['workGroupType'] } },
                description: 'The owning project ID',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const resource = this.getNodeParameter('resource', i) as string;
                const operation = this.getNodeParameter('operation', i) as string;

                // ---------- Authority ----------
                if (resource === 'authority') {
                    if (operation === 'getMany') {
                        const res = await approxApiRequest.call(this, 'GET', '/api/integrations/authorities');
                        const { items: rows } = unwrapList(res);
                        returnData.push(...rows.map((json) => ({ json })));
                    } else if (operation === 'get') {
                        const id = this.getNodeParameter('authorityId', i) as string;
                        const res = await approxApiRequest.call(this, 'GET', `/api/integrations/authorities/${id}`);
                        returnData.push({ json: res });
                    } else if (operation === 'create') {
                        const body = {
                            name: this.getNodeParameter('name', i) as string,
                            base64Logo: this.getNodeParameter('base64Logo', i, '') as string,
                        };
                        await approxApiRequest.call(this, 'POST', '/api/integrations/authorities', body);
                        returnData.push({ json: { success: true, ...body } });
                    } else if (operation === 'updateName') {
                        const id = this.getNodeParameter('authorityId', i) as string;
                        const name = this.getNodeParameter('name', i) as string;
                        await approxApiRequest.call(this, 'PUT', `/api/integrations/authorities/${id}/name`, { name });
                        returnData.push({ json: { success: true, authorityId: id, name } });
                    } else if (operation === 'updateLogo') {
                        const id = this.getNodeParameter('authorityId', i) as string;
                        const base64Logo = this.getNodeParameter('base64Logo', i) as string;
                        await approxApiRequest.call(this, 'PUT', `/api/integrations/authorities/${id}/logo`, { base64Logo });
                        returnData.push({ json: { success: true, authorityId: id } });
                    } else if (operation === 'delete') {
                        const id = this.getNodeParameter('authorityId', i) as string;
                        await approxApiRequest.call(this, 'DELETE', `/api/integrations/authorities/${id}`);
                        returnData.push({ json: { success: true, authorityId: id } });
                    }

                // ---------- File (download) ----------
                } else if (resource === 'file' && operation === 'download') {
                    const blobId = this.getNodeParameter('blobId', i) as string;
                    const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
                    const response = (await approxApiRequest.call(
                        this,
                        'GET',
                        `/api/integrations/files/${blobId}/download`,
                        undefined,
                        {},
                        { encoding: 'arraybuffer', json: false, returnFullResponse: true },
                    )) as { body: Buffer; headers: Record<string, string> };
                    const buffer = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body);
                    const contentType = response.headers?.['content-type'] ?? 'application/octet-stream';
                    const disposition = response.headers?.['content-disposition'] ?? '';
                    const match = /filename\*?=(?:UTF-\d+''|")?([^";]+)/i.exec(disposition);
                    const captured = match?.[1];
                    const filename = captured ? decodeURIComponent(captured.replace(/"$/, '')) : blobId;
                    const binaryData = await this.helpers.prepareBinaryData(buffer, filename, contentType);
                    returnData.push({ json: { blobId, filename, mimeType: contentType }, binary: { [binaryPropertyName]: binaryData } });

                // ---------- Original File / Static File ----------
                } else if (resource === 'originalFile' || resource === 'staticFile') {
                    const projectId = this.getNodeParameter('projectId', i) as string;
                    const workGroupTypeId = this.getNodeParameter('workGroupTypeId', i) as string;
                    const segment = resource === 'originalFile' ? 'original-files' : 'static-files';
                    const base = `/api/integrations/projects/${projectId}/${segment}`;

                    if (operation === 'getMany') {
                        const qs: Record<string, string> = { workGroupTypeId };
                        if (resource === 'staticFile') {
                            qs.propertyId = this.getNodeParameter('propertyId', i) as string;
                        }
                        const res = await approxApiRequest.call(this, 'GET', base, undefined, qs);
                        const { items: rows } = unwrapList(res);
                        returnData.push(...rows.map((json) => ({ json })));
                    } else if (operation === 'delete') {
                        const id = this.getNodeParameter('fileId', i) as string;
                        await approxApiRequest.call(this, 'DELETE', `${base}/${id}`);
                        returnData.push({ json: { success: true, id } });
                    } else if (operation === 'uploadMany') {
                        const names = (this.getNodeParameter('binaryPropertyNames', i) as string)
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                        if (names.length === 0) {
                            throw new NodeOperationError(this.getNode(), 'No binary property names provided.', { itemIndex: i });
                        }
                        if (names.length > 100) {
                            throw new NodeOperationError(this.getNode(), 'A single bulk upload may contain at most 100 files.', { itemIndex: i });
                        }
                        const formData: Record<string, unknown> = {
                            ProjectID: projectId,
                            WorkGroupTypeID: workGroupTypeId,
                        };
                        if (resource === 'staticFile') {
                            formData.PropertyID = this.getNodeParameter('propertyId', i) as string;
                        }
                        const files: Array<{ value: Buffer; options: { filename: string; contentType: string } }> = [];
                        for (const name of names) {
                            const binary = this.helpers.assertBinaryData(i, name);
                            const buffer = await this.helpers.getBinaryDataBuffer(i, name);
                            files.push({
                                value: buffer,
                                options: {
                                    filename: binary.fileName ?? name,
                                    contentType: binary.mimeType ?? 'application/octet-stream',
                                },
                            });
                        }
                        formData.Files = files;

                        const res = await approxApiRequest.call(
                            this,
                            'POST',
                            `${base}:bulk`,
                            undefined,
                            {},
                            { body: formData as any, json: false, headers: { Accept: 'application/json' } },
                        );
                        returnData.push({ json: { success: true, count: files.length, response: res ?? null } });
                    }

                // ---------- Pricing Library ----------
                } else if (resource === 'pricingLibrary') {
                    const qs = buildDqbQuery(this.getNodeParameter('queryOptions', i, {}) as any);
                    const res = await approxApiRequest.call(this, 'GET', '/api/integrations/pricing/libraries', undefined, qs);
                    const { items: rows } = unwrapList(res);
                    returnData.push(...rows.map((json) => ({ json })));

                // ---------- Pricing ----------
                } else if (resource === 'pricing') {
                    const libraryId = this.getNodeParameter('libraryId', i) as string;
                    const qs = buildDqbQuery(this.getNodeParameter('queryOptions', i, {}) as any);
                    qs.validFrom = this.getNodeParameter('validFrom', i) as string;
                    qs.validTo = this.getNodeParameter('validTo', i) as string;
                    const res = await approxApiRequest.call(
                        this,
                        'GET',
                        `/api/integrations/pricing/libraries/${libraryId}/pricings`,
                        undefined,
                        qs,
                    );
                    const { items: rows } = unwrapList(res);
                    returnData.push(...rows.map((json) => ({ json })));

                // ---------- Project ----------
                } else if (resource === 'project') {
                    if (operation === 'getMany') {
                        const qs = buildDqbQuery(this.getNodeParameter('queryOptions', i, {}) as any);
                        const res = await approxApiRequest.call(this, 'GET', '/api/integrations/projects', undefined, qs);
                        const { items: rows } = unwrapList(res);
                        returnData.push(...rows.map((json) => ({ json })));
                    } else if (operation === 'get') {
                        const id = this.getNodeParameter('projectId', i) as string;
                        const res = await approxApiRequest.call(this, 'GET', `/api/integrations/projects/${id}`);
                        returnData.push({ json: res });
                    } else if (operation === 'create') {
                        const body = {
                            projectName: this.getNodeParameter('projectName', i) as string,
                            authorityId: this.getNodeParameter('authorityId', i) as string,
                            takeoffTemplateId: this.getNodeParameter('takeoffTemplateId', i) as string,
                            reportTemplateId: this.getNodeParameter('reportTemplateId', i) as string,
                            carriagePercentage: this.getNodeParameter('carriagePercentage', i) as number,
                            expandCustomPricings: this.getNodeParameter('expandCustomPricings', i, false) as boolean,
                        };
                        const res = await approxApiRequest.call(this, 'POST', '/api/integrations/projects', body);
                        returnData.push({ json: res });
                    } else if (operation === 'update') {
                        const id = this.getNodeParameter('projectId', i) as string;
                        const body = {
                            projectName: this.getNodeParameter('projectName', i) as string,
                            reportTemplateId: this.getNodeParameter('reportTemplateId', i) as string,
                            carriagePercentage: this.getNodeParameter('carriagePercentage', i) as number,
                            expandCustomPricings: this.getNodeParameter('expandCustomPricings', i, false) as boolean,
                        };
                        const res = await approxApiRequest.call(this, 'PUT', `/api/integrations/projects/${id}`, body);
                        returnData.push({ json: res ?? { success: true } });
                    } else if (operation === 'delete') {
                        const id = this.getNodeParameter('projectId', i) as string;
                        await approxApiRequest.call(this, 'DELETE', `/api/integrations/projects/${id}`);
                        returnData.push({ json: { success: true, id } });
                    }

                // ---------- Property ----------
                } else if (resource === 'property') {
                    const projectId = this.getNodeParameter('projectId', i) as string;
                    const base = `/api/integrations/projects/${projectId}/properties`;
                    if (operation === 'getMany') {
                        const qs = buildDqbQuery(this.getNodeParameter('queryOptions', i, {}) as any);
                        const res = await approxApiRequest.call(this, 'GET', base, undefined, qs);
                        const { items: rows } = unwrapList(res);
                        returnData.push(...rows.map((json) => ({ json })));
                    } else if (operation === 'get') {
                        const pid = this.getNodeParameter('propertyId', i) as string;
                        const res = await approxApiRequest.call(this, 'GET', `${base}/${pid}`);
                        returnData.push({ json: res });
                    } else if (operation === 'create') {
                        const raw = this.getNodeParameter('propertyJson', i) as string | object;
                        const property = typeof raw === 'string' ? JSON.parse(raw) : raw;
                        const res = await approxApiRequest.call(this, 'POST', base, { property });
                        returnData.push({ json: res ?? { success: true } });
                    } else if (operation === 'createMany') {
                        const raw = this.getNodeParameter('propertiesJson', i) as string | object;
                        const properties = typeof raw === 'string' ? JSON.parse(raw) : raw;
                        const res = await approxApiRequest.call(this, 'POST', `${base}:bulk`, { properties });
                        returnData.push({ json: res ?? { success: true } });
                    } else if (operation === 'updateName') {
                        const pid = this.getNodeParameter('propertyId', i) as string;
                        const name = this.getNodeParameter('name', i) as string;
                        await approxApiRequest.call(this, 'PUT', `${base}/${pid}/name`, { name });
                        returnData.push({ json: { success: true, id: pid, name } });
                    } else if (operation === 'updateMultiplier') {
                        const pid = this.getNodeParameter('propertyId', i) as string;
                        const multiplier = this.getNodeParameter('multiplier', i) as number;
                        await approxApiRequest.call(this, 'PUT', `${base}/${pid}/multiplier`, { multiplier });
                        returnData.push({ json: { success: true, id: pid, multiplier } });
                    } else if (operation === 'delete') {
                        const pid = this.getNodeParameter('propertyId', i) as string;
                        await approxApiRequest.call(this, 'DELETE', `${base}/${pid}`);
                        returnData.push({ json: { success: true, id: pid } });
                    }

                // ---------- Property Type ----------
                } else if (resource === 'propertyType') {
                    if (operation === 'getByTakeoffTemplate') {
                        const id = this.getNodeParameter('takeoffTemplateId', i) as string;
                        const res = await approxApiRequest.call(this, 'GET', `/api/integrations/templates/takeoff/${id}/property-types`);
                        returnData.push({ json: res });
                    } else if (operation === 'getByProject') {
                        const id = this.getNodeParameter('projectId', i) as string;
                        const res = await approxApiRequest.call(this, 'GET', `/api/integrations/templates/projects/${id}/property-types`);
                        returnData.push({ json: res });
                    }

                // ---------- Report ----------
                } else if (resource === 'report') {
                    if (operation === 'create') {
                        const projectId = this.getNodeParameter('projectId', i) as string;
                        const res = await approxApiRequest.call(this, 'POST', '/api/integrations/reports', { projectId });
                        returnData.push({ json: res });
                    } else if (operation === 'get') {
                        const id = this.getNodeParameter('reportId', i) as string;
                        const res = await approxApiRequest.call(this, 'GET', `/api/integrations/reports/${id}`);
                        returnData.push({ json: res });
                    } else if (operation === 'download') {
                        const id = this.getNodeParameter('reportId', i) as string;
                        const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
                        const response = (await approxApiRequest.call(
                            this,
                            'GET',
                            `/api/integrations/reports/${id}/download`,
                            undefined,
                            {},
                            { encoding: 'arraybuffer', json: false, returnFullResponse: true },
                        )) as { body: Buffer; headers: Record<string, string> };
                        const buffer = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body);
                        const contentType = response.headers?.['content-type'] ?? 'application/zip';
                        const filename = `report-${id}.zip`;
                        const binary = await this.helpers.prepareBinaryData(buffer, filename, contentType);
                        returnData.push({ json: { reportId: id, filename, mimeType: contentType }, binary: { [binaryPropertyName]: binary } });
                    }

                // ---------- Report Template ----------
                } else if (resource === 'reportTemplate' && operation === 'getMany') {
                    const id = this.getNodeParameter('takeoffTemplateId', i) as string;
                    const res = await approxApiRequest.call(this, 'GET', `/api/integrations/templates/takeoff/${id}/report-templates`);
                    const { items: rows } = unwrapList(res);
                    returnData.push(...rows.map((json) => ({ json })));

                // ---------- Takeoff Template ----------
                } else if (resource === 'takeoffTemplate') {
                    if (operation === 'getMany') {
                        const culture = this.getNodeParameter('culture', i) as string;
                        const res = await approxApiRequest.call(this, 'GET', '/api/integrations/templates/takeoff', undefined, { culture });
                        const { items: rows } = unwrapList(res);
                        returnData.push(...rows.map((json) => ({ json })));
                    } else if (operation === 'get') {
                        const id = this.getNodeParameter('takeoffTemplateId', i) as string;
                        const res = await approxApiRequest.call(this, 'GET', `/api/integrations/templates/takeoff/${id}`);
                        returnData.push({ json: res });
                    }

                // ---------- Work Group Type ----------
                } else if (resource === 'workGroupType' && operation === 'getMany') {
                    const projectId = this.getNodeParameter('projectId', i) as string;
                    const res = await approxApiRequest.call(this, 'GET', `/api/integrations/projects/${projectId}/work-group-types`);
                    const { items: rows } = unwrapList(res);
                    returnData.push(...rows.map((json) => ({ json })));
                }
            } catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
                    continue;
                }
                throw error;
            }
        }

        return [returnData];
    }
}

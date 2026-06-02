import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
} from 'n8n-workflow';

import { approxApiRequest, buildDqbQuery, unwrapList } from '../../utils/GenericFunctions';

export class ApproxProject implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Approx Project',
        name: 'approxProject',
        icon: 'file:approx.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: 'Manage Approx projects, properties, and project-scoped files.',
        defaults: { name: 'Approx Project' },
        inputs: ['main'] as any,
        outputs: ['main'] as any,
        credentials: [{ name: 'approxApi', required: true }],
        properties: [
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                default: 'project',
                options: [
                    { name: 'File', value: 'file', description: 'Download a project file by blob ID' },
                    { name: 'Original File', value: 'originalFile', description: 'AutoCAD / source files attached to a work-group type' },
                    { name: 'Project', value: 'project', description: 'Approx project (top-level resource)' },
                    { name: 'Property', value: 'property', description: 'Properties (mahaller) inside a project' },
                    { name: 'Static File', value: 'staticFile', description: 'Static (image/PDF) files attached to a property' },
                    { name: 'Work Group Type', value: 'workGroupType', description: 'Work-group types derived from the project\u2019s takeoff template' },
                ],
            },

            // ---------- Project operations ----------
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
                displayName: 'Additional Fields',
                name: 'additionalFields',
                type: 'collection',
                placeholder: 'Add Field',
                default: {},
                displayOptions: { show: { resource: ['project'], operation: ['create', 'update'] } },
                options: [
                    { displayName: 'Carriage Percentage', name: 'carriagePercentage', type: 'number', default: 0, description: 'Carriage (ötürülük) percentage' },
                    { displayName: 'Expand Custom Pricings', name: 'expandCustomPricings', type: 'boolean', default: false, description: 'Whether to expand custom pricings into rows' },
                    { displayName: 'Project Name', name: 'projectName', type: 'string', default: '', description: 'New project name (update only)' },
                    { displayName: 'Report Template ID', name: 'reportTemplateId', type: 'string', default: '', description: 'Report template ID to assign' },
                ],
            },
            {
                displayName: 'Query Options',
                name: 'queryOptions',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                displayOptions: { show: { resource: ['project'], operation: ['getMany'] } },
                options: [
                    { displayName: 'Order By', name: 'orderBy', type: 'string', default: '', placeholder: 'name asc', description: 'DQB order-by expression' },
                    { displayName: 'Skip', name: 'skip', type: 'number', default: 0, description: 'Number of items to skip' },
                    { displayName: 'Take', name: 'take', type: 'number', default: 50, description: 'Number of items to return (max 200)' },
                    { displayName: 'Where', name: 'where', type: 'string', default: '', placeholder: 'name|Contains|foo', description: 'DQB where expression' },
                ],
            },

            // ---------- Work Group Type ----------
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

            // ---------- Property ----------
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

            },
            {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['property'], operation: ['create', 'updateName'] } },
                description: 'Property name',
            },
            {
                displayName: 'Property Type ID',
                name: 'propertyTypeId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['property'], operation: ['create'] } },

            },
            {
                displayName: 'Parent Property ID',
                name: 'parentPropertyId',
                type: 'string',
                default: '',
                displayOptions: { show: { resource: ['property'], operation: ['create'] } },
                description: 'Optional parent property ID (for nested properties)',
            },
            {
                displayName: 'Multiplier',
                name: 'multiplier',
                type: 'number',
                required: true,
                default: 1,
                displayOptions: { show: { resource: ['property'], operation: ['updateMultiplier'] } },
                description: 'Multiplier value (must be greater than 0)',
            },
            {
                displayName: 'Properties (JSON)',
                name: 'propertiesJson',
                type: 'json',
                required: true,
                default: '[]',
                displayOptions: { show: { resource: ['property'], operation: ['createMany'] } },
                description: 'Array of property objects: { name, propertyTypeId, parentPropertyId? }',
            },
            {
                displayName: 'Query Options',
                name: 'queryOptions',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                displayOptions: { show: { resource: ['property'], operation: ['getMany'] } },
                options: [
                    { displayName: 'Order By', name: 'orderBy', type: 'string', default: '' },
                    { displayName: 'Skip', name: 'skip', type: 'number', default: 0 },
                    { displayName: 'Take', name: 'take', type: 'number', default: 50 },
                    { displayName: 'Where', name: 'where', type: 'string', default: '' },
                ],
            },

            // ---------- Original / Static File shared inputs ----------
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['originalFile'] } },
                default: 'getMany',
                options: [
                    { name: 'Delete', value: 'delete', action: 'Delete an original file' },
                    { name: 'Get Many', value: 'getMany', action: 'Get many original files' },
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
                    { name: 'Delete', value: 'delete', action: 'Delete a static file' },
                    { name: 'Get Many', value: 'getMany', action: 'Get many static files' },
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
                displayName: 'Binary Property Names',
                name: 'binaryPropertyNames',
                type: 'string',
                required: true,
                default: 'data',
                displayOptions: { show: { resource: ['originalFile', 'staticFile'], operation: ['uploadMany'] } },
                description: 'Comma-separated list of binary property names on the input item to upload (each maps to one file)',
            },

            // ---------- File (download) ----------
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['file'] } },
                default: 'download',
                options: [
                    { name: 'Download', value: 'download', action: 'Download a file' },
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

                if (resource === 'project') {
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
                        const additional = this.getNodeParameter('additionalFields', i, {}) as any;
                        const body = {
                            projectName: this.getNodeParameter('projectName', i) as string,
                            authorityId: this.getNodeParameter('authorityId', i) as string,
                            takeoffTemplateId: this.getNodeParameter('takeoffTemplateId', i) as string,
                            ...additional,
                        };
                        const res = await approxApiRequest.call(this, 'POST', '/api/integrations/projects', body);
                        returnData.push({ json: res });
                    } else if (operation === 'update') {
                        const id = this.getNodeParameter('projectId', i) as string;
                        const additional = this.getNodeParameter('additionalFields', i, {}) as any;
                        const res = await approxApiRequest.call(this, 'PUT', `/api/integrations/projects/${id}`, additional);
                        returnData.push({ json: res ?? { success: true } });
                    } else if (operation === 'delete') {
                        const id = this.getNodeParameter('projectId', i) as string;
                        await approxApiRequest.call(this, 'DELETE', `/api/integrations/projects/${id}`);
                        returnData.push({ json: { success: true, id } });
                    }
                } else if (resource === 'workGroupType') {
                    const projectId = this.getNodeParameter('projectId', i) as string;
                    const res = await approxApiRequest.call(this, 'GET', `/api/integrations/projects/${projectId}/work-group-types`);
                    const { items: rows } = unwrapList(res);
                    returnData.push(...rows.map((json) => ({ json })));
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
                        const body = {
                            name: this.getNodeParameter('name', i) as string,
                            propertyTypeId: this.getNodeParameter('propertyTypeId', i) as string,
                            parentPropertyId: (this.getNodeParameter('parentPropertyId', i, '') as string) || null,
                        };
                        const res = await approxApiRequest.call(this, 'POST', base, body);
                        returnData.push({ json: res });
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

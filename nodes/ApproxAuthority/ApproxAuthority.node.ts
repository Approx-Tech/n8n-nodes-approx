import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

import { approxApiRequest, unwrapList } from '../../utils/GenericFunctions';

export class ApproxAuthority implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Approx Authority',
        name: 'approxAuthority',
        icon: 'file:approx.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Manage Approx pricing authorities (kurumlar).',
        defaults: { name: 'Approx Authority' },
        inputs: ['main'] as any,
        outputs: ['main'] as any,
        credentials: [{ name: 'approxApi', required: true }],
        properties: [
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
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

            // ID-based operations
            {
                displayName: 'Authority ID',
                name: 'authorityId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { operation: ['get', 'delete', 'updateName', 'updateLogo'] } },
                description: 'The ID of the authority',
            },

            // Create
            {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { operation: ['create'] } },
                description: 'Authority display name (minimum 3 characters)',
            },
            {
                displayName: 'Base64 Logo',
                name: 'base64Logo',
                type: 'string',
                default: '',
                displayOptions: { show: { operation: ['create'] } },
                description: 'Optional Base64-encoded logo image',
            },

            // Update Name
            {
                displayName: 'Name',
                name: 'name',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { operation: ['updateName'] } },
                description: 'New authority name (minimum 3 characters)',
            },

            // Update Logo
            {
                displayName: 'Base64 Logo',
                name: 'base64Logo',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { operation: ['updateLogo'] } },
                description: 'Base64-encoded logo image',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const operation = this.getNodeParameter('operation', i) as string;

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

import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

import { approxApiRequest, unwrapList } from '../../utils/GenericFunctions';

export class ApproxTemplate implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Approx Template',
        name: 'approxTemplate',
        icon: 'file:approx.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: 'Query Approx takeoff templates, report templates, and property types.',
        defaults: { name: 'Approx Template' },
        inputs: ['main'] as any,
        outputs: ['main'] as any,
        credentials: [{ name: 'approxApi', required: true }],
        properties: [
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                default: 'takeoffTemplate',
                options: [
                    { name: 'Property Type', value: 'propertyType', description: 'Property-type tree exposed by a takeoff template or project' },
                    { name: 'Report Template', value: 'reportTemplate', description: 'Report templates belonging to a takeoff template' },
                    { name: 'Takeoff Template', value: 'takeoffTemplate', description: 'Takeoff (metraj) templates' },
                ],
            },

            // ---------- Takeoff Template ----------
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

            },

            // ---------- Report Template ----------
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

            // ---------- Property Type ----------
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['propertyType'] } },
                default: 'getByTakeoffTemplate',
                options: [
                    { name: 'Get By Takeoff Template', value: 'getByTakeoffTemplate', action: 'Get property types by takeoff template', description: 'Get the root property type (with descendants) defined on a takeoff template' },
                    { name: 'Get By Project', value: 'getByProject', action: 'Get property types by project', description: 'Get the root property type (with descendants) for a project' },
                ],
            },
            {
                displayName: 'Takeoff Template ID',
                name: 'takeoffTemplateId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['propertyType'], operation: ['getByTakeoffTemplate'] } },

            },
            {
                displayName: 'Project ID',
                name: 'projectId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { resource: ['propertyType'], operation: ['getByProject'] } },

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

                if (resource === 'takeoffTemplate' && operation === 'getMany') {
                    const culture = this.getNodeParameter('culture', i) as string;
                    const res = await approxApiRequest.call(this, 'GET', '/api/integrations/templates/takeoff', undefined, { culture });
                    const { items: rows } = unwrapList(res);
                    returnData.push(...rows.map((json) => ({ json })));
                } else if (resource === 'takeoffTemplate' && operation === 'get') {
                    const id = this.getNodeParameter('takeoffTemplateId', i) as string;
                    const res = await approxApiRequest.call(this, 'GET', `/api/integrations/templates/takeoff/${id}`);
                    returnData.push({ json: res });
                } else if (resource === 'reportTemplate' && operation === 'getMany') {
                    const id = this.getNodeParameter('takeoffTemplateId', i) as string;
                    const res = await approxApiRequest.call(this, 'GET', `/api/integrations/templates/takeoff/${id}/report-templates`);
                    const { items: rows } = unwrapList(res);
                    returnData.push(...rows.map((json) => ({ json })));
                } else if (resource === 'propertyType' && operation === 'getByTakeoffTemplate') {
                    const id = this.getNodeParameter('takeoffTemplateId', i) as string;
                    const res = await approxApiRequest.call(this, 'GET', `/api/integrations/templates/takeoff/${id}/property-types`);
                    returnData.push({ json: res });
                } else if (resource === 'propertyType' && operation === 'getByProject') {
                    const id = this.getNodeParameter('projectId', i) as string;
                    const res = await approxApiRequest.call(this, 'GET', `/api/integrations/templates/projects/${id}/property-types`);
                    returnData.push({ json: res });
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

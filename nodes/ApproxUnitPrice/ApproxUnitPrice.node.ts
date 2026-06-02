import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

import { approxApiRequest, buildDqbQuery, unwrapList } from '../../utils/GenericFunctions';

export class ApproxUnitPrice implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Approx Unit Price',
        name: 'approxUnitPrice',
        icon: 'file:approx.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: 'Query Approx pricing libraries and unit prices.',
        defaults: { name: 'Approx Unit Price' },
        inputs: ['main'] as any,
        outputs: ['main'] as any,
        credentials: [{ name: 'approxApi', required: true }],
        properties: [
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                default: 'library',
                options: [
                    { name: 'Library', value: 'library', description: 'Pricing library' },
                    { name: 'Pricing', value: 'pricing', description: 'Unit prices inside a library' },
                ],
            },
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: { show: { resource: ['library'] } },
                default: 'getMany',
                options: [
                    { name: 'Get Many', value: 'getMany', action: 'Get many pricing libraries', description: 'List pricing libraries available to the tenant' },
                ],
            },
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
                displayName: 'Query Options',
                name: 'queryOptions',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                options: [
                    { displayName: 'Order By', name: 'orderBy', type: 'string', default: '', placeholder: 'name asc', description: 'DQB order-by expression' },
                    { displayName: 'Skip', name: 'skip', type: 'number', default: 0 },
                    { displayName: 'Take', name: 'take', type: 'number', default: 50, description: 'Items per page (max 200)' },
                    { displayName: 'Valid From', name: 'validFrom', type: 'dateTime', default: '', description: 'Filter pricings by valid-from date (pricing resource only)' },
                    { displayName: 'Valid To', name: 'validTo', type: 'dateTime', default: '', description: 'Filter pricings by valid-to date (pricing resource only)' },
                    { displayName: 'Where', name: 'where', type: 'string', default: '', placeholder: 'name|Contains|foo', description: 'DQB where expression' },
                ],
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const resource = this.getNodeParameter('resource', i) as string;
                const options = this.getNodeParameter('queryOptions', i, {}) as any;
                const qs = buildDqbQuery(options);

                let endpoint: string;
                if (resource === 'library') {
                    endpoint = '/api/integrations/pricing/libraries';
                } else {
                    const libraryId = this.getNodeParameter('libraryId', i) as string;
                    endpoint = `/api/integrations/pricing/libraries/${libraryId}/pricings`;
                    if (options.validFrom) qs.validFrom = options.validFrom;
                    if (options.validTo) qs.validTo = options.validTo;
                }

                const res = await approxApiRequest.call(this, 'GET', endpoint, undefined, qs);
                const { items: rows } = unwrapList(res);
                returnData.push(...rows.map((json) => ({ json })));
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

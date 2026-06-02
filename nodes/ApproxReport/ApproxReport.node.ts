import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

import { approxApiRequest } from '../../utils/GenericFunctions';

export class ApproxReport implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Approx Report',
        name: 'approxReport',
        icon: 'file:approx.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Generate, poll, and download Approx project reports.',
        defaults: { name: 'Approx Report' },
        inputs: ['main'] as any,
        outputs: ['main'] as any,
        credentials: [{ name: 'approxApi', required: true }],
        properties: [
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
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
                displayOptions: { show: { operation: ['create'] } },
                description: 'Project ID to generate the report for',
            },
            {
                displayName: 'Report ID',
                name: 'reportId',
                type: 'string',
                required: true,
                default: '',
                displayOptions: { show: { operation: ['get', 'download'] } },

            },
            {
                displayName: 'Put Output File in Field',
                name: 'binaryPropertyName',
                type: 'string',
                required: true,
                default: 'data',
                displayOptions: { show: { operation: ['download'] } },
                description: 'Name of the binary property to write the downloaded report ZIP to',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const operation = this.getNodeParameter('operation', i) as string;

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

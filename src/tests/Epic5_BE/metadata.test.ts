import { describe, it, expect } from 'vitest';
import { GET as nodeInfoGET } from '../../routes/api/nodeinfo/2.0/+server';
import { GET as wellKnownGET } from '../../routes/.well-known/nodeinfo/+server';

describe('Epic 5.4: Server Metadata (NodeInfo)', () => {

    it('should return a link to NodeInfo 2.0 in .well-known', async () => {
        const event = {
            url: new URL('http://localhost/.well-known/nodeinfo')
        } as any;

        const response = await wellKnownGET(event);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.links[0].rel).toBe('http://nodeinfo.diaspora.software/ns/schema/2.0');
    });

    it('should return valid NodeInfo 2.0 stats', async () => {
        const event = {} as any;

        const response = await nodeInfoGET(event);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.version).toBe('2.0');
        expect(data.software.name).toBe('polyverse');
        expect(data.usage.users).toBeDefined();
    });
});

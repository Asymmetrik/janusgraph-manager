import { WaitForIndexBuilder } from './WaitForIndexBuilder';

describe('WaitForIndexBuilder', () => {
    it('should build a wait string based on name and default graph', () => {
        const wfib = new WaitForIndexBuilder('testindex');
        expect(wfib.build()).toEqual(
            `ManagementSystem.awaitGraphIndexStatus(graph, 'testindex').status(SchemaStatus.ENABLED, SchemaStatus.REGISTERED).call().toString()`
        );
    });

    it('should build a wait string based on name and custom graph', () => {
        const wfib = new WaitForIndexBuilder('testindex', 'testgraph');
        expect(wfib.build()).toEqual(
            `ManagementSystem.awaitGraphIndexStatus(testgraph, 'testindex').status(SchemaStatus.ENABLED, SchemaStatus.REGISTERED).call().toString()`
        );
    });
});

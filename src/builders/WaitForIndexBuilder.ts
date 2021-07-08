import { Builder } from './Builder.interface';

/**
 * Builds a string that instructs the management system to wait for an index to become available.
 */
export class WaitForIndexBuilder implements Builder<string> {
    /**
     * Default constructor.
     * @param name Name of the index to wait for.
     * @param graph Name of the graph to use. Default is `graph`
     */
    constructor(private name: string, private graph: string = 'graph') {}

    build(): string {
        return `ManagementSystem.awaitGraphIndexStatus(${this.graph}, '${this.name}').status(SchemaStatus.ENABLED, SchemaStatus.REGISTERED).call().toString()`;
    }
}

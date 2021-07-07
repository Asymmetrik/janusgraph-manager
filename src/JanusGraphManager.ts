import { driver } from 'gremlin';
import { GraphSchema } from './types/GraphSchema';
import {
    EdgeBuilder,
    EnableIndexBuilder,
    GraphIndexBuilder,
    PropertyBuilder,
    VertexBuilder,
    VertexCentricIndexBuilder,
    WaitForIndexBuilder,
} from './builders';
import { GraphIndex, VertexCentricIndex } from './types';

type ManagerState = 'NEW' | 'READY' | 'COMMIT' | 'ERROR' | 'CLOSED';

export type JanusGraphMangerOptions = {
    /**
     * Name of the graph to traverse.
     */
    graphName?: string;
    /**
     * Whether or not to use the ConfiguredGraphFactory for dynamic graphs.
     */
    useConfiguredGraphFactory?: boolean;
    /**
     * Path to a JanusGraphFactory configuration on the remote, for use with JanusGraphFactory.
     */
    configPath?: string;
};

export class JanusGraphManager {
    private state: ManagerState = 'NEW';

    private OPEN_MGMT = `mgmt = ${this.options.graphName}.openManagement();0;`;

    /**
     * Default constructor.
     * @param client A preconfigured gremlin client for accessing gremlin-server.
     * @param options JanusGraphOptions for accessing the graph:
     * - graphName will have a default of `'graph'`.
     * - useConfiguredGraphFactory will have a default of `false`
     * - configPath has no default.
     */
    constructor(
        private client: driver.Client,
        private options: JanusGraphMangerOptions
    ) {
        if (options.graphName == null) {
            this.options.graphName = 'graph';
        }
        if (options.useConfiguredGraphFactory == null) {
            this.options.useConfiguredGraphFactory = false;
        }
    }

    /**
     * Opens the management system for the client session.
     * Will be called internally to re-open the management system if a commit or error closes it.
     * @returns A promise with the state of the manager.
     */
    private async init(): Promise<ManagerState> {
        try {
            if (this.state !== 'READY') {
                // Ensure that there are no open transactions while we are managing the graph.
                await this.client.submit(
                    `${this.options.graphName}.tx().rollback();`
                );
                if (this.options.useConfiguredGraphFactory) {
                    // The ";0;" prevents the client from attempting to serialize the graph/management system.
                    await this.client.submit(
                        `${this.options.graphName} = ConfiguredGraphFactory.open('${this.options.graphName}');0;`
                    );
                } else if (this.options.configPath != null) {
                    await this.client.submit(
                        `${this.options.graphName} = JanusGraphFactory.open('${this.options.configPath}');0;`
                    );
                }
                await this.client.submit(this.OPEN_MGMT);
                this.state = 'READY';
            }
            return Promise.resolve(this.state);
        } catch (err) {
            this.state = 'ERROR';
            return Promise.reject(err);
        }
    }

    /**
     * Builds and persists a single graph index.
     * Currently, if an index with the same name is already created, this will *not* recreate the index.
     * @param index GraphIndex to create.
     * @param commit Whether or not to commit the changes.
     * @returns
     */
    async createGraphIndex(index: GraphIndex, commit = false): Promise<number> {
        await this.init();
        const builder = new GraphIndexBuilder(
            index.name,
            index.element ?? 'Vertex'
        );
        builder
            .label(index.label)
            .type(index.type)
            .unique(index.unique)
            .backend(index.backend);
        index.keys.forEach((k) => builder.key(k));
        try {
            await this.client.submit(builder.build());
            if (commit) await this.commit();
            return Promise.resolve(1);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    /**
     * Builds and persists a single VertexCentric index.
     * Currently, if an index with the same name is already created, this will *not* recreate the index.
     * @param index VertexCentricIndex to create.
     * @param commit Whether or not to commit the changes.
     * @returns
     */
    async createVertexCentricIndex(
        index: VertexCentricIndex,
        commit = false
    ): Promise<number> {
        const builder = new VertexCentricIndexBuilder(index.name);
        builder
            .direction(index.direction)
            .edgelabel(index.edgelabel)
            .order(index.order);
        index.keys.forEach((k) => builder.key(k));
        try {
            await this.init();
            await this.client.submit(builder.build());
            if (commit) await this.commit();
            return Promise.resolve(1);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    /**
     * Will pause execution until the management system reports that all indices on a graph have reached the REGISTERED state.
     * @param schema GraphSchema to process.
     * @param graph Name of the traversal alias to analyze. Default: `graph`
     * @returns A promise with the number of indices that reached REGISTERED state.
     */
    async waitForIndices(schema: GraphSchema, graph?: string): Promise<number> {
        try {
            await this.init();
            return (
                await Promise.all(
                    [...schema.graphIndices, ...schema.vcIndices].map((i) =>
                        this.waitForIndex(i, graph)
                    )
                )
            ).length;
        } catch (err) {
            return Promise.reject(err);
        }
    }

    /**
     * Will pause execution until the management system reports that a single index on a graph has reached the REGISTERED state.
     * @param index Index to process.
     * @param graph Name of the traversal alias to analyze. Default: `graph`
     * @returns A promise of 1, indicating that 1 index has reached REGISTERED state.
     */
    async waitForIndex(
        index: GraphIndex | VertexCentricIndex,
        graph?: string
    ): Promise<number> {
        const builder = new WaitForIndexBuilder(index.name, graph);
        try {
            await this.init();
            await this.client.submit(builder.build());
            return Promise.resolve(1);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    /**
     * Will build only the indices from a graph schema.
     * @param schema - GraphSchema to get index definitions from.
     * @param commit - Whether or not to commit and close the traversal. Default: `false`
     * @returns A promise containing the number of successful traversals made.
     */
    async createIndices(schema: GraphSchema, commit = false): Promise<number> {
        try {
            await this.init();
            let count = 0;
            // Generate graph indices.
            count += (
                await Promise.all(
                    schema.graphIndices.map((i) => this.createGraphIndex(i))
                )
            ).length;
            // Generate vc indices.
            count += (
                await Promise.all(
                    schema.vcIndices.map((i) =>
                        this.createVertexCentricIndex(i)
                    )
                )
            ).length;
            if (commit) {
                await this.commit();
            }
            return Promise.resolve(count);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    /**
     * Attempts to enable indices.
     * @param schema - GraphSchema to enable indicies for.
     * @param commit - Whether or not to commit and close the traversal. Default: `false`
     * @returns A promise containing the number of successful traversals made.
     */
    async enableIndices(schema: GraphSchema, commit = false): Promise<number> {
        try {
            await this.init();
            const gi = schema.graphIndices.map((i) => {
                const builder = new EnableIndexBuilder(i.name, schema.name);
                return builder.action('REINDEX').build();
            });
            const vci = schema.vcIndices.map((i) => {
                const builder = new EnableIndexBuilder(i.name, schema.name);
                return builder
                    .type('VertexCentric')
                    .label(i.edgelabel)
                    .action('REINDEX')
                    .build();
            });
            const count = (
                await Promise.all(
                    [...gi, ...vci].map(
                        async (msg) => await this.client.submit(msg)
                    )
                )
            ).length;
            if (commit) {
                await this.commit();
            }
            return Promise.resolve(count);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    /**
     * Creates all the schema definitions.
     * @param schema - GraphSchema to get schema definitions from.
     * @param indices - If set `true`, will build indices as well. Default `false`.
     * @returns A promise containing the number of successful traversals made.
     */
    async createSchema(schema: GraphSchema, indices = false): Promise<number> {
        try {
            await this.init();
            let count = 0;
            // Extract/Build our properties definitions.
            count += (
                await Promise.all(
                    [...schema.vertices, ...schema.edges]
                        .flatMap((v) => v.properties)
                        .map((p) => {
                            const builder = new PropertyBuilder(p.key);
                            return builder
                                .datatype(p.datatype)
                                .cardinality(p.cardinality)
                                .build();
                        })
                        .map(async (msg) => await this.client.submit(msg))
                )
            ).length;
            // Create labels and associate properties for vertices.
            count += (
                await Promise.all(
                    schema.vertices
                        .map((v) => {
                            const builder = new VertexBuilder(v.label);
                            v.properties.forEach((p) => builder.property(p));
                            return builder.build();
                        })
                        .map(async (msg) => await this.client.submit(msg))
                )
            ).length;
            // Create labels and associate properties for edges.
            count += (
                await Promise.all(
                    schema.edges
                        .map((e) => {
                            const builder = new EdgeBuilder(e.label);
                            e.properties.forEach((p) => builder.property(p));
                            return builder.build();
                        })
                        .map(async (msg) => await this.client.submit(msg))
                )
            ).length;
            if (indices) {
                await this.commit();
                count += await this.createIndices(schema, true);
            }
            return Promise.resolve(count);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    /**
     * Retrieves all of the graph indices for the current graph.
     * @returns A promise containing a list of all the indices.
     */
    async getIndices(): Promise<unknown[]> {
        try {
            await this.init();
            const data = await this.client.submit(
                'mgmt.getGraphIndexes(Vertex.class)'
            );
            return Promise.resolve(data._items);
        } catch (err) {
            return Promise.reject(err);
        }
    }

    /**
     * Leverages the gremlin client to commit a management message.
     * @param message Message to send prior to the commit. Not required.
     * @returns A promise from client commit submission.
     */
    async commit(message?: string): Promise<unknown> {
        try {
            await this.init();
            const commit = await this.client.submit(
                `${message ?? ''};mgmt.commit();`
            );
            this.state = 'COMMIT';
            return commit;
        } catch (err) {
            this.state = 'ERROR';
            return Promise.reject(err);
        }
    }

    /**
     * Attempts to close the gremlin client.
     * @returns A promise with close status-- defers to {@see driver.Client.prototype.close()}
     */
    async close(): Promise<void> {
        try {
            if (['CLOSED', 'ERROR'].some((s) => s === this.state)) return;
            const close = await this.client.close();
            this.state = 'CLOSED';
            return close;
        } catch (err) {
            this.state = 'ERROR';
            return Promise.reject(err);
        }
    }
}

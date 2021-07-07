import { IndexKey } from '../types/GraphIndex';
import { GraphIndexBuilder } from './GraphIndexBuilder';

describe('GraphIndexBuilder', () => {
    it('should be instantiated with a name and key', () => {
        const gib = new GraphIndexBuilder('test', 'Vertex');
        const key = {
            field: 'testfield',
            mapping: 'STRING',
        } as IndexKey;
        const out = gib.key(key).build();
        // Conditional build
        expect(out).toContain(`if (!mgmt.containsGraphIndex('test'))`);
        expect(out).toContain(
            `mgmt.buildIndex('test', Vertex.class).addKey(mgmt.getPropertyKey('testfield')).buildCompositeIndex();`
        );
    });

    it('should be instantiated with a name, key, and element class', () => {
        const gib = new GraphIndexBuilder('test', 'Edge');
        const key = {
            field: 'testfield',
            mapping: 'STRING',
        } as IndexKey;
        const out = gib.key(key).build();
        // Conditional build
        expect(out).toContain(`if (!mgmt.containsGraphIndex('test'))`);
        expect(out).toContain(
            `mgmt.buildIndex('test', Edge.class).addKey(mgmt.getPropertyKey('testfield')).buildCompositeIndex();`
        );
    });

    it('should be instantiated with a name and multiple keys', () => {
        const gib = new GraphIndexBuilder('test', 'Vertex');
        const [key1, key2] = [
            {
                field: 'testfield1',
                mapping: 'STRING',
            } as IndexKey,
            {
                field: 'testfield2',
                mapping: 'STRING',
            } as IndexKey,
        ];
        const out = gib.key(key1).key(key2).build();
        expect(out).toContain(`.addKey(mgmt.getPropertyKey('testfield1'))`);
        expect(out).toContain(`.addKey(mgmt.getPropertyKey('testfield2'))`);
    });

    it('should set unique', () => {
        const gib = new GraphIndexBuilder('test', 'Vertex');
        const key = {
            field: 'testfield',
            mapping: 'STRING',
        } as IndexKey;
        const out = gib.key(key).unique(true).build();
        expect(out).toContain(`.unique()`);
    });

    it('should set a label', () => {
        const gib = new GraphIndexBuilder('test', 'Vertex');
        const key = {
            field: 'testfield',
            mapping: 'STRING',
        } as IndexKey;
        const out = gib.key(key).label('testlabel').build();
        expect(out).toContain(`.indexOnly(mgmt.getVertexLabel('testlabel'))`);
    });

    it('should build a mixed index', () => {
        const gib = new GraphIndexBuilder('test', 'Vertex');
        const key = {
            field: 'testfield',
            mapping: 'STRING',
        } as IndexKey;
        const out = gib.key(key).type('Mixed').build();
        expect(out).toContain(
            `.addKey(mgmt.getPropertyKey('testfield'),Mapping.STRING.asParameter())`
        );
        expect(out).toContain(`.buildMixedIndex('search');`);
    });

    it('should build a mixed index with no mapping key', () => {
        const gib = new GraphIndexBuilder('test', 'Vertex');
        const key = {
            field: 'testfield',
        } as IndexKey;
        const out = gib.key(key).type('Mixed').build();
        expect(out).toContain(`.addKey(mgmt.getPropertyKey('testfield'))`);
        expect(out).toContain(`.buildMixedIndex('search');`);
    });

    it('should build a mixed index with custom backend', () => {
        const gib = new GraphIndexBuilder('test', 'Vertex');
        const key = {
            field: 'testfield',
            mapping: 'STRING',
        } as IndexKey;
        const out = gib.key(key).type('Mixed').backend('testbackend').build();
        expect(out).toContain(
            `.addKey(mgmt.getPropertyKey('testfield'),Mapping.STRING.asParameter())`
        );
        expect(out).toContain(`.buildMixedIndex('testbackend');`);
    });

    it('should ignore duplicate keys', () => {
        const gib = new GraphIndexBuilder('test', 'Vertex');
        const key = {
            field: 'testfield',
            mapping: 'STRING',
        } as IndexKey;
        const out = gib
            .key(key)
            .key({ ...key })
            .build();
        expect(out).toContain(
            `mgmt.buildIndex('test', Vertex.class).addKey(mgmt.getPropertyKey('testfield')).buildCompositeIndex();`
        );
    });
});

export type GraphIndex = {
    name: string;
    element: ElementClass;
    keys: IndexKey[];
    type: CompositeOrMixedIndexType;
    unique?: boolean;
    label?: string;
    backend?: string;
};

export type IndexKey = {
    field: string;
    mapping?: IndexKeyMapping;
};

export type IndexKeyMapping = 'STRING' | 'TEXT' | 'TEXTSTRING' | 'PREFIX_TREE';

export type CompositeOrMixedIndexType = 'Composite' | 'Mixed';
export type VertexCentricIndexType = 'VertexCentric';

export type IndexType = CompositeOrMixedIndexType | VertexCentricIndexType;

export type ElementClass = 'Vertex' | 'Edge';

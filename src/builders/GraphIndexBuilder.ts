import { Builder } from './Builder.interface';
import {
    CompositeOrMixedIndexType,
    ElementClass,
    IndexKey,
} from '../types/GraphIndex';

/**
 * Index Builder for Composite or Mixed indices.
 *
 * For VertexCentric indicies, please use {@link VertexCentricIndexBuilder}
 */
export class GraphIndexBuilder implements Builder<string> {
    private _type?: CompositeOrMixedIndexType;
    private _keys: IndexKey[] = [];
    private _unique?: boolean;
    private _label?: string;
    private _backend?: string;

    constructor(private _name: string, private _element: ElementClass) {}

    type(type: CompositeOrMixedIndexType): this {
        this._type = type;
        return this;
    }

    key(key: IndexKey): this {
        if (this._keys.some((k) => k.field === key.field)) return this;
        this._keys.push(key);
        return this;
    }

    unique(unique = false): this {
        this._unique = unique;
        return this;
    }

    label(label?: string): this {
        this._label = label;
        return this;
    }

    backend(backend?: string): this {
        this._backend = backend;
        return this;
    }

    build(): string {
        if (this._keys.length === 0) {
            throw Error(
                `Unable to generate index ${this._name} with no key definitions.`
            );
        }
        if (this._type !== 'Mixed' && this._backend != null) {
            console.warn(
                'Composite index type and non-null backend. Will ignore backend.'
            );
        }
        let output = `if (!mgmt.containsGraphIndex('${this._name}')) `;
        output += `mgmt.buildIndex('${this._name}', ${this._element}.class)`;
        output += [...this._keys]
            .map(
                (key) =>
                    `.addKey(mgmt.getPropertyKey('${key.field}')${
                        this._type === 'Mixed' && key.mapping != null
                            ? `,Mapping.${key.mapping}.asParameter()`
                            : ''
                    })`
            )
            .join('');
        output += this._unique ? `.unique()` : '';
        output +=
            this._label != null
                ? `.indexOnly(mgmt.getVertexLabel('${this._label}'))`
                : '';
        return output.concat(
            this._type === 'Mixed'
                ? `.buildMixedIndex('${this._backend ?? 'search'}');`
                : '.buildCompositeIndex();'
        );
    }
}

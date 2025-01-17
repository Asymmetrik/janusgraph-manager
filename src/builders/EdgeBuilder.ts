import { Builder } from './Builder.interface';
import { EdgeMultiplicity } from '../types/Edge';
import { Property } from '../types/Property';

export class EdgeBuilder implements Builder<string> {
    private _multiplicity: EdgeMultiplicity = 'MULTI';
    private _properties: Property[] = [];

    constructor(private _label: string) {}

    multiplicity(multiplicity: EdgeMultiplicity): this {
        this._multiplicity = multiplicity;
        return this;
    }

    property(property: Property): this {
        if (this._properties.some((p) => p.key === property.key)) return this;
        this._properties.push(property);
        return this;
    }

    build(): string {
        let output = `if (!mgmt.containsEdgeLabel('${this._label}')) `;
        output += `mgmt.makeEdgeLabel('${this._label}')`;
        output +=
            this._multiplicity != null
                ? `.multiplicity(${this._multiplicity})`
                : '';
        output += '.make();';
        if (this._properties.length > 0) {
            output += 'mgmt.addProperties(';
            output += `mgmt.getEdgeLabel('${this._label}'), `;
            output += [...this._properties]
                .map((prop) => `mgmt.getPropertyKey('${prop.key}')`)
                .join(', ');
            output += ')';
        }
        return output;
    }
}

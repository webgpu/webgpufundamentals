/* webgpu-utils@0.4.1, license MIT */
const roundUpToMultipleOf = (v, multiple) => (((v + multiple - 1) / multiple) | 0) * multiple;
// TODO: fix better?
const isTypedArray = (arr) => arr && typeof arr.length === 'number' && arr.buffer instanceof ArrayBuffer && typeof arr.byteLength === 'number';

class TypedArrayViewGenerator {
    arrayBuffer;
    byteOffset;
    constructor(sizeInBytes) {
        this.arrayBuffer = new ArrayBuffer(sizeInBytes);
        this.byteOffset = 0;
    }
    align(alignment) {
        this.byteOffset = roundUpToMultipleOf(this.byteOffset, alignment);
    }
    pad(numBytes) {
        this.byteOffset += numBytes;
    }
    getView(Ctor, numElements) {
        const view = new Ctor(this.arrayBuffer, this.byteOffset, numElements);
        this.byteOffset += view.byteLength;
        return view;
    }
}
const b = {
    i32: { numElements: 1, align: 4, size: 4, type: 'i32', View: Int32Array },
    u32: { numElements: 1, align: 4, size: 4, type: 'u32', View: Uint32Array },
    f32: { numElements: 1, align: 4, size: 4, type: 'f32', View: Float32Array },
    f16: { numElements: 1, align: 2, size: 2, type: 'u16', View: Uint16Array },
    vec2f: { numElements: 2, align: 8, size: 8, type: 'f32', View: Float32Array },
    vec2i: { numElements: 2, align: 8, size: 8, type: 'i32', View: Int32Array },
    vec2u: { numElements: 2, align: 8, size: 8, type: 'u32', View: Uint32Array },
    vec2h: { numElements: 2, align: 4, size: 4, type: 'u16', View: Uint16Array },
    vec3i: { numElements: 3, align: 16, size: 12, type: 'i32', View: Int32Array },
    vec3u: { numElements: 3, align: 16, size: 12, type: 'u32', View: Uint32Array },
    vec3f: { numElements: 3, align: 16, size: 12, type: 'f32', View: Float32Array },
    vec3h: { numElements: 3, align: 8, size: 6, type: 'u16', View: Uint16Array },
    vec4i: { numElements: 4, align: 16, size: 16, type: 'i32', View: Int32Array },
    vec4u: { numElements: 4, align: 16, size: 16, type: 'u32', View: Uint32Array },
    vec4f: { numElements: 4, align: 16, size: 16, type: 'f32', View: Float32Array },
    vec4h: { numElements: 4, align: 8, size: 8, type: 'u16', View: Uint16Array },
    // AlignOf(vecR)	SizeOf(array<vecR, C>)
    mat2x2f: { numElements: 4, align: 8, size: 16, type: 'f32', View: Float32Array },
    mat2x2h: { numElements: 4, align: 4, size: 8, type: 'u16', View: Uint16Array },
    mat3x2f: { numElements: 6, align: 8, size: 24, type: 'f32', View: Float32Array },
    mat3x2h: { numElements: 6, align: 4, size: 12, type: 'u16', View: Uint16Array },
    mat4x2f: { numElements: 8, align: 8, size: 32, type: 'f32', View: Float32Array },
    mat4x2h: { numElements: 8, align: 4, size: 16, type: 'u16', View: Uint16Array },
    mat2x3f: { numElements: 8, align: 16, size: 32, pad: [3, 1], type: 'f32', View: Float32Array },
    mat2x3h: { numElements: 8, align: 8, size: 16, pad: [3, 1], type: 'u16', View: Uint16Array },
    mat3x3f: { numElements: 12, align: 16, size: 48, pad: [3, 1], type: 'f32', View: Float32Array },
    mat3x3h: { numElements: 12, align: 8, size: 24, pad: [3, 1], type: 'u16', View: Uint16Array },
    mat4x3f: { numElements: 16, align: 16, size: 64, pad: [3, 1], type: 'f32', View: Float32Array },
    mat4x3h: { numElements: 16, align: 8, size: 32, pad: [3, 1], type: 'u16', View: Uint16Array },
    mat2x4f: { numElements: 8, align: 16, size: 32, type: 'f32', View: Float32Array },
    mat2x4h: { numElements: 8, align: 8, size: 16, type: 'u16', View: Uint16Array },
    mat3x4f: { numElements: 12, align: 16, size: 48, pad: [3, 1], type: 'f32', View: Float32Array },
    mat3x4h: { numElements: 12, align: 8, size: 24, pad: [3, 1], type: 'u16', View: Uint16Array },
    mat4x4f: { numElements: 16, align: 16, size: 64, type: 'f32', View: Float32Array },
    mat4x4h: { numElements: 16, align: 8, size: 32, type: 'u16', View: Uint16Array },
};
const typeInfo = {
    ...b,
    'vec2<i32>': b.vec2f,
    'vec2<u32>': b.vec2i,
    'vec2<f32>': b.vec2u,
    'vec2<f16>': b.vec2h,
    'vec3<i32>': b.vec3i,
    'vec3<u32>': b.vec3u,
    'vec3<f32>': b.vec3f,
    'vec3<f16>': b.vec3h,
    'vec4<i32>': b.vec4i,
    'vec4<u32>': b.vec4u,
    'vec4<f32>': b.vec4f,
    'vec4<f16>': b.vec4h,
    'mat2x2<f32>': b.mat2x2f,
    'mat2x2<f16>': b.mat2x2h,
    'mat3x2<f32>': b.mat3x2f,
    'mat3x2<f16>': b.mat3x2h,
    'mat4x2<f32>': b.mat4x2f,
    'mat4x2<f16>': b.mat4x2h,
    'mat2x3<f32>': b.mat2x3f,
    'mat2x3<f16>': b.mat2x3h,
    'mat3x3<f32>': b.mat3x3f,
    'mat3x3<f16>': b.mat3x3h,
    'mat4x3<f32>': b.mat4x3f,
    'mat4x3<f16>': b.mat4x3h,
    'mat2x4<f32>': b.mat2x4f,
    'mat2x4<f16>': b.mat2x4h,
    'mat3x4<f32>': b.mat3x4f,
    'mat3x4<f16>': b.mat3x4h,
    'mat4x4<f32>': b.mat4x4f,
    'mat4x4<f16>': b.mat4x4h,
};
// This needs to be fixed! 😱
function getSizeOfStructDef(fieldDef) {
    if (Array.isArray(fieldDef)) {
        return fieldDef.length * getSizeOfStructDef(fieldDef[0]);
    }
    else {
        return fieldDef.size;
    }
}
/**
 * Creates a set of named TypedArray views on an ArrayBuffer
 * @param structDef Definition of the various types of views.
 * @param arrayBuffer Optional ArrayBuffer to use (if one provided one will be created)
 * @param offset Optional offset in existing ArrayBuffer to start the views.
 * @returns A bunch of named TypedArray views and the ArrayBuffer
 */
function makeTypedArrayViews(structDef, arrayBuffer, offset) {
    const baseOffset = offset || 0;
    const buffer = arrayBuffer || new ArrayBuffer(getSizeOfStructDef(structDef));
    const makeViews = (structDef) => {
        if (Array.isArray(structDef)) {
            return structDef.map(elemDef => makeViews(elemDef));
        }
        else if (typeof structDef === 'string') {
            throw Error('unreachable');
        }
        else {
            const fields = structDef.fields;
            if (fields) {
                const views = {};
                for (const [name, def] of Object.entries(fields)) {
                    views[name] = makeViews(def);
                }
                return views;
            }
            else {
                const { size, offset, type } = structDef;
                try {
                    const { View } = typeInfo[type];
                    const numElements = size / View.BYTES_PER_ELEMENT;
                    return new View(buffer, baseOffset + offset, numElements);
                }
                catch {
                    throw new Error(`unknown type: ${type}`);
                }
            }
        }
    };
    return { views: makeViews(structDef), arrayBuffer: buffer };
}
/**
 * Given a set of TypeArrayViews and matching JavaScript data
 * sets the content of the views.
 * @param data The new values
 * @param views TypedArray views as returned from {@link makeTypedArrayViews}
 */
function setStructuredView(data, views) {
    if (data === undefined) {
        return;
    }
    else if (isTypedArray(views)) {
        const view = views;
        if (view.length === 1 && typeof data === 'number') {
            view[0] = data;
        }
        else {
            if (Array.isArray(data[0]) || isTypedArray(data[0])) {
                // complete hack!
                // there's no type data here so let's guess based on the user's data
                const dataLen = data[0].length;
                const stride = dataLen == 3 ? 4 : dataLen;
                for (let i = 0; i < data.length; ++i) {
                    const offset = i * stride;
                    view.set(data[i], offset);
                }
            }
            else {
                view.set(data);
            }
        }
    }
    else if (Array.isArray(views)) {
        const asArray = views;
        data.forEach((newValue, ndx) => {
            setStructuredView(newValue, asArray[ndx]);
        });
    }
    else {
        const asViews = views;
        for (const [key, newValue] of Object.entries(data)) {
            const view = asViews[key];
            if (view) {
                setStructuredView(newValue, view);
            }
        }
    }
}
/**
 * Given a StructDefinition, create matching TypedArray views
 * @param structDef A StructDefinition as returned from {@link makeShaderDataDefinitions}
 * @param arrayBuffer Optional ArrayBuffer for the views
 * @param offset Optional offset into the ArrayBuffer for the views
 * @returns TypedArray views for the various named fields of the structure as well
 *    as a `set` function to make them easy to set, and the arrayBuffer
 */
function makeStructuredView(structDef, arrayBuffer, offset = 0) {
    const views = makeTypedArrayViews(structDef, arrayBuffer, offset);
    return {
        ...views,
        set(data) {
            setStructuredView(data, views.views);
        },
    };
}
const s_views = new WeakMap();
function getViewsByCtor(arrayBuffer) {
    let viewsByCtor = s_views.get(arrayBuffer);
    if (!viewsByCtor) {
        viewsByCtor = new Map();
        s_views.set(arrayBuffer, viewsByCtor);
    }
    return viewsByCtor;
}
function getView(arrayBuffer, Ctor) {
    const viewsByCtor = getViewsByCtor(arrayBuffer);
    let view = viewsByCtor.get(Ctor);
    if (!view) {
        view = new Ctor(arrayBuffer);
        viewsByCtor.set(Ctor, view);
    }
    return view;
}
function setStructuredValues(fieldDef, data, arrayBuffer, offset = 0) {
    const asIntrinsicDefinition = fieldDef;
    if (asIntrinsicDefinition.type) {
        const type = typeInfo[asIntrinsicDefinition.type];
        const view = getView(arrayBuffer, type.View);
        const index = (offset + asIntrinsicDefinition.offset) / view.BYTES_PER_ELEMENT;
        if (typeof data === 'number') {
            view[index] = data;
        }
        else {
            view.set(data, index);
        }
    }
    else if (Array.isArray(fieldDef)) {
        // It's IntrinsicDefinition[] or StructDefinition[]
        data.forEach((newValue, ndx) => {
            setStructuredValues(fieldDef[ndx], newValue, arrayBuffer, offset);
        });
    }
    else {
        // It's StructDefinition
        const asStructDefinition = fieldDef;
        for (const [key, newValue] of Object.entries(data)) {
            const fieldDef = asStructDefinition.fields[key];
            if (fieldDef) {
                setStructuredValues(fieldDef, newValue, arrayBuffer, offset);
            }
        }
    }
}

class ParseContext {
    constructor() {
        this.constants = new Map();
        this.aliases = new Map();
        this.structs = new Map();
    }
}
/**
 * @class Node
 * @category AST
 * Base class for AST nodes parsed from a WGSL shader.
 */
class Node {
    constructor() { }
    get isAstNode() {
        return true;
    }
    get astNodeType() {
        return "";
    }
    evaluate(context) {
        throw new Error("Cannot evaluate node");
    }
    evaluateString(context) {
        return this.evaluate(context).toString();
    }
}
/**
 * @class Statement
 * @extends Node
 * @category AST
 */
class Statement extends Node {
    constructor() {
        super();
    }
}
/**
 * @class Function
 * @extends Statement
 * @category AST
 */
class Function extends Statement {
    constructor(name, args, returnType, body) {
        super();
        this.name = name;
        this.args = args;
        this.returnType = returnType;
        this.body = body;
    }
    get astNodeType() {
        return "function";
    }
}
/**
 * @class StaticAssert
 * @extends Statement
 * @category AST
 */
class StaticAssert extends Statement {
    constructor(expression) {
        super();
        this.expression = expression;
    }
    get astNodeType() {
        return "staticAssert";
    }
}
/**
 * @class While
 * @extends Statement
 * @category AST
 */
class While extends Statement {
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }
    get astNodeType() {
        return "while";
    }
}
/**
 * @class For
 * @extends Statement
 * @category AST
 */
class For extends Statement {
    constructor(init, condition, increment, body) {
        super();
        this.init = init;
        this.condition = condition;
        this.increment = increment;
        this.body = body;
    }
    get astNodeType() {
        return "for";
    }
}
/**
 * @class Var
 * @extends Statement
 * @category AST
 */
class Var extends Statement {
    constructor(name, type, storage, access, value) {
        super();
        this.name = name;
        this.type = type;
        this.storage = storage;
        this.access = access;
        this.value = value;
    }
    get astNodeType() {
        return "var";
    }
}
/**
 * @class Let
 * @extends Statement
 * @category AST
 */
class Let extends Statement {
    constructor(name, type, storage, access, value) {
        super();
        this.name = name;
        this.type = type;
        this.storage = storage;
        this.access = access;
        this.value = value;
    }
    get astNodeType() {
        return "let";
    }
}
/**
 * @class Const
 * @extends Statement
 * @category AST
 */
class Const extends Statement {
    constructor(name, type, storage, access, value) {
        super();
        this.name = name;
        this.type = type;
        this.storage = storage;
        this.access = access;
        this.value = value;
    }
    get astNodeType() {
        return "const";
    }
    evaluate(context) {
        return this.value.evaluate(context);
    }
}
var IncrementOperator;
(function (IncrementOperator) {
    IncrementOperator["increment"] = "++";
    IncrementOperator["decrement"] = "--";
})(IncrementOperator || (IncrementOperator = {}));
(function (IncrementOperator) {
    function parse(val) {
        const key = val;
        if (key == "parse")
            throw new Error("Invalid value for IncrementOperator");
        return IncrementOperator[key];
    }
    IncrementOperator.parse = parse;
})(IncrementOperator || (IncrementOperator = {}));
/**
 * @class Increment
 * @extends Statement
 * @category AST
 */
class Increment extends Statement {
    constructor(operator, variable) {
        super();
        this.operator = operator;
        this.variable = variable;
    }
    get astNodeType() {
        return "increment";
    }
}
var AssignOperator;
(function (AssignOperator) {
    AssignOperator["assign"] = "=";
    AssignOperator["addAssign"] = "+=";
    AssignOperator["subtractAssin"] = "-=";
    AssignOperator["multiplyAssign"] = "*=";
    AssignOperator["divideAssign"] = "/=";
    AssignOperator["moduloAssign"] = "%=";
    AssignOperator["andAssign"] = "&=";
    AssignOperator["orAssign"] = "|=";
    AssignOperator["xorAssign"] = "^=";
    AssignOperator["shiftLeftAssign"] = "<<=";
    AssignOperator["shiftRightAssign"] = ">>=";
})(AssignOperator || (AssignOperator = {}));
(function (AssignOperator) {
    function parse(val) {
        const key = val;
        if (key == "parse")
            throw new Error("Invalid value for AssignOperator");
        return AssignOperator[key];
    }
    AssignOperator.parse = parse;
})(AssignOperator || (AssignOperator = {}));
/**
 * @class Assign
 * @extends Statement
 * @category AST
 */
class Assign extends Statement {
    constructor(operator, variable, value) {
        super();
        this.operator = operator;
        this.variable = variable;
        this.value = value;
    }
    get astNodeType() {
        return "assign";
    }
}
/**
 * @class Call
 * @extends Statement
 * @category AST
 */
class Call extends Statement {
    constructor(name, args) {
        super();
        this.name = name;
        this.args = args;
    }
    get astNodeType() {
        return "call";
    }
}
/**
 * @class Loop
 * @extends Statement
 * @category AST
 */
class Loop extends Statement {
    constructor(body, continuing) {
        super();
        this.body = body;
        this.continuing = continuing;
    }
    get astNodeType() {
        return "loop";
    }
}
/**
 * @class Switch
 * @extends Statement
 * @category AST
 */
class Switch extends Statement {
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }
    get astNodeType() {
        return "body";
    }
}
/**
 * @class If
 * @extends Statement
 * @category AST
 */
class If extends Statement {
    constructor(condition, body, elseif, _else) {
        super();
        this.condition = condition;
        this.body = body;
        this.elseif = elseif;
        this.else = _else;
    }
    get astNodeType() {
        return "if";
    }
}
/**
 * @class Return
 * @extends Statement
 * @category AST
 */
class Return extends Statement {
    constructor(value) {
        super();
        this.value = value;
    }
    get astNodeType() {
        return "return";
    }
}
/**
 * @class Struct
 * @extends Statement
 * @category AST
 */
class Struct extends Statement {
    constructor(name, members) {
        super();
        this.name = name;
        this.members = members;
    }
    get astNodeType() {
        return "struct";
    }
    /// Return the index of the member with the given name, or -1 if not found.
    getMemberIndex(name) {
        for (let i = 0; i < this.members.length; i++) {
            if (this.members[i].name == name)
                return i;
        }
        return -1;
    }
}
/**
 * @class Enable
 * @extends Statement
 * @category AST
 */
class Enable extends Statement {
    constructor(name) {
        super();
        this.name = name;
    }
    get astNodeType() {
        return "enable";
    }
}
/**
 * @class Alias
 * @extends Statement
 * @category AST
 */
class Alias extends Statement {
    constructor(name, type) {
        super();
        this.name = name;
        this.type = type;
    }
    get astNodeType() {
        return "alias";
    }
}
/**
 * @class Discard
 * @extends Statement
 * @category AST
 */
class Discard extends Statement {
    constructor() {
        super();
    }
    get astNodeType() {
        return "discard";
    }
}
/**
 * @class Break
 * @extends Statement
 * @category AST
 */
class Break extends Statement {
    constructor() {
        super();
    }
    get astNodeType() {
        return "break";
    }
}
/**
 * @class Continue
 * @extends Statement
 * @category AST
 */
class Continue extends Statement {
    constructor() {
        super();
    }
    get astNodeType() {
        return "continue";
    }
}
/**
 * @class Type
 * @extends Node
 * @category AST
 */
class Type extends Node {
    constructor(name) {
        super();
        this.name = name;
    }
    get astNodeType() {
        return "type";
    }
}
/**
 * @class TemplateType
 * @extends Type
 * @category AST
 */
class TemplateType extends Type {
    constructor(name, format, access) {
        super(name);
        this.format = format;
        this.access = access;
    }
    get astNodeType() {
        return "template";
    }
}
/**
 * @class PointerType
 * @extends Type
 * @category AST
 */
class PointerType extends Type {
    constructor(name, storage, type, access) {
        super(name);
        this.storage = storage;
        this.type = type;
        this.access = access;
    }
    get astNodeType() {
        return "pointer";
    }
}
/**
 * @class ArrayType
 * @extends Type
 * @category AST
 */
class ArrayType extends Type {
    constructor(name, attributes, format, count) {
        super(name);
        this.attributes = attributes;
        this.format = format;
        this.count = count;
    }
    get astNodeType() {
        return "array";
    }
}
/**
 * @class SamplerType
 * @extends Type
 * @category AST
 */
class SamplerType extends Type {
    constructor(name, format, access) {
        super(name);
        this.format = format;
        this.access = access;
    }
    get astNodeType() {
        return "sampler";
    }
}
/**
 * @class Expression
 * @extends Node
 * @category AST
 */
class Expression extends Node {
    constructor() {
        super();
    }
}
/**
 * @class StringExpr
 * @extends Expression
 * @category AST
 */
class StringExpr extends Expression {
    constructor(value) {
        super();
        this.value = value;
    }
    get astNodeType() {
        return "stringExpr";
    }
    toString() {
        return this.value;
    }
    evaluateString() {
        return this.value;
    }
}
/**
 * @class CreateExpr
 * @extends Expression
 * @category AST
 */
class CreateExpr extends Expression {
    constructor(type, args) {
        super();
        this.type = type;
        this.args = args;
    }
    get astNodeType() {
        return "createExpr";
    }
}
/**
 * @class CallExpr
 * @extends Expression
 * @category AST
 */
class CallExpr extends Expression {
    constructor(name, args) {
        super();
        this.name = name;
        this.args = args;
    }
    get astNodeType() {
        return "callExpr";
    }
    evaluate(context) {
        switch (this.name) {
            case "abs":
                return Math.abs(this.args[0].evaluate(context));
            case "acos":
                return Math.acos(this.args[0].evaluate(context));
            case "acosh":
                return Math.acosh(this.args[0].evaluate(context));
            case "asin":
                return Math.asin(this.args[0].evaluate(context));
            case "asinh":
                return Math.asinh(this.args[0].evaluate(context));
            case "atan":
                return Math.atan(this.args[0].evaluate(context));
            case "atan2":
                return Math.atan2(this.args[0].evaluate(context), this.args[1].evaluate(context));
            case "atanh":
                return Math.atanh(this.args[0].evaluate(context));
            case "ceil":
                return Math.ceil(this.args[0].evaluate(context));
            case "clamp":
                return Math.min(Math.max(this.args[0].evaluate(context), this.args[1].evaluate(context)), this.args[2].evaluate(context));
            case "cos":
                return Math.cos(this.args[0].evaluate(context));
            //case "cross":
            //TODO: (x[i] * y[j] - x[j] * y[i])
            case "degrees":
                return (this.args[0].evaluate(context) * 180) / Math.PI;
            //case "determinant":
            //TODO implement
            case "distance":
                return Math.sqrt(Math.pow(this.args[0].evaluate(context) - this.args[1].evaluate(context), 2));
            case "dot":
            //TODO: (x[i] * y[i])
            case "exp":
                return Math.exp(this.args[0].evaluate(context));
            case "exp2":
                return Math.pow(2, this.args[0].evaluate(context));
            //case "extractBits":
            //TODO: implement
            //case "firstLeadingBit":
            //TODO: implement
            case "floor":
                return Math.floor(this.args[0].evaluate(context));
            case "fma":
                return (this.args[0].evaluate(context) * this.args[1].evaluate(context) +
                    this.args[2].evaluate(context));
            case "fract":
                return (this.args[0].evaluate(context) -
                    Math.floor(this.args[0].evaluate(context)));
            //case "frexp":
            //TODO: implement
            case "inverseSqrt":
                return 1 / Math.sqrt(this.args[0].evaluate(context));
            //case "length":
            //TODO: implement
            case "log":
                return Math.log(this.args[0].evaluate(context));
            case "log2":
                return Math.log2(this.args[0].evaluate(context));
            case "max":
                return Math.max(this.args[0].evaluate(context), this.args[1].evaluate(context));
            case "min":
                return Math.min(this.args[0].evaluate(context), this.args[1].evaluate(context));
            case "mix":
                return (this.args[0].evaluate(context) *
                    (1 - this.args[2].evaluate(context)) +
                    this.args[1].evaluate(context) * this.args[2].evaluate(context));
            case "modf":
                return (this.args[0].evaluate(context) -
                    Math.floor(this.args[0].evaluate(context)));
            case "pow":
                return Math.pow(this.args[0].evaluate(context), this.args[1].evaluate(context));
            case "radians":
                return (this.args[0].evaluate(context) * Math.PI) / 180;
            case "round":
                return Math.round(this.args[0].evaluate(context));
            case "sign":
                return Math.sign(this.args[0].evaluate(context));
            case "sin":
                return Math.sin(this.args[0].evaluate(context));
            case "sinh":
                return Math.sinh(this.args[0].evaluate(context));
            case "saturate":
                return Math.min(Math.max(this.args[0].evaluate(context), 0), 1);
            case "smoothstep":
                return (this.args[0].evaluate(context) *
                    this.args[0].evaluate(context) *
                    (3 - 2 * this.args[0].evaluate(context)));
            case "sqrt":
                return Math.sqrt(this.args[0].evaluate(context));
            case "step":
                return this.args[0].evaluate(context) < this.args[1].evaluate(context)
                    ? 0
                    : 1;
            case "tan":
                return Math.tan(this.args[0].evaluate(context));
            case "tanh":
                return Math.tanh(this.args[0].evaluate(context));
            case "trunc":
                return Math.trunc(this.args[0].evaluate(context));
            default:
                throw new Error("Non const function: " + this.name);
        }
    }
}
/**
 * @class VariableExpr
 * @extends Expression
 * @category AST
 */
class VariableExpr extends Expression {
    constructor(name) {
        super();
        this.name = name;
    }
    get astNodeType() {
        return "varExpr";
    }
}
/**
 * @class ConstExpr
 * @extends Expression
 * @category AST
 */
class ConstExpr extends Expression {
    constructor(name, initializer) {
        super();
        this.name = name;
        this.initializer = initializer;
    }
    get astNodeType() {
        return "constExpr";
    }
    evaluate(context) {
        var _a, _b;
        if (this.initializer instanceof CreateExpr) {
            // This is a struct constant
            const property = (_a = this.postfix) === null || _a === void 0 ? void 0 : _a.evaluateString(context);
            const type = (_b = this.initializer.type) === null || _b === void 0 ? void 0 : _b.name;
            const struct = context.structs.get(type);
            const memberIndex = struct === null || struct === void 0 ? void 0 : struct.getMemberIndex(property);
            if (memberIndex != -1) {
                const value = this.initializer.args[memberIndex].evaluate(context);
                return value;
            }
            console.log(memberIndex);
        }
        return this.initializer.evaluate(context);
    }
}
/**
 * @class LiteralExpr
 * @extends Expression
 * @category AST
 */
class LiteralExpr extends Expression {
    constructor(value) {
        super();
        this.value = value;
    }
    get astNodeType() {
        return "literalExpr";
    }
    evaluate() {
        return this.value;
    }
}
/**
 * @class BitcastExpr
 * @extends Expression
 * @category AST
 */
class BitcastExpr extends Expression {
    constructor(type, value) {
        super();
        this.type = type;
        this.value = value;
    }
    get astNodeType() {
        return "bitcastExpr";
    }
}
/**
 * @class TypecastExpr
 * @extends Expression
 * @category AST
 */
class TypecastExpr extends Expression {
    constructor(type, args) {
        super();
        this.type = type;
        this.args = args;
    }
    get astNodeType() {
        return "typecastExpr";
    }
    evaluate(context) {
        return this.args[0].evaluate(context);
    }
}
/**
 * @class GroupingExpr
 * @extends Expression
 * @category AST
 */
class GroupingExpr extends Expression {
    constructor(contents) {
        super();
        this.contents = contents;
    }
    get astNodeType() {
        return "groupExpr";
    }
    evaluate(context) {
        return this.contents[0].evaluate(context);
    }
}
/**
 * @class Operator
 * @extends Expression
 * @category AST
 */
class Operator extends Expression {
    constructor() {
        super();
    }
}
/**
 * @class UnaryOperator
 * @extends Operator
 * @category AST
 * @property {string} operator +, -, !, ~
 */
class UnaryOperator extends Operator {
    constructor(operator, right) {
        super();
        this.operator = operator;
        this.right = right;
    }
    get astNodeType() {
        return "unaryOp";
    }
    evaluate(context) {
        switch (this.operator) {
            case "+":
                return this.right.evaluate(context);
            case "-":
                return -this.right.evaluate(context);
            case "!":
                return this.right.evaluate(context) ? 0 : 1;
            case "~":
                return ~this.right.evaluate(context);
            default:
                throw new Error("Unknown unary operator: " + this.operator);
        }
    }
}
/**
 * @class BinaryOperator
 * @extends Operator
 * @category AST
 * @property {string} operator +, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||
 */
class BinaryOperator extends Operator {
    constructor(operator, left, right) {
        super();
        this.operator = operator;
        this.left = left;
        this.right = right;
    }
    get astNodeType() {
        return "binaryOp";
    }
    evaluate(context) {
        switch (this.operator) {
            case "+":
                return this.left.evaluate(context) + this.right.evaluate(context);
            case "-":
                return this.left.evaluate(context) - this.right.evaluate(context);
            case "*":
                return this.left.evaluate(context) * this.right.evaluate(context);
            case "/":
                return this.left.evaluate(context) / this.right.evaluate(context);
            case "%":
                return this.left.evaluate(context) % this.right.evaluate(context);
            case "==":
                return this.left.evaluate(context) == this.right.evaluate(context)
                    ? 1
                    : 0;
            case "!=":
                return this.left.evaluate(context) != this.right.evaluate(context)
                    ? 1
                    : 0;
            case "<":
                return this.left.evaluate(context) < this.right.evaluate(context)
                    ? 1
                    : 0;
            case ">":
                return this.left.evaluate(context) > this.right.evaluate(context)
                    ? 1
                    : 0;
            case "<=":
                return this.left.evaluate(context) <= this.right.evaluate(context)
                    ? 1
                    : 0;
            case ">=":
                return this.left.evaluate(context) >= this.right.evaluate(context)
                    ? 1
                    : 0;
            case "&&":
                return this.left.evaluate(context) && this.right.evaluate(context)
                    ? 1
                    : 0;
            case "||":
                return this.left.evaluate(context) || this.right.evaluate(context)
                    ? 1
                    : 0;
            default:
                throw new Error(`Unknown operator ${this.operator}`);
        }
    }
}
/**
 * @class SwitchCase
 * @extends Node
 * @category AST
 */
class SwitchCase extends Node {
    constructor() {
        super();
    }
}
/**
 * @class Case
 * @extends SwitchCase
 * @category AST
 */
class Case extends SwitchCase {
    constructor(selector, body) {
        super();
        this.selector = selector;
        this.body = body;
    }
    get astNodeType() {
        return "case";
    }
}
/**
 * @class Default
 * @extends SwitchCase
 * @category AST
 */
class Default extends SwitchCase {
    constructor(body) {
        super();
        this.body = body;
    }
    get astNodeType() {
        return "default";
    }
}
/**
 * @class Argument
 * @extends Node
 * @category AST
 */
class Argument extends Node {
    constructor(name, type, attributes) {
        super();
        this.name = name;
        this.type = type;
        this.attributes = attributes;
    }
    get astNodeType() {
        return "argument";
    }
}
/**
 * @class ElseIf
 * @extends Node
 * @category AST
 */
class ElseIf extends Node {
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }
    get astNodeType() {
        return "elseif";
    }
}
/**
 * @class Member
 * @extends Node
 * @category AST
 */
class Member extends Node {
    constructor(name, type, attributes) {
        super();
        this.name = name;
        this.type = type;
        this.attributes = attributes;
    }
    get astNodeType() {
        return "member";
    }
}
/**
 * @class Attribute
 * @extends Node
 * @category AST
 */
class Attribute extends Node {
    constructor(name, value) {
        super();
        this.name = name;
        this.value = value;
    }
    get astNodeType() {
        return "attribute";
    }
}

var _a;
var TokenClass;
(function (TokenClass) {
    TokenClass[TokenClass["token"] = 0] = "token";
    TokenClass[TokenClass["keyword"] = 1] = "keyword";
    TokenClass[TokenClass["reserved"] = 2] = "reserved";
})(TokenClass || (TokenClass = {}));
class TokenType {
    constructor(name, type, rule) {
        this.name = name;
        this.type = type;
        this.rule = rule;
    }
    toString() {
        return this.name;
    }
}
/// Catalog of defined token types, keywords, and reserved words.
class TokenTypes {
}
_a = TokenTypes;
TokenTypes.none = new TokenType("", TokenClass.reserved, "");
TokenTypes.eof = new TokenType("EOF", TokenClass.token, "");
TokenTypes.reserved = {
    asm: new TokenType("asm", TokenClass.reserved, "asm"),
    bf16: new TokenType("bf16", TokenClass.reserved, "bf16"),
    do: new TokenType("do", TokenClass.reserved, "do"),
    enum: new TokenType("enum", TokenClass.reserved, "enum"),
    f16: new TokenType("f16", TokenClass.reserved, "f16"),
    f64: new TokenType("f64", TokenClass.reserved, "f64"),
    handle: new TokenType("handle", TokenClass.reserved, "handle"),
    i8: new TokenType("i8", TokenClass.reserved, "i8"),
    i16: new TokenType("i16", TokenClass.reserved, "i16"),
    i64: new TokenType("i64", TokenClass.reserved, "i64"),
    mat: new TokenType("mat", TokenClass.reserved, "mat"),
    premerge: new TokenType("premerge", TokenClass.reserved, "premerge"),
    regardless: new TokenType("regardless", TokenClass.reserved, "regardless"),
    typedef: new TokenType("typedef", TokenClass.reserved, "typedef"),
    u8: new TokenType("u8", TokenClass.reserved, "u8"),
    u16: new TokenType("u16", TokenClass.reserved, "u16"),
    u64: new TokenType("u64", TokenClass.reserved, "u64"),
    unless: new TokenType("unless", TokenClass.reserved, "unless"),
    using: new TokenType("using", TokenClass.reserved, "using"),
    vec: new TokenType("vec", TokenClass.reserved, "vec"),
    void: new TokenType("void", TokenClass.reserved, "void"),
};
TokenTypes.keywords = {
    array: new TokenType("array", TokenClass.keyword, "array"),
    atomic: new TokenType("atomic", TokenClass.keyword, "atomic"),
    bool: new TokenType("bool", TokenClass.keyword, "bool"),
    f32: new TokenType("f32", TokenClass.keyword, "f32"),
    i32: new TokenType("i32", TokenClass.keyword, "i32"),
    mat2x2: new TokenType("mat2x2", TokenClass.keyword, "mat2x2"),
    mat2x3: new TokenType("mat2x3", TokenClass.keyword, "mat2x3"),
    mat2x4: new TokenType("mat2x4", TokenClass.keyword, "mat2x4"),
    mat3x2: new TokenType("mat3x2", TokenClass.keyword, "mat3x2"),
    mat3x3: new TokenType("mat3x3", TokenClass.keyword, "mat3x3"),
    mat3x4: new TokenType("mat3x4", TokenClass.keyword, "mat3x4"),
    mat4x2: new TokenType("mat4x2", TokenClass.keyword, "mat4x2"),
    mat4x3: new TokenType("mat4x3", TokenClass.keyword, "mat4x3"),
    mat4x4: new TokenType("mat4x4", TokenClass.keyword, "mat4x4"),
    ptr: new TokenType("ptr", TokenClass.keyword, "ptr"),
    sampler: new TokenType("sampler", TokenClass.keyword, "sampler"),
    sampler_comparison: new TokenType("sampler_comparison", TokenClass.keyword, "sampler_comparison"),
    struct: new TokenType("struct", TokenClass.keyword, "struct"),
    texture_1d: new TokenType("texture_1d", TokenClass.keyword, "texture_1d"),
    texture_2d: new TokenType("texture_2d", TokenClass.keyword, "texture_2d"),
    texture_2d_array: new TokenType("texture_2d_array", TokenClass.keyword, "texture_2d_array"),
    texture_3d: new TokenType("texture_3d", TokenClass.keyword, "texture_3d"),
    texture_cube: new TokenType("texture_cube", TokenClass.keyword, "texture_cube"),
    texture_cube_array: new TokenType("texture_cube_array", TokenClass.keyword, "texture_cube_array"),
    texture_multisampled_2d: new TokenType("texture_multisampled_2d", TokenClass.keyword, "texture_multisampled_2d"),
    texture_storage_1d: new TokenType("texture_storage_1d", TokenClass.keyword, "texture_storage_1d"),
    texture_storage_2d: new TokenType("texture_storage_2d", TokenClass.keyword, "texture_storage_2d"),
    texture_storage_2d_array: new TokenType("texture_storage_2d_array", TokenClass.keyword, "texture_storage_2d_array"),
    texture_storage_3d: new TokenType("texture_storage_3d", TokenClass.keyword, "texture_storage_3d"),
    texture_depth_2d: new TokenType("texture_depth_2d", TokenClass.keyword, "texture_depth_2d"),
    texture_depth_2d_array: new TokenType("texture_depth_2d_array", TokenClass.keyword, "texture_depth_2d_array"),
    texture_depth_cube: new TokenType("texture_depth_cube", TokenClass.keyword, "texture_depth_cube"),
    texture_depth_cube_array: new TokenType("texture_depth_cube_array", TokenClass.keyword, "texture_depth_cube_array"),
    texture_depth_multisampled_2d: new TokenType("texture_depth_multisampled_2d", TokenClass.keyword, "texture_depth_multisampled_2d"),
    u32: new TokenType("u32", TokenClass.keyword, "u32"),
    vec2: new TokenType("vec2", TokenClass.keyword, "vec2"),
    vec3: new TokenType("vec3", TokenClass.keyword, "vec3"),
    vec4: new TokenType("vec4", TokenClass.keyword, "vec4"),
    bitcast: new TokenType("bitcast", TokenClass.keyword, "bitcast"),
    block: new TokenType("block", TokenClass.keyword, "block"),
    break: new TokenType("break", TokenClass.keyword, "break"),
    case: new TokenType("case", TokenClass.keyword, "case"),
    continue: new TokenType("continue", TokenClass.keyword, "continue"),
    continuing: new TokenType("continuing", TokenClass.keyword, "continuing"),
    default: new TokenType("default", TokenClass.keyword, "default"),
    discard: new TokenType("discard", TokenClass.keyword, "discard"),
    else: new TokenType("else", TokenClass.keyword, "else"),
    elseif: new TokenType("elseif", TokenClass.keyword, "elseif"),
    enable: new TokenType("enable", TokenClass.keyword, "enable"),
    fallthrough: new TokenType("fallthrough", TokenClass.keyword, "fallthrough"),
    false: new TokenType("false", TokenClass.keyword, "false"),
    fn: new TokenType("fn", TokenClass.keyword, "fn"),
    for: new TokenType("for", TokenClass.keyword, "for"),
    function: new TokenType("function", TokenClass.keyword, "function"),
    if: new TokenType("if", TokenClass.keyword, "if"),
    let: new TokenType("let", TokenClass.keyword, "let"),
    const: new TokenType("const", TokenClass.keyword, "const"),
    loop: new TokenType("loop", TokenClass.keyword, "loop"),
    while: new TokenType("while", TokenClass.keyword, "while"),
    private: new TokenType("private", TokenClass.keyword, "private"),
    read: new TokenType("read", TokenClass.keyword, "read"),
    read_write: new TokenType("read_write", TokenClass.keyword, "read_write"),
    return: new TokenType("return", TokenClass.keyword, "return"),
    storage: new TokenType("storage", TokenClass.keyword, "storage"),
    switch: new TokenType("switch", TokenClass.keyword, "switch"),
    true: new TokenType("true", TokenClass.keyword, "true"),
    alias: new TokenType("alias", TokenClass.keyword, "alias"),
    type: new TokenType("type", TokenClass.keyword, "type"),
    uniform: new TokenType("uniform", TokenClass.keyword, "uniform"),
    var: new TokenType("var", TokenClass.keyword, "var"),
    workgroup: new TokenType("workgroup", TokenClass.keyword, "workgroup"),
    write: new TokenType("write", TokenClass.keyword, "write"),
    r8unorm: new TokenType("r8unorm", TokenClass.keyword, "r8unorm"),
    r8snorm: new TokenType("r8snorm", TokenClass.keyword, "r8snorm"),
    r8uint: new TokenType("r8uint", TokenClass.keyword, "r8uint"),
    r8sint: new TokenType("r8sint", TokenClass.keyword, "r8sint"),
    r16uint: new TokenType("r16uint", TokenClass.keyword, "r16uint"),
    r16sint: new TokenType("r16sint", TokenClass.keyword, "r16sint"),
    r16float: new TokenType("r16float", TokenClass.keyword, "r16float"),
    rg8unorm: new TokenType("rg8unorm", TokenClass.keyword, "rg8unorm"),
    rg8snorm: new TokenType("rg8snorm", TokenClass.keyword, "rg8snorm"),
    rg8uint: new TokenType("rg8uint", TokenClass.keyword, "rg8uint"),
    rg8sint: new TokenType("rg8sint", TokenClass.keyword, "rg8sint"),
    r32uint: new TokenType("r32uint", TokenClass.keyword, "r32uint"),
    r32sint: new TokenType("r32sint", TokenClass.keyword, "r32sint"),
    r32float: new TokenType("r32float", TokenClass.keyword, "r32float"),
    rg16uint: new TokenType("rg16uint", TokenClass.keyword, "rg16uint"),
    rg16sint: new TokenType("rg16sint", TokenClass.keyword, "rg16sint"),
    rg16float: new TokenType("rg16float", TokenClass.keyword, "rg16float"),
    rgba8unorm: new TokenType("rgba8unorm", TokenClass.keyword, "rgba8unorm"),
    rgba8unorm_srgb: new TokenType("rgba8unorm_srgb", TokenClass.keyword, "rgba8unorm_srgb"),
    rgba8snorm: new TokenType("rgba8snorm", TokenClass.keyword, "rgba8snorm"),
    rgba8uint: new TokenType("rgba8uint", TokenClass.keyword, "rgba8uint"),
    rgba8sint: new TokenType("rgba8sint", TokenClass.keyword, "rgba8sint"),
    bgra8unorm: new TokenType("bgra8unorm", TokenClass.keyword, "bgra8unorm"),
    bgra8unorm_srgb: new TokenType("bgra8unorm_srgb", TokenClass.keyword, "bgra8unorm_srgb"),
    rgb10a2unorm: new TokenType("rgb10a2unorm", TokenClass.keyword, "rgb10a2unorm"),
    rg11b10float: new TokenType("rg11b10float", TokenClass.keyword, "rg11b10float"),
    rg32uint: new TokenType("rg32uint", TokenClass.keyword, "rg32uint"),
    rg32sint: new TokenType("rg32sint", TokenClass.keyword, "rg32sint"),
    rg32float: new TokenType("rg32float", TokenClass.keyword, "rg32float"),
    rgba16uint: new TokenType("rgba16uint", TokenClass.keyword, "rgba16uint"),
    rgba16sint: new TokenType("rgba16sint", TokenClass.keyword, "rgba16sint"),
    rgba16float: new TokenType("rgba16float", TokenClass.keyword, "rgba16float"),
    rgba32uint: new TokenType("rgba32uint", TokenClass.keyword, "rgba32uint"),
    rgba32sint: new TokenType("rgba32sint", TokenClass.keyword, "rgba32sint"),
    rgba32float: new TokenType("rgba32float", TokenClass.keyword, "rgba32float"),
    static_assert: new TokenType("static_assert", TokenClass.keyword, "static_assert"),
    // WGSL grammar has a few keywords that have different token names than the strings they
    // represent. Aliasing them here.
    /*int32: new TokenType("i32", TokenClass.keyword, "i32"),
        uint32: new TokenType("u32", TokenClass.keyword, "u32"),
        float32: new TokenType("f32", TokenClass.keyword, "f32"),
        pointer: new TokenType("ptr", TokenClass.keyword, "ptr"),*/
};
TokenTypes.tokens = {
    decimal_float_literal: new TokenType("decimal_float_literal", TokenClass.token, /((-?[0-9]*\.[0-9]+|-?[0-9]+\.[0-9]*)((e|E)(\+|-)?[0-9]+)?f?)|(-?[0-9]+(e|E)(\+|-)?[0-9]+f?)/),
    hex_float_literal: new TokenType("hex_float_literal", TokenClass.token, /-?0x((([0-9a-fA-F]*\.[0-9a-fA-F]+|[0-9a-fA-F]+\.[0-9a-fA-F]*)((p|P)(\+|-)?[0-9]+f?)?)|([0-9a-fA-F]+(p|P)(\+|-)?[0-9]+f?))/),
    int_literal: new TokenType("int_literal", TokenClass.token, /-?0x[0-9a-fA-F]+|0|-?[1-9][0-9]*/),
    uint_literal: new TokenType("uint_literal", TokenClass.token, /0x[0-9a-fA-F]+u|0u|[1-9][0-9]*u/),
    ident: new TokenType("ident", TokenClass.token, /[a-zA-Z][0-9a-zA-Z_]*/),
    and: new TokenType("and", TokenClass.token, "&"),
    and_and: new TokenType("and_and", TokenClass.token, "&&"),
    arrow: new TokenType("arrow ", TokenClass.token, "->"),
    attr: new TokenType("attr", TokenClass.token, "@"),
    attr_left: new TokenType("attr_left", TokenClass.token, "[["),
    attr_right: new TokenType("attr_right", TokenClass.token, "]]"),
    forward_slash: new TokenType("forward_slash", TokenClass.token, "/"),
    bang: new TokenType("bang", TokenClass.token, "!"),
    bracket_left: new TokenType("bracket_left", TokenClass.token, "["),
    bracket_right: new TokenType("bracket_right", TokenClass.token, "]"),
    brace_left: new TokenType("brace_left", TokenClass.token, "{"),
    brace_right: new TokenType("brace_right", TokenClass.token, "}"),
    colon: new TokenType("colon", TokenClass.token, ":"),
    comma: new TokenType("comma", TokenClass.token, ","),
    equal: new TokenType("equal", TokenClass.token, "="),
    equal_equal: new TokenType("equal_equal", TokenClass.token, "=="),
    not_equal: new TokenType("not_equal", TokenClass.token, "!="),
    greater_than: new TokenType("greater_than", TokenClass.token, ">"),
    greater_than_equal: new TokenType("greater_than_equal", TokenClass.token, ">="),
    shift_right: new TokenType("shift_right", TokenClass.token, ">>"),
    less_than: new TokenType("less_than", TokenClass.token, "<"),
    less_than_equal: new TokenType("less_than_equal", TokenClass.token, "<="),
    shift_left: new TokenType("shift_left", TokenClass.token, "<<"),
    modulo: new TokenType("modulo", TokenClass.token, "%"),
    minus: new TokenType("minus", TokenClass.token, "-"),
    minus_minus: new TokenType("minus_minus", TokenClass.token, "--"),
    period: new TokenType("period", TokenClass.token, "."),
    plus: new TokenType("plus", TokenClass.token, "+"),
    plus_plus: new TokenType("plus_plus", TokenClass.token, "++"),
    or: new TokenType("or", TokenClass.token, "|"),
    or_or: new TokenType("or_or", TokenClass.token, "||"),
    paren_left: new TokenType("paren_left", TokenClass.token, "("),
    paren_right: new TokenType("paren_right", TokenClass.token, ")"),
    semicolon: new TokenType("semicolon", TokenClass.token, ";"),
    star: new TokenType("star", TokenClass.token, "*"),
    tilde: new TokenType("tilde", TokenClass.token, "~"),
    underscore: new TokenType("underscore", TokenClass.token, "_"),
    xor: new TokenType("xor", TokenClass.token, "^"),
    plus_equal: new TokenType("plus_equal", TokenClass.token, "+="),
    minus_equal: new TokenType("minus_equal", TokenClass.token, "-="),
    times_equal: new TokenType("times_equal", TokenClass.token, "*="),
    division_equal: new TokenType("division_equal", TokenClass.token, "/="),
    modulo_equal: new TokenType("modulo_equal", TokenClass.token, "%="),
    and_equal: new TokenType("and_equal", TokenClass.token, "&="),
    or_equal: new TokenType("or_equal", TokenClass.token, "|="),
    xor_equal: new TokenType("xor_equal", TokenClass.token, "^="),
    shift_right_equal: new TokenType("shift_right_equal", TokenClass.token, ">>="),
    shift_left_equal: new TokenType("shift_left_equal", TokenClass.token, "<<="),
};
TokenTypes.storage_class = [
    _a.keywords.function,
    _a.keywords.private,
    _a.keywords.workgroup,
    _a.keywords.uniform,
    _a.keywords.storage,
];
TokenTypes.access_mode = [
    _a.keywords.read,
    _a.keywords.write,
    _a.keywords.read_write,
];
TokenTypes.sampler_type = [
    _a.keywords.sampler,
    _a.keywords.sampler_comparison,
];
TokenTypes.sampled_texture_type = [
    _a.keywords.texture_1d,
    _a.keywords.texture_2d,
    _a.keywords.texture_2d_array,
    _a.keywords.texture_3d,
    _a.keywords.texture_cube,
    _a.keywords.texture_cube_array,
];
TokenTypes.multisampled_texture_type = [
    _a.keywords.texture_multisampled_2d,
];
TokenTypes.storage_texture_type = [
    _a.keywords.texture_storage_1d,
    _a.keywords.texture_storage_2d,
    _a.keywords.texture_storage_2d_array,
    _a.keywords.texture_storage_3d,
];
TokenTypes.depth_texture_type = [
    _a.keywords.texture_depth_2d,
    _a.keywords.texture_depth_2d_array,
    _a.keywords.texture_depth_cube,
    _a.keywords.texture_depth_cube_array,
    _a.keywords.texture_depth_multisampled_2d,
];
TokenTypes.any_texture_type = [
    ..._a.sampled_texture_type,
    ..._a.multisampled_texture_type,
    ..._a.storage_texture_type,
    ..._a.depth_texture_type,
];
TokenTypes.texel_format = [
    _a.keywords.r8unorm,
    _a.keywords.r8snorm,
    _a.keywords.r8uint,
    _a.keywords.r8sint,
    _a.keywords.r16uint,
    _a.keywords.r16sint,
    _a.keywords.r16float,
    _a.keywords.rg8unorm,
    _a.keywords.rg8snorm,
    _a.keywords.rg8uint,
    _a.keywords.rg8sint,
    _a.keywords.r32uint,
    _a.keywords.r32sint,
    _a.keywords.r32float,
    _a.keywords.rg16uint,
    _a.keywords.rg16sint,
    _a.keywords.rg16float,
    _a.keywords.rgba8unorm,
    _a.keywords.rgba8unorm_srgb,
    _a.keywords.rgba8snorm,
    _a.keywords.rgba8uint,
    _a.keywords.rgba8sint,
    _a.keywords.bgra8unorm,
    _a.keywords.bgra8unorm_srgb,
    _a.keywords.rgb10a2unorm,
    _a.keywords.rg11b10float,
    _a.keywords.rg32uint,
    _a.keywords.rg32sint,
    _a.keywords.rg32float,
    _a.keywords.rgba16uint,
    _a.keywords.rgba16sint,
    _a.keywords.rgba16float,
    _a.keywords.rgba32uint,
    _a.keywords.rgba32sint,
    _a.keywords.rgba32float,
];
TokenTypes.const_literal = [
    _a.tokens.int_literal,
    _a.tokens.uint_literal,
    _a.tokens.decimal_float_literal,
    _a.tokens.hex_float_literal,
    _a.keywords.true,
    _a.keywords.false,
];
TokenTypes.literal_or_ident = [
    _a.tokens.ident,
    _a.tokens.int_literal,
    _a.tokens.uint_literal,
    _a.tokens.decimal_float_literal,
    _a.tokens.hex_float_literal,
];
TokenTypes.element_count_expression = [
    _a.tokens.int_literal,
    _a.tokens.uint_literal,
    _a.tokens.ident,
];
TokenTypes.template_types = [
    _a.keywords.vec2,
    _a.keywords.vec3,
    _a.keywords.vec4,
    _a.keywords.mat2x2,
    _a.keywords.mat2x3,
    _a.keywords.mat2x4,
    _a.keywords.mat3x2,
    _a.keywords.mat3x3,
    _a.keywords.mat3x4,
    _a.keywords.mat4x2,
    _a.keywords.mat4x3,
    _a.keywords.mat4x4,
    _a.keywords.atomic,
    _a.keywords.bitcast,
    ..._a.any_texture_type,
];
// The grammar calls out 'block', but attribute grammar is defined to use a 'ident'.
// The attribute grammar should be ident | block.
TokenTypes.attribute_name = [_a.tokens.ident, _a.keywords.block];
TokenTypes.assignment_operators = [
    _a.tokens.equal,
    _a.tokens.plus_equal,
    _a.tokens.minus_equal,
    _a.tokens.times_equal,
    _a.tokens.division_equal,
    _a.tokens.modulo_equal,
    _a.tokens.and_equal,
    _a.tokens.or_equal,
    _a.tokens.xor_equal,
    _a.tokens.shift_right_equal,
    _a.tokens.shift_left_equal,
];
TokenTypes.increment_operators = [
    _a.tokens.plus_plus,
    _a.tokens.minus_minus,
];
/// A token parsed by the WgslScanner.
class Token {
    constructor(type, lexeme, line) {
        this.type = type;
        this.lexeme = lexeme;
        this.line = line;
    }
    toString() {
        return this.lexeme;
    }
}
/// Lexical scanner for the WGSL language. This takes an input source text and generates a list
/// of Token objects, which can then be fed into the WgslParser to generate an AST.
class WgslScanner {
    constructor(source) {
        this._tokens = [];
        this._start = 0;
        this._current = 0;
        this._line = 1;
        this._source = source !== null && source !== void 0 ? source : "";
    }
    /// Scan all tokens from the source.
    scanTokens() {
        while (!this._isAtEnd()) {
            this._start = this._current;
            if (!this.scanToken())
                throw `Invalid syntax at line ${this._line}`;
        }
        this._tokens.push(new Token(TokenTypes.eof, "", this._line));
        return this._tokens;
    }
    /// Scan a single token from the source.
    scanToken() {
        // Find the longest consecutive set of characters that match a rule.
        let lexeme = this._advance();
        // Skip line-feed, adding to the line counter.
        if (lexeme == "\n") {
            this._line++;
            return true;
        }
        // Skip whitespace
        if (this._isWhitespace(lexeme)) {
            return true;
        }
        if (lexeme == "/") {
            // If it's a // comment, skip everything until the next line-feed.
            if (this._peekAhead() == "/") {
                while (lexeme != "\n") {
                    if (this._isAtEnd())
                        return true;
                    lexeme = this._advance();
                }
                // skip the linefeed
                this._line++;
                return true;
            }
            else if (this._peekAhead() == "*") {
                // If it's a / * block comment, skip everything until the matching * /,
                // allowing for nested block comments.
                this._advance();
                let commentLevel = 1;
                while (commentLevel > 0) {
                    if (this._isAtEnd())
                        return true;
                    lexeme = this._advance();
                    if (lexeme == "\n") {
                        this._line++;
                    }
                    else if (lexeme == "*") {
                        if (this._peekAhead() == "/") {
                            this._advance();
                            commentLevel--;
                            if (commentLevel == 0) {
                                return true;
                            }
                        }
                    }
                    else if (lexeme == "/") {
                        if (this._peekAhead() == "*") {
                            this._advance();
                            commentLevel++;
                        }
                    }
                }
                return true;
            }
        }
        let matchType = TokenTypes.none;
        for (;;) {
            let matchedType = this._findType(lexeme);
            // The exception to "longest lexeme" rule is '>>'. In the case of 1>>2, it's a
            // shift_right.
            // In the case of array<vec4<f32>>, it's two greater_than's (one to close the vec4,
            // and one to close the array).
            // I don't know of a great way to resolve this, so '>>' is special-cased and if
            // there was a less_than up to some number of tokens previously, and the token prior to
            // that is a keyword that requires a '<', then it will be split into two greater_than's;
            // otherwise it's a shift_right.
            if (lexeme == ">" && this._peekAhead() == ">") {
                let foundLessThan = false;
                let ti = this._tokens.length - 1;
                for (let count = 0; count < 4 && ti >= 0; ++count, --ti) {
                    if (this._tokens[ti].type === TokenTypes.tokens.less_than) {
                        if (ti > 0 &&
                            TokenTypes.template_types.indexOf(this._tokens[ti - 1].type) != -1) {
                            foundLessThan = true;
                        }
                        break;
                    }
                }
                // If there was a less_than in the recent token history, then this is probably a
                // greater_than.
                if (foundLessThan) {
                    this._addToken(matchedType);
                    return true;
                }
            }
            // The current lexeme may not match any rule, but some token types may be invalid for
            // part of the string but valid after a few more characters.
            // For example, 0x.5 is a hex_float_literal. But as it's being scanned,
            // "0" is a int_literal, then "0x" is invalid. If we stopped there, it would return
            // the int_literal "0", but that's incorrect. So if we look forward a few characters,
            // we'd get "0x.", which is still invalid, followed by "0x.5" which is the correct
            // hex_float_literal. So that means if we hit an non-matching string, we should look
            // ahead up to two characters to see if the string starts matching a valid rule again.
            if (matchedType === TokenTypes.none) {
                let lookAheadLexeme = lexeme;
                let lookAhead = 0;
                const maxLookAhead = 2;
                for (let li = 0; li < maxLookAhead; ++li) {
                    lookAheadLexeme += this._peekAhead(li);
                    matchedType = this._findType(lookAheadLexeme);
                    if (matchedType !== TokenTypes.none) {
                        lookAhead = li;
                        break;
                    }
                }
                if (matchedType === TokenTypes.none) {
                    if (matchType === TokenTypes.none)
                        return false;
                    this._current--;
                    this._addToken(matchType);
                    return true;
                }
                lexeme = lookAheadLexeme;
                this._current += lookAhead + 1;
            }
            matchType = matchedType;
            if (this._isAtEnd())
                break;
            lexeme += this._advance();
        }
        // We got to the end of the input stream. Then the token we've ready so far is it.
        if (matchType === TokenTypes.none)
            return false;
        this._addToken(matchType);
        return true;
    }
    _findType(lexeme) {
        for (const name in TokenTypes.keywords) {
            const type = TokenTypes.keywords[name];
            if (this._match(lexeme, type.rule)) {
                return type;
            }
        }
        for (const name in TokenTypes.tokens) {
            const type = TokenTypes.tokens[name];
            if (this._match(lexeme, type.rule)) {
                return type;
            }
        }
        return TokenTypes.none;
    }
    _match(lexeme, rule) {
        if (typeof rule === "string") {
            if (rule == lexeme) {
                return true;
            }
        }
        else {
            // regex
            const match = rule.exec(lexeme);
            if (match && match.index == 0 && match[0] == lexeme)
                return true;
        }
        return false;
    }
    _isAtEnd() {
        return this._current >= this._source.length;
    }
    _isWhitespace(c) {
        return c == " " || c == "\t" || c == "\r";
    }
    _advance(amount = 0) {
        let c = this._source[this._current];
        amount = amount || 0;
        amount++;
        this._current += amount;
        return c;
    }
    _peekAhead(offset = 0) {
        offset = offset || 0;
        if (this._current + offset >= this._source.length)
            return "\0";
        return this._source[this._current + offset];
    }
    _addToken(type) {
        const text = this._source.substring(this._start, this._current);
        this._tokens.push(new Token(type, text, this._line));
    }
}

/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
/// Parse a sequence of tokens from the WgslScanner into an Abstract Syntax Tree (AST).
class WgslParser {
    constructor() {
        this._tokens = [];
        this._current = 0;
        this._context = new ParseContext();
    }
    parse(tokensOrCode) {
        this._initialize(tokensOrCode);
        let statements = [];
        while (!this._isAtEnd()) {
            const statement = this._global_decl_or_directive();
            if (!statement)
                break;
            statements.push(statement);
        }
        return statements;
    }
    _initialize(tokensOrCode) {
        if (tokensOrCode) {
            if (typeof tokensOrCode == "string") {
                const scanner = new WgslScanner(tokensOrCode);
                this._tokens = scanner.scanTokens();
            }
            else {
                this._tokens = tokensOrCode;
            }
        }
        else {
            this._tokens = [];
        }
        this._current = 0;
    }
    _error(token, message) {
        console.error(token, message);
        return {
            token,
            message,
            toString: function () {
                return `${message}`;
            },
        };
    }
    _isAtEnd() {
        return (this._current >= this._tokens.length ||
            this._peek().type == TokenTypes.eof);
    }
    _match(types) {
        if (types instanceof TokenType) {
            if (this._check(types)) {
                this._advance();
                return true;
            }
            return false;
        }
        for (let i = 0, l = types.length; i < l; ++i) {
            const type = types[i];
            if (this._check(type)) {
                this._advance();
                return true;
            }
        }
        return false;
    }
    _consume(types, message) {
        if (this._check(types))
            return this._advance();
        throw this._error(this._peek(), message);
    }
    _check(types) {
        if (this._isAtEnd())
            return false;
        const tk = this._peek();
        if (types instanceof Array) {
            let t = tk.type;
            let index = types.indexOf(t);
            return index != -1;
        }
        return tk.type == types;
    }
    _advance() {
        if (!this._isAtEnd())
            this._current++;
        return this._previous();
    }
    _peek() {
        return this._tokens[this._current];
    }
    _previous() {
        return this._tokens[this._current - 1];
    }
    _global_decl_or_directive() {
        // semicolon
        // global_variable_decl semicolon
        // global_constant_decl semicolon
        // type_alias semicolon
        // struct_decl
        // function_decl
        // enable_directive
        // Ignore any stand-alone semicolons
        while (this._match(TokenTypes.tokens.semicolon) && !this._isAtEnd())
            ;
        if (this._match(TokenTypes.keywords.alias)) {
            const type = this._type_alias();
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return type;
        }
        if (this._match(TokenTypes.keywords.enable)) {
            const enable = this._enable_directive();
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return enable;
        }
        // The following statements have an optional attribute*
        const attrs = this._attribute();
        if (this._check(TokenTypes.keywords.var)) {
            const _var = this._global_variable_decl();
            if (_var != null)
                _var.attributes = attrs;
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _var;
        }
        if (this._check(TokenTypes.keywords.let)) {
            const _let = this._global_let_decl();
            if (_let != null)
                _let.attributes = attrs;
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _let;
        }
        if (this._check(TokenTypes.keywords.const)) {
            const _const = this._global_const_decl();
            if (_const != null)
                _const.attributes = attrs;
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _const;
        }
        if (this._check(TokenTypes.keywords.struct)) {
            const _struct = this._struct_decl();
            if (_struct != null)
                _struct.attributes = attrs;
            return _struct;
        }
        if (this._check(TokenTypes.keywords.fn)) {
            const _fn = this._function_decl();
            if (_fn != null)
                _fn.attributes = attrs;
            return _fn;
        }
        return null;
    }
    _function_decl() {
        // attribute* function_header compound_statement
        // function_header: fn ident paren_left param_list? paren_right (arrow attribute* type_decl)?
        if (!this._match(TokenTypes.keywords.fn))
            return null;
        const name = this._consume(TokenTypes.tokens.ident, "Expected function name.").toString();
        this._consume(TokenTypes.tokens.paren_left, "Expected '(' for function arguments.");
        const args = [];
        if (!this._check(TokenTypes.tokens.paren_right)) {
            do {
                if (this._check(TokenTypes.tokens.paren_right))
                    break;
                const argAttrs = this._attribute();
                const name = this._consume(TokenTypes.tokens.ident, "Expected argument name.").toString();
                this._consume(TokenTypes.tokens.colon, "Expected ':' for argument type.");
                const typeAttrs = this._attribute();
                const type = this._type_decl();
                if (type != null) {
                    type.attributes = typeAttrs;
                    args.push(new Argument(name, type, argAttrs));
                }
            } while (this._match(TokenTypes.tokens.comma));
        }
        this._consume(TokenTypes.tokens.paren_right, "Expected ')' after function arguments.");
        let _return = null;
        if (this._match(TokenTypes.tokens.arrow)) {
            const attrs = this._attribute();
            _return = this._type_decl();
            if (_return != null)
                _return.attributes = attrs;
        }
        const body = this._compound_statement();
        return new Function(name, args, _return, body);
    }
    _compound_statement() {
        // brace_left statement* brace_right
        const statements = [];
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for block.");
        while (!this._check(TokenTypes.tokens.brace_right)) {
            const statement = this._statement();
            if (statement !== null)
                statements.push(statement);
        }
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' for block.");
        return statements;
    }
    _statement() {
        // semicolon
        // return_statement semicolon
        // if_statement
        // switch_statement
        // loop_statement
        // for_statement
        // func_call_statement semicolon
        // variable_statement semicolon
        // break_statement semicolon
        // continue_statement semicolon
        // discard semicolon
        // assignment_statement semicolon
        // compound_statement
        // increment_statement semicolon
        // decrement_statement semicolon
        // static_assert_statement semicolon
        // Ignore any stand-alone semicolons
        while (this._match(TokenTypes.tokens.semicolon) && !this._isAtEnd())
            ;
        if (this._check(TokenTypes.keywords.if))
            return this._if_statement();
        if (this._check(TokenTypes.keywords.switch))
            return this._switch_statement();
        if (this._check(TokenTypes.keywords.loop))
            return this._loop_statement();
        if (this._check(TokenTypes.keywords.for))
            return this._for_statement();
        if (this._check(TokenTypes.keywords.while))
            return this._while_statement();
        if (this._check(TokenTypes.keywords.static_assert))
            return this._static_assert_statement();
        if (this._check(TokenTypes.tokens.brace_left))
            return this._compound_statement();
        let result = null;
        if (this._check(TokenTypes.keywords.return))
            result = this._return_statement();
        else if (this._check([
            TokenTypes.keywords.var,
            TokenTypes.keywords.let,
            TokenTypes.keywords.const,
        ]))
            result = this._variable_statement();
        else if (this._match(TokenTypes.keywords.discard))
            result = new Discard();
        else if (this._match(TokenTypes.keywords.break))
            result = new Break();
        else if (this._match(TokenTypes.keywords.continue))
            result = new Continue();
        else
            result =
                this._increment_decrement_statement() ||
                    this._func_call_statement() ||
                    this._assignment_statement();
        if (result != null)
            this._consume(TokenTypes.tokens.semicolon, "Expected ';' after statement.");
        return result;
    }
    _static_assert_statement() {
        if (!this._match(TokenTypes.keywords.static_assert))
            return null;
        let expression = this._optional_paren_expression();
        return new StaticAssert(expression);
    }
    _while_statement() {
        if (!this._match(TokenTypes.keywords.while))
            return null;
        let condition = this._optional_paren_expression();
        const block = this._compound_statement();
        return new While(condition, block);
    }
    _for_statement() {
        // for paren_left for_header paren_right compound_statement
        if (!this._match(TokenTypes.keywords.for))
            return null;
        this._consume(TokenTypes.tokens.paren_left, "Expected '('.");
        // for_header: (variable_statement assignment_statement func_call_statement)? semicolon short_circuit_or_expression? semicolon (assignment_statement func_call_statement)?
        const init = !this._check(TokenTypes.tokens.semicolon)
            ? this._for_init()
            : null;
        this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
        const condition = !this._check(TokenTypes.tokens.semicolon)
            ? this._short_circuit_or_expression()
            : null;
        this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
        const increment = !this._check(TokenTypes.tokens.paren_right)
            ? this._for_increment()
            : null;
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'.");
        const body = this._compound_statement();
        return new For(init, condition, increment, body);
    }
    _for_init() {
        // (variable_statement assignment_statement func_call_statement)?
        return (this._variable_statement() ||
            this._func_call_statement() ||
            this._assignment_statement());
    }
    _for_increment() {
        // (assignment_statement func_call_statement increment_statement)?
        return (this._func_call_statement() ||
            this._increment_decrement_statement() ||
            this._assignment_statement());
    }
    _variable_statement() {
        // variable_decl
        // variable_decl equal short_circuit_or_expression
        // let (ident variable_ident_decl) equal short_circuit_or_expression
        // const (ident variable_ident_decl) equal short_circuit_or_expression
        if (this._check(TokenTypes.keywords.var)) {
            const _var = this._variable_decl();
            if (_var === null)
                throw this._error(this._peek(), "Variable declaration expected.");
            let value = null;
            if (this._match(TokenTypes.tokens.equal))
                value = this._short_circuit_or_expression();
            return new Var(_var.name, _var.type, _var.storage, _var.access, value);
        }
        if (this._match(TokenTypes.keywords.let)) {
            const name = this._consume(TokenTypes.tokens.ident, "Expected name for let.").toString();
            let type = null;
            if (this._match(TokenTypes.tokens.colon)) {
                const typeAttrs = this._attribute();
                type = this._type_decl();
                if (type != null)
                    type.attributes = typeAttrs;
            }
            this._consume(TokenTypes.tokens.equal, "Expected '=' for let.");
            const value = this._short_circuit_or_expression();
            return new Let(name, type, null, null, value);
        }
        if (this._match(TokenTypes.keywords.const)) {
            const name = this._consume(TokenTypes.tokens.ident, "Expected name for const.").toString();
            let type = null;
            if (this._match(TokenTypes.tokens.colon)) {
                const typeAttrs = this._attribute();
                type = this._type_decl();
                if (type != null)
                    type.attributes = typeAttrs;
            }
            this._consume(TokenTypes.tokens.equal, "Expected '=' for const.");
            const value = this._short_circuit_or_expression();
            return new Const(name, type, null, null, value);
        }
        return null;
    }
    _increment_decrement_statement() {
        const savedPos = this._current;
        const _var = this._unary_expression();
        if (_var == null)
            return null;
        if (!this._check(TokenTypes.increment_operators)) {
            this._current = savedPos;
            return null;
        }
        const token = this._consume(TokenTypes.increment_operators, "Expected increment operator");
        return new Increment(token.type === TokenTypes.tokens.plus_plus
            ? IncrementOperator.increment
            : IncrementOperator.decrement, _var);
    }
    _assignment_statement() {
        // (unary_expression underscore) equal short_circuit_or_expression
        let _var = null;
        if (this._check(TokenTypes.tokens.brace_right))
            return null;
        let isUnderscore = this._match(TokenTypes.tokens.underscore);
        if (!isUnderscore)
            _var = this._unary_expression();
        if (!isUnderscore && _var == null)
            return null;
        const type = this._consume(TokenTypes.assignment_operators, "Expected assignment operator.");
        const value = this._short_circuit_or_expression();
        return new Assign(AssignOperator.parse(type.lexeme), _var, value);
    }
    _func_call_statement() {
        // ident argument_expression_list
        if (!this._check(TokenTypes.tokens.ident))
            return null;
        const savedPos = this._current;
        const name = this._consume(TokenTypes.tokens.ident, "Expected function name.");
        const args = this._argument_expression_list();
        if (args === null) {
            this._current = savedPos;
            return null;
        }
        return new Call(name.lexeme, args);
    }
    _loop_statement() {
        // loop brace_left statement* continuing_statement? brace_right
        if (!this._match(TokenTypes.keywords.loop))
            return null;
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for loop.");
        // statement*
        const statements = [];
        let statement = this._statement();
        while (statement !== null) {
            if (statement instanceof (Array)) {
                for (let s of statement) {
                    statements.push(s);
                }
            }
            else {
                statements.push(statement);
            }
            statement = this._statement();
        }
        // continuing_statement: continuing compound_statement
        let continuing = null;
        if (this._match(TokenTypes.keywords.continuing))
            continuing = this._compound_statement();
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' for loop.");
        return new Loop(statements, continuing);
    }
    _switch_statement() {
        // switch optional_paren_expression brace_left switch_body+ brace_right
        if (!this._match(TokenTypes.keywords.switch))
            return null;
        const condition = this._optional_paren_expression();
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for switch.");
        const body = this._switch_body();
        if (body == null || body.length == 0)
            throw this._error(this._previous(), "Expected 'case' or 'default'.");
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' for switch.");
        return new Switch(condition, body);
    }
    _switch_body() {
        // case case_selectors colon brace_left case_body? brace_right
        // default colon brace_left case_body? brace_right
        const cases = [];
        if (this._match(TokenTypes.keywords.case)) {
            const selector = this._case_selectors();
            this._consume(TokenTypes.tokens.colon, "Exected ':' for switch case.");
            this._consume(TokenTypes.tokens.brace_left, "Exected '{' for switch case.");
            const body = this._case_body();
            this._consume(TokenTypes.tokens.brace_right, "Exected '}' for switch case.");
            cases.push(new Case(selector, body));
        }
        if (this._match(TokenTypes.keywords.default)) {
            this._consume(TokenTypes.tokens.colon, "Exected ':' for switch default.");
            this._consume(TokenTypes.tokens.brace_left, "Exected '{' for switch default.");
            const body = this._case_body();
            this._consume(TokenTypes.tokens.brace_right, "Exected '}' for switch default.");
            cases.push(new Default(body));
        }
        if (this._check([TokenTypes.keywords.default, TokenTypes.keywords.case])) {
            const _cases = this._switch_body();
            cases.push(_cases[0]);
        }
        return cases;
    }
    _case_selectors() {
        // const_literal (comma const_literal)* comma?
        const selectors = [
            this._consume(TokenTypes.const_literal, "Expected constant literal").toString(),
        ];
        while (this._match(TokenTypes.tokens.comma)) {
            selectors.push(this._consume(TokenTypes.const_literal, "Expected constant literal").toString());
        }
        return selectors;
    }
    _case_body() {
        // statement case_body?
        // fallthrough semicolon
        if (this._match(TokenTypes.keywords.fallthrough)) {
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return [];
        }
        let statement = this._statement();
        if (statement == null)
            return [];
        if (!(statement instanceof Array)) {
            statement = [statement];
        }
        const nextStatement = this._case_body();
        if (nextStatement.length == 0)
            return statement;
        return [...statement, nextStatement[0]];
    }
    _if_statement() {
        // if optional_paren_expression compound_statement elseif_statement? else_statement?
        if (!this._match(TokenTypes.keywords.if))
            return null;
        const condition = this._optional_paren_expression();
        const block = this._compound_statement();
        let elseif = null;
        if (this._match(TokenTypes.keywords.elseif))
            elseif = this._elseif_statement();
        let _else = null;
        if (this._match(TokenTypes.keywords.else))
            _else = this._compound_statement();
        return new If(condition, block, elseif, _else);
    }
    _elseif_statement() {
        // else_if optional_paren_expression compound_statement elseif_statement?
        const elseif = [];
        const condition = this._optional_paren_expression();
        const block = this._compound_statement();
        elseif.push(new ElseIf(condition, block));
        if (this._match(TokenTypes.keywords.elseif))
            elseif.push(this._elseif_statement()[0]);
        return elseif;
    }
    _return_statement() {
        // return short_circuit_or_expression?
        if (!this._match(TokenTypes.keywords.return))
            return null;
        const value = this._short_circuit_or_expression();
        return new Return(value);
    }
    _short_circuit_or_expression() {
        // short_circuit_and_expression
        // short_circuit_or_expression or_or short_circuit_and_expression
        let expr = this._short_circuit_and_expr();
        while (this._match(TokenTypes.tokens.or_or)) {
            expr = new BinaryOperator(this._previous().toString(), expr, this._short_circuit_and_expr());
        }
        return expr;
    }
    _short_circuit_and_expr() {
        // inclusive_or_expression
        // short_circuit_and_expression and_and inclusive_or_expression
        let expr = this._inclusive_or_expression();
        while (this._match(TokenTypes.tokens.and_and)) {
            expr = new BinaryOperator(this._previous().toString(), expr, this._inclusive_or_expression());
        }
        return expr;
    }
    _inclusive_or_expression() {
        // exclusive_or_expression
        // inclusive_or_expression or exclusive_or_expression
        let expr = this._exclusive_or_expression();
        while (this._match(TokenTypes.tokens.or)) {
            expr = new BinaryOperator(this._previous().toString(), expr, this._exclusive_or_expression());
        }
        return expr;
    }
    _exclusive_or_expression() {
        // and_expression
        // exclusive_or_expression xor and_expression
        let expr = this._and_expression();
        while (this._match(TokenTypes.tokens.xor)) {
            expr = new BinaryOperator(this._previous().toString(), expr, this._and_expression());
        }
        return expr;
    }
    _and_expression() {
        // equality_expression
        // and_expression and equality_expression
        let expr = this._equality_expression();
        while (this._match(TokenTypes.tokens.and)) {
            expr = new BinaryOperator(this._previous().toString(), expr, this._equality_expression());
        }
        return expr;
    }
    _equality_expression() {
        // relational_expression
        // relational_expression equal_equal relational_expression
        // relational_expression not_equal relational_expression
        const expr = this._relational_expression();
        if (this._match([TokenTypes.tokens.equal_equal, TokenTypes.tokens.not_equal])) {
            return new BinaryOperator(this._previous().toString(), expr, this._relational_expression());
        }
        return expr;
    }
    _relational_expression() {
        // shift_expression
        // relational_expression less_than shift_expression
        // relational_expression greater_than shift_expression
        // relational_expression less_than_equal shift_expression
        // relational_expression greater_than_equal shift_expression
        let expr = this._shift_expression();
        while (this._match([
            TokenTypes.tokens.less_than,
            TokenTypes.tokens.greater_than,
            TokenTypes.tokens.less_than_equal,
            TokenTypes.tokens.greater_than_equal,
        ])) {
            expr = new BinaryOperator(this._previous().toString(), expr, this._shift_expression());
        }
        return expr;
    }
    _shift_expression() {
        // additive_expression
        // shift_expression shift_left additive_expression
        // shift_expression shift_right additive_expression
        let expr = this._additive_expression();
        while (this._match([TokenTypes.tokens.shift_left, TokenTypes.tokens.shift_right])) {
            expr = new BinaryOperator(this._previous().toString(), expr, this._additive_expression());
        }
        return expr;
    }
    _additive_expression() {
        // multiplicative_expression
        // additive_expression plus multiplicative_expression
        // additive_expression minus multiplicative_expression
        let expr = this._multiplicative_expression();
        while (this._match([TokenTypes.tokens.plus, TokenTypes.tokens.minus])) {
            expr = new BinaryOperator(this._previous().toString(), expr, this._multiplicative_expression());
        }
        return expr;
    }
    _multiplicative_expression() {
        // unary_expression
        // multiplicative_expression star unary_expression
        // multiplicative_expression forward_slash unary_expression
        // multiplicative_expression modulo unary_expression
        let expr = this._unary_expression();
        while (this._match([
            TokenTypes.tokens.star,
            TokenTypes.tokens.forward_slash,
            TokenTypes.tokens.modulo,
        ])) {
            expr = new BinaryOperator(this._previous().toString(), expr, this._unary_expression());
        }
        return expr;
    }
    _unary_expression() {
        // singular_expression
        // minus unary_expression
        // bang unary_expression
        // tilde unary_expression
        // star unary_expression
        // and unary_expression
        if (this._match([
            TokenTypes.tokens.minus,
            TokenTypes.tokens.bang,
            TokenTypes.tokens.tilde,
            TokenTypes.tokens.star,
            TokenTypes.tokens.and,
        ])) {
            return new UnaryOperator(this._previous().toString(), this._unary_expression());
        }
        return this._singular_expression();
    }
    _singular_expression() {
        // primary_expression postfix_expression ?
        const expr = this._primary_expression();
        const p = this._postfix_expression();
        if (p)
            expr.postfix = p;
        return expr;
    }
    _postfix_expression() {
        // bracket_left short_circuit_or_expression bracket_right postfix_expression?
        if (this._match(TokenTypes.tokens.bracket_left)) {
            const expr = this._short_circuit_or_expression();
            this._consume(TokenTypes.tokens.bracket_right, "Expected ']'.");
            const p = this._postfix_expression();
            if (p)
                expr.postfix = p;
            return expr;
        }
        // period ident postfix_expression?
        if (this._match(TokenTypes.tokens.period)) {
            const name = this._consume(TokenTypes.tokens.ident, "Expected member name.");
            const p = this._postfix_expression();
            const expr = new StringExpr(name.lexeme);
            if (p)
                expr.postfix = p;
            return expr;
        }
        return null;
    }
    _getStruct(name) {
        if (this._context.aliases.has(name)) {
            const alias = this._context.aliases.get(name).type;
            return alias;
        }
        if (this._context.structs.has(name)) {
            const struct = this._context.structs.get(name);
            return struct;
        }
        return null;
    }
    _primary_expression() {
        // ident argument_expression_list?
        if (this._match(TokenTypes.tokens.ident)) {
            const name = this._previous().toString();
            if (this._check(TokenTypes.tokens.paren_left)) {
                const args = this._argument_expression_list();
                const struct = this._getStruct(name);
                if (struct != null) {
                    return new CreateExpr(struct, args);
                }
                return new CallExpr(name, args);
            }
            if (this._context.constants.has(name)) {
                const c = this._context.constants.get(name);
                return new ConstExpr(name, c.value);
            }
            return new VariableExpr(name);
        }
        // const_literal
        if (this._match(TokenTypes.const_literal)) {
            return new LiteralExpr(parseFloat(this._previous().toString()));
        }
        // paren_expression
        if (this._check(TokenTypes.tokens.paren_left)) {
            return this._paren_expression();
        }
        // bitcast less_than type_decl greater_than paren_expression
        if (this._match(TokenTypes.keywords.bitcast)) {
            this._consume(TokenTypes.tokens.less_than, "Expected '<'.");
            const type = this._type_decl();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>'.");
            const value = this._paren_expression();
            return new BitcastExpr(type, value);
        }
        // type_decl argument_expression_list
        const type = this._type_decl();
        const args = this._argument_expression_list();
        return new TypecastExpr(type, args);
    }
    _argument_expression_list() {
        // paren_left ((short_circuit_or_expression comma)* short_circuit_or_expression comma?)? paren_right
        if (!this._match(TokenTypes.tokens.paren_left))
            return null;
        const args = [];
        do {
            if (this._check(TokenTypes.tokens.paren_right))
                break;
            const arg = this._short_circuit_or_expression();
            args.push(arg);
        } while (this._match(TokenTypes.tokens.comma));
        this._consume(TokenTypes.tokens.paren_right, "Expected ')' for agument list");
        return args;
    }
    _optional_paren_expression() {
        // [paren_left] short_circuit_or_expression [paren_right]
        this._match(TokenTypes.tokens.paren_left);
        const expr = this._short_circuit_or_expression();
        this._match(TokenTypes.tokens.paren_right);
        return new GroupingExpr([expr]);
    }
    _paren_expression() {
        // paren_left short_circuit_or_expression paren_right
        this._consume(TokenTypes.tokens.paren_left, "Expected '('.");
        const expr = this._short_circuit_or_expression();
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'.");
        return new GroupingExpr([expr]);
    }
    _struct_decl() {
        // attribute* struct ident struct_body_decl
        if (!this._match(TokenTypes.keywords.struct))
            return null;
        const name = this._consume(TokenTypes.tokens.ident, "Expected name for struct.").toString();
        // struct_body_decl: brace_left (struct_member comma)* struct_member comma? brace_right
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for struct body.");
        const members = [];
        while (!this._check(TokenTypes.tokens.brace_right)) {
            // struct_member: attribute* variable_ident_decl
            const memberAttrs = this._attribute();
            const memberName = this._consume(TokenTypes.tokens.ident, "Expected variable name.").toString();
            this._consume(TokenTypes.tokens.colon, "Expected ':' for struct member type.");
            const typeAttrs = this._attribute();
            const memberType = this._type_decl();
            if (memberType != null)
                memberType.attributes = typeAttrs;
            if (!this._check(TokenTypes.tokens.brace_right))
                this._consume(TokenTypes.tokens.comma, "Expected ',' for struct member.");
            else
                this._match(TokenTypes.tokens.comma); // trailing comma optional.
            members.push(new Member(memberName, memberType, memberAttrs));
        }
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' after struct body.");
        const structNode = new Struct(name, members);
        this._context.structs.set(name, structNode);
        return structNode;
    }
    _global_variable_decl() {
        // attribute* variable_decl (equal const_expression)?
        const _var = this._variable_decl();
        if (_var && this._match(TokenTypes.tokens.equal))
            _var.value = this._const_expression();
        return _var;
    }
    _global_const_decl() {
        // attribute* const (ident variable_ident_decl) global_const_initializer?
        if (!this._match(TokenTypes.keywords.const))
            return null;
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null)
                type.attributes = attrs;
        }
        let value = null;
        if (this._match(TokenTypes.tokens.equal)) {
            let valueExpr = this._short_circuit_or_expression();
            if (valueExpr instanceof CreateExpr) {
                value = valueExpr;
            }
            else if (valueExpr instanceof ConstExpr &&
                valueExpr.initializer instanceof CreateExpr) {
                value = valueExpr.initializer;
            }
            else {
                let constValue = valueExpr.evaluate(this._context);
                value = new LiteralExpr(constValue);
            }
        }
        const c = new Const(name.toString(), type, "", "", value);
        this._context.constants.set(c.name, c);
        return c;
    }
    _global_let_decl() {
        // attribute* let (ident variable_ident_decl) global_const_initializer?
        if (!this._match(TokenTypes.keywords.let))
            return null;
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null)
                type.attributes = attrs;
        }
        let value = null;
        if (this._match(TokenTypes.tokens.equal)) {
            value = this._const_expression();
        }
        return new Let(name.toString(), type, "", "", value);
    }
    _const_expression() {
        // type_decl paren_left ((const_expression comma)* const_expression comma?)? paren_right
        // const_literal
        if (this._match(TokenTypes.const_literal))
            return new StringExpr(this._previous().toString());
        const type = this._type_decl();
        this._consume(TokenTypes.tokens.paren_left, "Expected '('.");
        let args = [];
        while (!this._check(TokenTypes.tokens.paren_right)) {
            args.push(this._const_expression());
            if (!this._check(TokenTypes.tokens.comma))
                break;
            this._advance();
        }
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'.");
        return new CreateExpr(type, args);
    }
    _variable_decl() {
        // var variable_qualifier? (ident variable_ident_decl)
        if (!this._match(TokenTypes.keywords.var))
            return null;
        // variable_qualifier: less_than storage_class (comma access_mode)? greater_than
        let storage = "";
        let access = "";
        if (this._match(TokenTypes.tokens.less_than)) {
            storage = this._consume(TokenTypes.storage_class, "Expected storage_class.").toString();
            if (this._match(TokenTypes.tokens.comma))
                access = this._consume(TokenTypes.access_mode, "Expected access_mode.").toString();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>'.");
        }
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null)
                type.attributes = attrs;
        }
        return new Var(name.toString(), type, storage, access, null);
    }
    _enable_directive() {
        // enable ident semicolon
        const name = this._consume(TokenTypes.tokens.ident, "identity expected.");
        return new Enable(name.toString());
    }
    _type_alias() {
        // type ident equal type_decl
        const name = this._consume(TokenTypes.tokens.ident, "identity expected.");
        this._consume(TokenTypes.tokens.equal, "Expected '=' for type alias.");
        let aliasType = this._type_decl();
        if (aliasType === null) {
            throw this._error(this._peek(), "Expected Type for Alias.");
        }
        if (this._context.aliases.has(aliasType.name)) {
            aliasType = this._context.aliases.get(aliasType.name).type;
        }
        const aliasNode = new Alias(name.toString(), aliasType);
        this._context.aliases.set(aliasNode.name, aliasNode);
        return aliasNode;
    }
    _type_decl() {
        // ident
        // bool
        // float32
        // int32
        // uint32
        // vec2 less_than type_decl greater_than
        // vec3 less_than type_decl greater_than
        // vec4 less_than type_decl greater_than
        // mat2x2 less_than type_decl greater_than
        // mat2x3 less_than type_decl greater_than
        // mat2x4 less_than type_decl greater_than
        // mat3x2 less_than type_decl greater_than
        // mat3x3 less_than type_decl greater_than
        // mat3x4 less_than type_decl greater_than
        // mat4x2 less_than type_decl greater_than
        // mat4x3 less_than type_decl greater_than
        // mat4x4 less_than type_decl greater_than
        // atomic less_than type_decl greater_than
        // pointer less_than storage_class comma type_decl (comma access_mode)? greater_than
        // array_type_decl
        // texture_sampler_types
        if (this._check([
            TokenTypes.tokens.ident,
            ...TokenTypes.texel_format,
            TokenTypes.keywords.bool,
            TokenTypes.keywords.f32,
            TokenTypes.keywords.i32,
            TokenTypes.keywords.u32,
        ])) {
            const type = this._advance();
            return new Type(type.toString());
        }
        if (this._check(TokenTypes.template_types)) {
            let type = this._advance().toString();
            let format = null;
            let access = null;
            if (this._match(TokenTypes.tokens.less_than)) {
                format = this._type_decl();
                access = null;
                if (this._match(TokenTypes.tokens.comma))
                    access = this._consume(TokenTypes.access_mode, "Expected access_mode for pointer").toString();
                this._consume(TokenTypes.tokens.greater_than, "Expected '>' for type.");
            }
            return new TemplateType(type, format, access);
        }
        // pointer less_than storage_class comma type_decl (comma access_mode)? greater_than
        if (this._match(TokenTypes.keywords.ptr)) {
            let pointer = this._previous().toString();
            this._consume(TokenTypes.tokens.less_than, "Expected '<' for pointer.");
            const storage = this._consume(TokenTypes.storage_class, "Expected storage_class for pointer");
            this._consume(TokenTypes.tokens.comma, "Expected ',' for pointer.");
            const decl = this._type_decl();
            let access = null;
            if (this._match(TokenTypes.tokens.comma))
                access = this._consume(TokenTypes.access_mode, "Expected access_mode for pointer").toString();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>' for pointer.");
            return new PointerType(pointer, storage.toString(), decl, access);
        }
        // texture_sampler_types
        let type = this._texture_sampler_types();
        if (type)
            return type;
        // The following type_decl's have an optional attribyte_list*
        const attrs = this._attribute();
        // attribute* array
        // attribute* array less_than type_decl (comma element_count_expression)? greater_than
        if (this._match(TokenTypes.keywords.array)) {
            let format = null;
            let countInt = -1;
            const array = this._previous();
            if (this._match(TokenTypes.tokens.less_than)) {
                format = this._type_decl();
                if (this._context.aliases.has(format.name)) {
                    format = this._context.aliases.get(format.name).type;
                }
                let count = "";
                if (this._match(TokenTypes.tokens.comma)) {
                    let c = this._shift_expression();
                    count = c.evaluate(this._context).toString();
                }
                this._consume(TokenTypes.tokens.greater_than, "Expected '>' for array.");
                countInt = count ? parseInt(count) : 0;
            }
            return new ArrayType(array.toString(), attrs, format, countInt);
        }
        return null;
    }
    _texture_sampler_types() {
        // sampler_type
        if (this._match(TokenTypes.sampler_type))
            return new SamplerType(this._previous().toString(), null, null);
        // depth_texture_type
        if (this._match(TokenTypes.depth_texture_type))
            return new SamplerType(this._previous().toString(), null, null);
        // sampled_texture_type less_than type_decl greater_than
        // multisampled_texture_type less_than type_decl greater_than
        if (this._match(TokenTypes.sampled_texture_type) ||
            this._match(TokenTypes.multisampled_texture_type)) {
            const sampler = this._previous();
            this._consume(TokenTypes.tokens.less_than, "Expected '<' for sampler type.");
            const format = this._type_decl();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>' for sampler type.");
            return new SamplerType(sampler.toString(), format, null);
        }
        // storage_texture_type less_than texel_format comma access_mode greater_than
        if (this._match(TokenTypes.storage_texture_type)) {
            const sampler = this._previous();
            this._consume(TokenTypes.tokens.less_than, "Expected '<' for sampler type.");
            const format = this._consume(TokenTypes.texel_format, "Invalid texel format.").toString();
            this._consume(TokenTypes.tokens.comma, "Expected ',' after texel format.");
            const access = this._consume(TokenTypes.access_mode, "Expected access mode for storage texture type.").toString();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>' for sampler type.");
            return new SamplerType(sampler.toString(), format, access);
        }
        return null;
    }
    _attribute() {
        // attr ident paren_left (literal_or_ident comma)* literal_or_ident paren_right
        // attr ident
        let attributes = [];
        while (this._match(TokenTypes.tokens.attr)) {
            const name = this._consume(TokenTypes.attribute_name, "Expected attribute name");
            const attr = new Attribute(name.toString(), null);
            if (this._match(TokenTypes.tokens.paren_left)) {
                // literal_or_ident
                attr.value = this._consume(TokenTypes.literal_or_ident, "Expected attribute value").toString();
                if (this._check(TokenTypes.tokens.comma)) {
                    this._advance();
                    do {
                        const v = this._consume(TokenTypes.literal_or_ident, "Expected attribute value").toString();
                        if (!(attr.value instanceof Array)) {
                            attr.value = [attr.value];
                        }
                        attr.value.push(v);
                    } while (this._match(TokenTypes.tokens.comma));
                }
                this._consume(TokenTypes.tokens.paren_right, "Expected ')'");
            }
            attributes.push(attr);
        }
        // Deprecated:
        // attr_left (attribute comma)* attribute attr_right
        while (this._match(TokenTypes.tokens.attr_left)) {
            if (!this._check(TokenTypes.tokens.attr_right)) {
                do {
                    const name = this._consume(TokenTypes.attribute_name, "Expected attribute name");
                    const attr = new Attribute(name.toString(), null);
                    if (this._match(TokenTypes.tokens.paren_left)) {
                        // literal_or_ident
                        attr.value = [
                            this._consume(TokenTypes.literal_or_ident, "Expected attribute value").toString(),
                        ];
                        if (this._check(TokenTypes.tokens.comma)) {
                            this._advance();
                            do {
                                const v = this._consume(TokenTypes.literal_or_ident, "Expected attribute value").toString();
                                attr.value.push(v);
                            } while (this._match(TokenTypes.tokens.comma));
                        }
                        this._consume(TokenTypes.tokens.paren_right, "Expected ')'");
                    }
                    attributes.push(attr);
                } while (this._match(TokenTypes.tokens.comma));
            }
            // Consume ]]
            this._consume(TokenTypes.tokens.attr_right, "Expected ']]' after attribute declarations");
        }
        if (attributes.length == 0)
            return null;
        return attributes;
    }
}

/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
class VariableInfo {
    constructor(node, group, binding) {
        this.group = group;
        this.binding = binding;
        this.node = node;
    }
    get name() {
        return this.node.name;
    }
    get type() {
        return this.node.type;
    }
    get attributes() {
        return this.node.attributes;
    }
}
class FunctionInfo {
    constructor(node) {
        this.inputs = [];
        this.node = node;
    }
    get name() {
        return this.node.name;
    }
    get returnType() {
        return this.node.returnType;
    }
    get args() {
        return this.node.args;
    }
    get attributes() {
        return this.node.attributes;
    }
}
class InputInfo {
    constructor(name, type, input, locationType, location) {
        this.name = name;
        this.type = type;
        this.input = input;
        this.locationType = locationType;
        this.location = location;
        this.interpolation = this.interpolation;
    }
}
class MemberInfo {
}
class TypeInfo {
    constructor(align, size) {
        this.align = align;
        this.size = size;
    }
}
class BufferInfo extends TypeInfo {
    constructor(name, type) {
        super(0, 0);
        this.name = name;
        this.type = type;
    }
}
class BindGropEntry {
    constructor(type, resource) {
        this.type = type;
        this.resource = resource;
    }
}
class EntryFunctions {
    constructor() {
        this.vertex = [];
        this.fragment = [];
        this.compute = [];
    }
}
class WgslReflect {
    constructor(code) {
        /// All top-level structs in the shader.
        this.structs = [];
        /// All top-level uniform vars in the shader.
        this.uniforms = [];
        /// All top-level storage vars in the shader.
        this.storage = [];
        /// All top-level texture vars in the shader;
        this.textures = [];
        // All top-level sampler vars in the shader.
        this.samplers = [];
        /// All top-level functions in the shader.
        this.functions = [];
        /// All top-level type aliases in the shader.
        this.aliases = [];
        if (code)
            this.initialize(code);
    }
    initialize(code) {
        const parser = new WgslParser();
        this.ast = parser.parse(code);
        this.entry = new EntryFunctions();
        for (const node of this.ast) {
            if (node.astNodeType == "struct")
                this.structs.push(node);
            if (node.astNodeType == "alias")
                this.aliases.push(node);
            if (this.isUniformVar(node)) {
                const v = node;
                const g = this.getAttributeNum(node, "group", 0);
                const b = this.getAttributeNum(node, "binding", 0);
                this.uniforms.push(new VariableInfo(v, g, b));
            }
            if (this.isStorageVar(node)) {
                const v = node;
                const g = this.getAttributeNum(node, "group", 0);
                const b = this.getAttributeNum(node, "binding", 0);
                this.storage.push(new VariableInfo(v, g, b));
            }
            if (this.isTextureVar(node)) {
                const v = node;
                const g = this.getAttributeNum(node, "group", 0);
                const b = this.getAttributeNum(node, "binding", 0);
                this.textures.push(new VariableInfo(v, g, b));
            }
            if (this.isSamplerVar(node)) {
                const v = node;
                const g = this.getAttributeNum(node, "group", 0);
                const b = this.getAttributeNum(node, "binding", 0);
                this.samplers.push(new VariableInfo(v, g, b));
            }
            if (node instanceof Function) {
                const fn = new FunctionInfo(node);
                fn.inputs = this._getInputs(node.args);
                this.functions.push(fn);
                const vertexStage = this.getAttribute(node, "vertex");
                const fragmentStage = this.getAttribute(node, "fragment");
                const computeStage = this.getAttribute(node, "compute");
                const stage = vertexStage || fragmentStage || computeStage;
                if (stage) {
                    this.entry[stage.name].push(fn);
                }
            }
        }
    }
    isTextureVar(node) {
        return (node instanceof Var &&
            node.type !== null &&
            WgslReflect.textureTypes.indexOf(node.type.name) != -1);
    }
    isSamplerVar(node) {
        return (node instanceof Var &&
            node.type !== null &&
            WgslReflect.samplerTypes.indexOf(node.type.name) != -1);
    }
    isUniformVar(node) {
        return node instanceof Var && node.storage == "uniform";
    }
    isStorageVar(node) {
        return node instanceof Var && node.storage == "storage";
    }
    getAttributeNum(node, name, defaultValue) {
        const a = this.getAttribute(node, name);
        if (a == null) {
            return defaultValue;
        }
        let v = a !== null && a.value !== null ? a.value : defaultValue;
        if (v instanceof Array) {
            v = v[0];
        }
        if (typeof v === "number") {
            return v;
        }
        if (typeof v === "string") {
            return parseInt(v);
        }
        return defaultValue;
    }
    getAttribute(node, name) {
        const obj = node;
        if (!obj || !obj["attributes"])
            return null;
        const attrs = obj["attributes"];
        for (let a of attrs) {
            if (a.name == name)
                return a;
        }
        return null;
    }
    _getInputs(args, inputs = undefined) {
        if (inputs === undefined)
            inputs = [];
        for (const arg of args) {
            const input = this._getInputInfo(arg);
            if (input !== null)
                inputs.push(input);
            const struct = this.getStruct(arg.type);
            if (struct)
                this._getInputs(struct.members, inputs);
        }
        return inputs;
    }
    _getInputInfo(node) {
        const location = this.getAttribute(node, "location") || this.getAttribute(node, "builtin");
        if (location !== null) {
            const interpolation = this.getAttribute(node, "interpolation");
            const info = new InputInfo(node.name, node.type, node, location.name, this._parseInt(location.value));
            if (interpolation !== null) {
                info.interpolation = this._parseString(interpolation.value);
            }
            return info;
        }
        return null;
    }
    _parseString(s) {
        if (s instanceof Array) {
            s = s[0];
        }
        return s;
    }
    _parseInt(s) {
        if (s instanceof Array) {
            s = s[0];
        }
        const n = parseInt(s);
        return isNaN(n) ? s : n;
    }
    getStruct(name) {
        if (name === null)
            return null;
        if (name instanceof Struct)
            return name;
        name = this.getAlias(name) || name;
        if (name instanceof Type) {
            name = name.name;
        }
        for (const u of this.structs) {
            if (u.name == name)
                return u;
        }
        return null;
    }
    getAlias(type) {
        if (type === null)
            return null;
        if (type instanceof Node) {
            if (!(type instanceof Type)) {
                return null;
            }
            type = type.name;
        }
        for (const u of this.aliases) {
            if (u.name == type)
                return this.getAlias(u.type) || u.type;
        }
        return null;
    }
    getBindGroups() {
        const groups = [];
        function _makeRoom(group, binding) {
            if (group >= groups.length)
                groups.length = group + 1;
            if (groups[group] === undefined)
                groups[group] = [];
            if (binding >= groups[group].length)
                groups[group].length = binding + 1;
        }
        for (const u of this.uniforms) {
            _makeRoom(u.group, u.binding);
            const group = groups[u.group];
            group[u.binding] = new BindGropEntry("buffer", this.getUniformBufferInfo(u));
        }
        for (const u of this.storage) {
            _makeRoom(u.group, u.binding);
            const group = groups[u.group];
            group[u.binding] = new BindGropEntry("storage", this.getStorageBufferInfo(u));
        }
        for (const t of this.textures) {
            _makeRoom(t.group, t.binding);
            const group = groups[t.group];
            group[t.binding] = new BindGropEntry("texture", t);
        }
        for (const t of this.samplers) {
            _makeRoom(t.group, t.binding);
            const group = groups[t.group];
            group[t.binding] = new BindGropEntry("sampler", t);
        }
        return groups;
    }
    getStorageBufferInfo(node) {
        if (node instanceof VariableInfo) {
            node = node.node;
        }
        if (!this.isStorageVar(node))
            return null;
        const group = this.getAttributeNum(node, "group", 0);
        const binding = this.getAttributeNum(node, "binding", 0);
        const info = this._getUniformInfo(node);
        info.group = group;
        info.binding = binding;
        return info;
    }
    /// Returns information about a struct type, null if the type is not a struct.
    getStructInfo(node) {
        var _a, _b, _c, _d, _e;
        if (node === null)
            return null;
        const struct = node instanceof Struct ? node : this.getStruct(node.type);
        if (!struct)
            return null;
        let offset = 0;
        let lastSize = 0;
        let lastOffset = 0;
        let structAlign = 0;
        let buffer = new BufferInfo(node.name, node instanceof Var ? node.type : null);
        buffer.members = [];
        for (let mi = 0, ml = struct.members.length; mi < ml; ++mi) {
            const member = struct.members[mi];
            const name = member.name;
            const info = this.getTypeInfo(member);
            if (!info)
                continue;
            const type = this.getAlias(member.type) || member.type;
            const align = info.align;
            const size = info.size;
            offset = this._roundUp(align, offset + lastSize);
            lastSize = size;
            lastOffset = offset;
            structAlign = Math.max(structAlign, align);
            const isArray = member.type.astNodeType === "array";
            const s = this.getStruct(type) ||
                (isArray ? this.getStruct((_a = type["format"]) === null || _a === void 0 ? void 0 : _a.name) : null);
            const isStruct = !!s;
            const si = isStruct ? this.getStructInfo(s) : undefined;
            const arrayStride = ((_b = si === null || si === void 0 ? void 0 : si.size) !== null && _b !== void 0 ? _b : isArray)
                ? (_c = this.getTypeInfo(type["format"])) === null || _c === void 0 ? void 0 : _c.size
                : (_d = this.getTypeInfo(member.type)) === null || _d === void 0 ? void 0 : _d.size;
            const arrayCount = (_e = member.type["count"]) !== null && _e !== void 0 ? _e : 0;
            const members = isStruct ? si === null || si === void 0 ? void 0 : si.members : undefined;
            const u = new MemberInfo();
            u.node = member;
            u.name = name;
            u.offset = offset;
            u.size = size;
            u.type = type;
            u.isArray = isArray;
            u.arrayCount = arrayCount;
            u.arrayStride = arrayStride;
            u.isStruct = isStruct;
            u.members = members;
            buffer.members.push(u);
        }
        buffer.size = this._roundUp(structAlign, lastOffset + lastSize);
        buffer.align = structAlign;
        buffer.isArray = false;
        buffer.isStruct = true;
        buffer.arrayCount = 0;
        return buffer;
    }
    _getUniformInfo(node) {
        var _a, _b, _c, _d, _e;
        const structInfo = this.getStructInfo(node);
        if (structInfo !== null)
            return structInfo;
        var n = node;
        const typeInfo = this.getTypeInfo(n.type);
        if (typeInfo === null)
            return null;
        const type = this.getAlias(n.type) || n.type;
        const info = new BufferInfo(node.name, type);
        info.align = typeInfo.align;
        info.size = typeInfo.size;
        let s = this.getStruct((_a = type["format"]) === null || _a === void 0 ? void 0 : _a.name);
        let si = s ? this.getStructInfo(s) : undefined;
        info.isArray = type.astNodeType === "array";
        info.isStruct = !!s;
        info.members = info.isStruct ? si === null || si === void 0 ? void 0 : si.members : undefined;
        info.name = n.name;
        info.type = type;
        info.arrayStride =
            ((_b = si === null || si === void 0 ? void 0 : si.size) !== null && _b !== void 0 ? _b : info.isArray)
                ? (_c = this.getTypeInfo(type["format"])) === null || _c === void 0 ? void 0 : _c.size
                : (_d = this.getTypeInfo(type)) === null || _d === void 0 ? void 0 : _d.size;
        info.arrayCount = parseInt((_e = type["count"]) !== null && _e !== void 0 ? _e : 0);
        return info;
    }
    getUniformBufferInfo(uniform) {
        if (!this.isUniformVar(uniform.node))
            return null;
        const info = this._getUniformInfo(uniform.node);
        info.group = uniform.group;
        info.binding = uniform.binding;
        return info;
    }
    getTypeInfo(type) {
        var _a;
        if (type === null || type === undefined)
            return null;
        const explicitSize = this.getAttributeNum(type, "size", 0);
        const explicitAlign = this.getAttributeNum(type, "align", 0);
        if (type instanceof Member)
            type = type.type;
        if (type instanceof Type) {
            const alias = this.getAlias(type.name);
            if (alias !== null) {
                type = alias;
            }
            const struct = this.getStruct(type.name);
            if (struct !== null)
                type = struct;
        }
        {
            const info = WgslReflect.typeInfo[type.name];
            if (info !== undefined) {
                const divisor = type["format"] === "f16" ? 2 : 1;
                return new TypeInfo(Math.max(explicitAlign, info.align / divisor), Math.max(explicitSize, info.size / divisor));
            }
        }
        {
            const info = WgslReflect.typeInfo[type.name.substring(0, type.name.length - 1)];
            if (info) {
                const divisor = type.name[type.name.length - 1] === "h" ? 2 : 1;
                return new TypeInfo(Math.max(explicitAlign, info.align / divisor), Math.max(explicitSize, info.size / divisor));
            }
        }
        if (type.name == "array") {
            let align = 8;
            let size = 8;
            // Type                 AlignOf(T)          Sizeof(T)
            // array<E, N>          AlignOf(E)          N * roundUp(AlignOf(E), SizeOf(E))
            // array<E>             AlignOf(E)          N * roundUp(AlignOf(E), SizeOf(E))  (N determined at runtime)
            //
            // @stride(Q)
            // array<E, N>          AlignOf(E)          N * Q
            //
            // @stride(Q)
            // array<E>             AlignOf(E)          Nruntime * Q
            //const E = type.format.name;
            const E = this.getTypeInfo(type["format"]);
            if (E !== null) {
                size = E.size;
                align = E.align;
            }
            const N = parseInt((_a = type["count"]) !== null && _a !== void 0 ? _a : 1);
            const stride = this.getAttributeNum(type, "stride", this._roundUp(align, size));
            size = N * stride;
            if (explicitSize)
                size = explicitSize;
            return new TypeInfo(Math.max(explicitAlign, align), Math.max(explicitSize, size));
        }
        if (type instanceof Struct) {
            let align = 0;
            let size = 0;
            // struct S     AlignOf:    max(AlignOfMember(S, M1), ... , AlignOfMember(S, MN))
            //              SizeOf:     roundUp(AlignOf(S), OffsetOfMember(S, L) + SizeOfMember(S, L))
            //                          Where L is the last member of the structure
            let offset = 0;
            let lastSize = 0;
            let lastOffset = 0;
            for (const m of type.members) {
                const mi = this.getTypeInfo(m);
                align = Math.max(mi.align, align);
                offset = this._roundUp(mi.align, offset + lastSize);
                lastSize = mi.size;
                lastOffset = offset;
            }
            size = this._roundUp(align, lastOffset + lastSize);
            return new TypeInfo(Math.max(explicitAlign, align), Math.max(explicitSize, size));
        }
        return null;
    }
    _roundUp(k, n) {
        return Math.ceil(n / k) * k;
    }
}
// Type                 AlignOf(T)          Sizeof(T)
// i32, u32, or f32     4                   4
// atomic<T>            4                   4
// vec2<T>              8                   8
// vec3<T>              16                  12
// vec4<T>              16                  16
// mat2x2<f32>          8                   16
// mat3x2<f32>          8                   24
// mat4x2<f32>          8                   32
// mat2x3<f32>          16                  32
// mat3x3<f32>          16                  48
// mat4x3<f32>          16                  64
// mat2x4<f32>          16                  32
// mat3x4<f32>          16                  48
// mat4x4<f32>          16                  64
WgslReflect.typeInfo = {
    f16: { align: 2, size: 2 },
    i32: { align: 4, size: 4 },
    u32: { align: 4, size: 4 },
    f32: { align: 4, size: 4 },
    atomic: { align: 4, size: 4 },
    vec2: { align: 8, size: 8 },
    vec3: { align: 16, size: 12 },
    vec4: { align: 16, size: 16 },
    mat2x2: { align: 8, size: 16 },
    mat3x2: { align: 8, size: 24 },
    mat4x2: { align: 8, size: 32 },
    mat2x3: { align: 16, size: 32 },
    mat3x3: { align: 16, size: 48 },
    mat4x3: { align: 16, size: 64 },
    mat2x4: { align: 16, size: 32 },
    mat3x4: { align: 16, size: 48 },
    mat4x4: { align: 16, size: 64 },
};
WgslReflect.textureTypes = TokenTypes.any_texture_type.map((t) => {
    return t.name;
});
WgslReflect.samplerTypes = TokenTypes.sampler_type.map((t) => {
    return t.name;
});

/**
 * Given a WGSL shader, returns data definitions for structures,
 * uniforms, and storage buffers
 *
 * Example:
 *
 * ```js
 * const code = `
 * struct MyStruct {
 *    color: vec4<f32>,
 *    brightness: f32,
 *    kernel: array<f32, 9>,
 * };
 * @group(0) @binding(0) var<uniform> myUniforms: MyUniforms;
 * `;
 * const defs = makeShaderDataDefinitions(code);
 * const myUniformValues = makeStructuredView(defs.uniforms.myUniforms);
 *
 * myUniformValues.set({
 *   color: [1, 0, 1, 1],
 *   brightness: 0.8,
 *   kernel: [
 *      1, 0, -1,
 *      2, 0, -2,
 *      1, 0, -1,
 *   ],
 * });
 * device.queue.writeBuffer(uniformBuffer, 0, myUniformValues.arrayBuffer);
 * ```
 *
 * @param code WGSL shader. Note: it is not required for this to be a complete shader
 * @returns definitions of the structures by name. Useful for passing to {@link makeStructuredView}
 */
function makeShaderDataDefinitions(code) {
    const reflect = new WgslReflect(code);
    const structs = Object.fromEntries(reflect.structs.map(struct => {
        const info = reflect.getStructInfo(struct);
        return [struct.name, addMembers(reflect, info.members, info.size)];
    }));
    const uniforms = Object.fromEntries(reflect.uniforms.map(uniform => {
        const info = reflect.getUniformBufferInfo(uniform);
        const member = addMember(reflect, info, 0)[1];
        member.binding = info.binding;
        member.group = info.group;
        return [uniform.name, member];
    }));
    const storages = Object.fromEntries(reflect.storage.map(uniform => {
        const info = reflect.getStorageBufferInfo(uniform);
        const member = addMember(reflect, info, 0)[1];
        member.binding = info.binding;
        member.group = info.group;
        return [uniform.name, member];
    }));
    return {
        structs,
        storages,
        uniforms,
    };
}
function addMember(reflect, m, offset) {
    if (m.isArray) {
        if (m.isStruct) {
            return [
                m.name,
                new Array(m.arrayCount).fill(0).map((_, ndx) => {
                    return addMembers(reflect, m.members, m.size / m.arrayCount, offset + (m.offset || 0) + m.size / m.arrayCount * ndx);
                }),
            ];
        }
        else {
            return [
                m.name,
                {
                    offset: offset + (m.offset || 0),
                    size: m.size,
                    type: m.type.format.format
                        ? `${m.type.format.name}<${m.type.format.format.name}>`
                        : m.type.format.name,
                    numElements: m.arrayCount,
                },
            ];
        }
    }
    else if (m.isStruct) {
        return [
            m.name,
            addMembers(reflect, m.members, m.size, offset + (m.offset || 0)),
        ];
    }
    else {
        return [
            m.name,
            {
                offset: offset + (m.offset || 0),
                size: m.size,
                type: m.type?.format
                    ? `${m.type.name}<${m.type.format.name}>`
                    : m.type?.name || m.name,
            },
        ];
    }
}
function addMembers(reflect, members, size, offset = 0) {
    const fields = Object.fromEntries(members.map(m => {
        return addMember(reflect, m, offset);
    }));
    return {
        fields,
        size,
    };
}

function normalizeGPUExtent3Dict(size) {
    return [size.width, size.height || 1, size.depthOrArrayLayers || 1];
}
/**
 * Converts a `GPUExtent3D` into an array of numbers
 *
 * `GPUExtent3D` has two forms `[width, height?, depth?]` or
 * `{width: number, height?: number, depthOrArrayLayers?: number}`
 *
 * You pass one of those in here and it returns an array of 3 numbers
 * so that your code doesn't have to deal with multiple forms.
 *
 * @param size
 * @returns an array of 3 numbers, [width, height, depthOrArrayLayers]
 */
function normalizeGPUExtent3D(size) {
    return (Array.isArray(size) || isTypedArray(size))
        ? [...size, 1, 1].slice(0, 3)
        : normalizeGPUExtent3Dict(size);
}
/**
 * Given a GPUExtent3D returns the number of mip levels needed
 *
 * @param size
 * @returns number of mip levels needed for the given size
 */
function numMipLevels(size) {
    const sizes = normalizeGPUExtent3D(size);
    const maxSize = Math.max(...sizes);
    return 1 + Math.log2(maxSize) | 0;
}
// Use a WeakMap so the device can be destroyed and/or lost
const byDevice = new WeakMap();
/**
 * Generates mip levels from level 0 to the last mip for an existing texture
 *
 * The texture must have been created with TEXTURE_BINDING and
 * RENDER_ATTACHMENT and been created with mip levels
 *
 * @param device
 * @param texture
 */
function generateMipmap(device, texture) {
    let perDeviceInfo = byDevice.get(device);
    if (!perDeviceInfo) {
        perDeviceInfo = {
            pipelineByFormat: {},
        };
        byDevice.set(device, perDeviceInfo);
    }
    let { sampler, module, } = perDeviceInfo;
    const { pipelineByFormat, } = perDeviceInfo;
    if (!module) {
        module = device.createShaderModule({
            label: 'mip level generation',
            code: `
            struct VSOutput {
               @builtin(position) position: vec4f,
               @location(0) texcoord: vec2f,
            };

            @vertex fn vs(
               @builtin(vertex_index) vertexIndex : u32
            ) -> VSOutput {
               var pos = array<vec2f, 3>(
                  vec2f(-1.0, -1.0),
                  vec2f(-1.0,  3.0),
                  vec2f( 3.0, -1.0),
               );

               var vsOutput: VSOutput;
               let xy = pos[vertexIndex];
               vsOutput.position = vec4f(xy, 0.0, 1.0);
               vsOutput.texcoord = xy * vec2f(0.5, -0.5) + vec2f(0.5);
               return vsOutput;
            }

            @group(0) @binding(0) var ourSampler: sampler;
            @group(0) @binding(1) var ourTexture: texture_2d<f32>;

            @fragment fn fs(fsInput: VSOutput) -> @location(0) vec4f {
               return textureSample(ourTexture, ourSampler, fsInput.texcoord);
            }
         `,
        });
        sampler = device.createSampler({
            minFilter: 'linear',
        });
        perDeviceInfo.module = module;
        perDeviceInfo.sampler = sampler;
    }
    if (!pipelineByFormat[texture.format]) {
        pipelineByFormat[texture.format] = device.createRenderPipeline({
            label: 'mip level generator pipeline',
            layout: 'auto',
            vertex: {
                module,
                entryPoint: 'vs',
            },
            fragment: {
                module,
                entryPoint: 'fs',
                targets: [{ format: texture.format }],
            },
        });
    }
    const pipeline = pipelineByFormat[texture.format];
    const encoder = device.createCommandEncoder({
        label: 'mip gen encoder',
    });
    texture.width;
    texture.height;
    let nextMipLevel = 1;
    while (nextMipLevel < texture.mipLevelCount) {
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: sampler },
                { binding: 1, resource: texture.createView({ baseMipLevel: nextMipLevel - 1, mipLevelCount: 1 }) },
            ],
        });
        const renderPassDescriptor = {
            label: 'mip gen renderPass',
            colorAttachments: [
                {
                    view: texture.createView({ baseMipLevel: nextMipLevel, mipLevelCount: 1 }),
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
        const pass = encoder.beginRenderPass(renderPassDescriptor);
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        ++nextMipLevel;
    }
    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}

/**
 * Copies a "source" (Video, Canvas, OffscreenCanvas, ImageBitmap)
 * To a texture and then optional generates mip levels
 *
 * @param device
 * @param texture The texture to copy to
 * @param source The source to copy from
 * @param options use `{flipY: true}` if you want the source flipped
 */
function copySourceToTexture(device, texture, source, options = {}) {
    const { flipY } = options;
    device.queue.copyExternalImageToTexture({ source, flipY, }, { texture }, { width: source.width, height: source.height });
    if (texture.mipLevelCount > 1) {
        generateMipmap(device, texture);
    }
}
function getSizeFromSource(source) {
    if (source instanceof HTMLVideoElement) {
        return [source.videoWidth, source.videoHeight];
    }
    else {
        return [source.width, source.height];
    }
}
/**
 * Create a texture from a source (Video, Canvas, OffscreenCanvas, ImageBitmap)
 * and optionally create mip levels. If you set `mips: true` and don't set a mipLevelCount
 * then it will automatically make the correct number of mip levels.
 *
 * @param device
 * @param source
 * @param options
 * @returns the created Texture
 */
function createTextureFromSource(device, source, options = {}) {
    const size = getSizeFromSource(source);
    const texture = device.createTexture({
        format: options.format || 'rgba8unorm',
        mipLevelCount: options.mipLevelCount
            ? options.mipLevelCount
            : options.mips ? numMipLevels(size) : 1,
        size,
        usage: (options.usage ?? 0) |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    copySourceToTexture(device, texture, source, options);
    return texture;
}
/**
 * Load an ImageBitmap
 * @param url
 * @param options
 * @returns the loaded ImageBitmap
 */
async function loadImageBitmap(url, options = {}) {
    const res = await fetch(url);
    const blob = await res.blob();
    const opt = {
        ...options,
        ...(options.colorSpaceConversion !== undefined && { colorSpaceConversion: 'none' }),
    };
    return await createImageBitmap(blob, opt);
}
/**
 * Load an image and create a texture from it, optionally generating mip levels
 * @param device
 * @param url
 * @param options
 * @returns the texture created from the loaded image.
 */
async function createTextureFromImage(device, url, options = {}) {
    const imgBitmap = await loadImageBitmap(url);
    return createTextureFromSource(device, imgBitmap, options);
}

export { TypedArrayViewGenerator, copySourceToTexture, createTextureFromImage, createTextureFromSource, generateMipmap, getSizeFromSource, loadImageBitmap, makeShaderDataDefinitions, makeStructuredView, makeTypedArrayViews, normalizeGPUExtent3D, numMipLevels, setStructuredValues, setStructuredView };
//# sourceMappingURL=webgpu-utils.module.js.map

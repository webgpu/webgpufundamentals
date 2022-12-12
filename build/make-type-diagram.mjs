import { parse } from '@typescript-eslint/typescript-estree';
import fs from 'fs';

const code = fs.readFileSync('./node_modules/@webgpu/types/dist/index.d.ts', {encoding: 'utf-8'});
const ast = parse(code, {
  loc: true,
  range: true,
});

function getUnionTypes(typeAnnotation) {
  return typeAnnotation.types.map(type => {
    switch (type.type) {
      case 'TSTypeReference':
        return type.typeName.name;
      case 'TSFunctionType':
        return 'function';
      case 'TSNullKeyword':
        return 'null';
      case 'TSUndefinedKeyword':
        return 'undefined';
      default:
        throw new Error(type.type);
    }
  }).join(' | ');
}

ast.body.forEach(node => {
  console.log('------------------------------------------', node.type);
  switch (node.type) {
    case 'TSInterfaceDeclaration':
      console.log('  ', node.id.name);
      for (const part of node.body.body) {
        switch (part.type) {
          case 'TSPropertySignature': {
            if (part.key.name === '__brand') {
              continue;
            }
            const name = `${part.key.name}${part.optional ? '?' : ''}`;
            let type = '**-unknown-**';
            const typeAnnotation = part.typeAnnotation.typeAnnotation;
            switch (typeAnnotation.type) {
              case 'TSNumberKeyword':
                type = 'number';
                break;
              case 'TSTypeReference':
                type =  typeAnnotation.typeName.name;
                break;
              case 'TSBooleanKeyword':
                type = 'bool';
                break;
              case 'TSUnionType':
                type = getUnionTypes(typeAnnotation);
                break;
              case 'TSObjectKeyword':
                type = 'object**';
                break;
              case 'TSStringKeyword':
                type = 'string';
                break;
              case 'TSUndefinedKeyword':
                type = 'undefined';
                break;
              default:
                throw Error(typeAnnotation.type);
            }
            console.log('    ', `${name}: ${type}${part.readonly ? ' (readonly)' : ''}`);
            //console.log(JSON.stringify(part, null, 2));
            //process.exit(0);
            break;
          }
          case 'TSMethodSignature':
            break;
          default:
            throw new Error('f1');
        }
      }
      break;
    case 'TSTypeAliasDeclaration':
      console.log('  ', node.id.name);
      switch (node.typeAnnotation.type) {
        case 'TSUnionType': {
          for (const type of node.typeAnnotation.types) {
            switch (type.type) {
              case 'TSTypeReference':
                console.log('    ', type.typeName.name);
                break;
              case 'TSLiteralType':
                console.log('    ', type.literal.raw);
                break;
              default:
                throw Error(type.type);
            }
          }
          break;
        }
        case 'TSNumberKeyword':
          break;
        case 'TSTypeReference':
          console.log('    ', node.typeAnnotation.typeName.name);
          break;
        case 'TSLiteralType':
          console.log('    ', node.typeAnnotation.literal.raw);
          break;
        default:
          throw Error(node.typeAnnotation.type);
      }
      break;
    case 'VariableDeclaration':
      console.log('  ', node.kind, node.declarations[0].id.name);
      break;
    default:
      break;
  }
});

import { baselineVerdict, declarationFindings, pathFinding } from '../scripts/naming-guard';

test('flags ferry declarations, never references, keys or strings', () => {
  const source = [
    "import { FerryPrograms } from './resources/public/ferry-programs';",
    "import { useThing as useFerryThing } from './thing';",
    'const ferryCount = 1;',
    'function loadFerry(ferryId: string) { return ferryId; }',
    'type FerryShape = { ferryKey: string };',
    "const tool = { name: 'list_ferry_programs', path: '/v2/public/ferry/programs' };",
    'const { ferryProgramId } = args;',
    'new FerryPrograms(client);',
  ].join('\n');
  expect(declarationFindings('src/x.ts', source).map(({ name }) => name)).toEqual([
    'useFerryThing',
    'ferryCount',
    'loadFerry',
    'ferryId',
    'FerryShape',
    'ferryProgramId',
  ]);
});

test('flags every ferry file path', () => {
  expect(pathFinding('packages/mcp-server/src/migration-tools.ts')).toBeNull();
  expect(pathFinding('packages/mcp-server/src/ferry-tools.ts')).toContain('ferry-tools.ts');
});

test('ferry counts may only go down', () => {
  expect(baselineVerdict({ a: 2, b: 1 }, { a: 1 })).toEqual({ grew: ['a', 'b'], shrank: [] });
  expect(baselineVerdict({ a: 1 }, { a: 2, c: 1 })).toEqual({ grew: [], shrank: ['a', 'c'] });
  expect(baselineVerdict({ a: 1 }, { a: 1 })).toEqual({ grew: [], shrank: [] });
});

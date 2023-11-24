import terser from '@rollup/plugin-terser';

const input = './lib/index.js';
const sourcemap = true;

export default [
  {
    input,
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap,
    },
  },
  {
    input,
    output: {
      file: 'dist/tokml.umd.js',
      format: 'umd',
      name: 'tokml',
      sourcemap,
    },
    plugins: [terser()],
  },
];

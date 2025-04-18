import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import pkg from './package.json' assert { type: 'json' };

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        name: 'DailyVCSWebRenderer',
        file: pkg.browser,
        format: 'umd',
        sourcemap: true, // Add this line
      },
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true, // Add this line
      },
      {
        file: pkg.module,
        format: 'es',
        sourcemap: true, // Add this line
      },
    ],
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      terser(),
    ],
  },
];

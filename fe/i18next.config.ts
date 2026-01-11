import {defineConfig} from 'i18next-cli';

export default defineConfig({
  locales: ['en', 'fr', 'es', 'pt-BR'],
  extract: {
    input: 'src/**/*.{js,jsx,ts,tsx}',
    output: 'public/locales/{{language}}/{{namespace}}.json',
  },
});

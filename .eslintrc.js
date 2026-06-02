/**
 * Lint config for an n8n community node package.
 * Uses the n8n-nodes-base community ruleset required for Creator Portal verification.
 */
module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true,
    },
    ignorePatterns: ['dist/**', 'node_modules/**', 'examples/**', '*.js'],
    overrides: [
        {
            files: ['**/*.ts'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: ['./tsconfig.json'],
                sourceType: 'module',
                ecmaVersion: 2022,
            },
        },
        {
            files: ['package.json'],
            parser: 'jsonc-eslint-parser',
            plugins: ['eslint-plugin-n8n-nodes-base'],
            extends: ['plugin:n8n-nodes-base/community'],
            rules: {
                'n8n-nodes-base/community-package-json-name-still-default': 'off',
            },
        },
        {
            files: ['./credentials/**/*.ts'],
            plugins: ['eslint-plugin-n8n-nodes-base'],
            extends: ['plugin:n8n-nodes-base/credentials'],
            rules: {
                'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
            },
        },
        {
            files: ['./nodes/**/*.ts'],
            plugins: ['eslint-plugin-n8n-nodes-base'],
            extends: ['plugin:n8n-nodes-base/nodes'],
        },
    ],
};

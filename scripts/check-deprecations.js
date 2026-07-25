#!/usr/bin/env node
/**
 * Fails on the usage of deprecated APIs.
 *
 * `tsc` reports deprecations only as editor suggestions (TS6385, TS6387), so they are
 * collected here through the language service and reported as errors.
 */
const path = require('path');
const ts = require('typescript');

const projectDirectory = path.join(__dirname, '..');
const configPath = path.join(projectDirectory, 'tsconfig.json');

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error(ts.formatDiagnosticsWithColorAndContext([configFile.error], formatHost));
  process.exit(1);
}

const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectDirectory);

const formatHost = {
  getCanonicalFileName: fileName => fileName,
  getCurrentDirectory: () => projectDirectory,
  getNewLine: () => ts.sys.newLine
};

const languageServiceHost = {
  getScriptFileNames: () => parsedConfig.fileNames,
  getScriptVersion: () => '1',
  getScriptSnapshot: fileName => {
    const contents = ts.sys.readFile(fileName);
    return contents === undefined ? undefined : ts.ScriptSnapshot.fromString(contents);
  },
  getCurrentDirectory: () => projectDirectory,
  getCompilationSettings: () => parsedConfig.options,
  getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories
};

const languageService = ts.createLanguageService(languageServiceHost, ts.createDocumentRegistry());

const deprecations = parsedConfig.fileNames.reduce(
  (all, fileName) => all.concat(
    languageService.getSuggestionDiagnostics(fileName).filter(diagnostic => diagnostic.reportsDeprecated)
  ),
  []
);

if (deprecations.length === 0) {
  console.log('No deprecated API usage found.');
  process.exit(0);
}

// Suggestions are reported as errors, that's the whole point of this check.
const reportedAsErrors = deprecations.map(
  diagnostic => ({ ...diagnostic, category: ts.DiagnosticCategory.Error })
);

console.error(ts.formatDiagnosticsWithColorAndContext(reportedAsErrors, formatHost));
console.error(`Found ${deprecations.length} usage(s) of deprecated APIs.`);
process.exit(1);

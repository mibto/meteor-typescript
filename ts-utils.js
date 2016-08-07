"use strict";

const assert = require("assert");
const ts = require("typescript");
const _ = require("underscore");

const assertProps = require("./utils").assertProps;

// 1) Normalizes slashes in the file path
// 2) Removes file extension
function normalizePath(filePath) {
  var resultName = filePath;
  if (ts.fileExtensionIs(resultName, '.map')) {
    resultName = resultName.replace('.map', '');
  }
  return ts.removeFileExtension(
    ts.normalizeSlashes(resultName));
}

function prepareSourceMap(sourceMapContent, fileContent, sourceMapPath) {
  var sourceMapJson = JSON.parse(sourceMapContent);
  sourceMapJson.sourcesContent = [fileContent];
  sourceMapJson.sources = [sourceMapPath];
  return sourceMapJson;
}

function getReferences(sourceFile) {
  var modules = [];

  // Get resolved modules.
  if (sourceFile.resolvedModules) {
    for (var moduleName in sourceFile.resolvedModules) {
      var module = sourceFile.resolvedModules[moduleName];
      if (module && module.resolvedFileName) {
        modules.push(module.resolvedFileName);
      }
    }
  }

  // Get file references.
  var typings = [], files = [];
  if (sourceFile.referencedFiles) {
    var referencedPaths = sourceFile.referencedFiles.map(function(ref) {
      return ref.fileName;
    });

    typings = _.filter(referencedPaths, function(ref) {
      return isTypings(ref);
    });

    files = _.filter(referencedPaths, function(ref) {
      return ! isTypings(ref);
    });
  }

  return {
    files: files,
    modules: modules,
    typings: typings
  };
}

function createDiagnostics(tsSyntactic, tsSemantic) {
  // Parse diagnostics to leave only info we need.
  var syntactic = flattenDiagnostics(tsSyntactic);
  var semantic = flattenDiagnostics(tsSemantic);
  return {
    syntacticErrors: syntactic,
    semanticErrors: semantic
  };
}

function TsDiagnostics(diagnostics) {
  assert.ok(this instanceof TsDiagnostics);
  assert.ok(diagnostics);
  assertProps(diagnostics, [
    'syntacticErrors', 'semanticErrors'
  ]);

  _.extend(this, diagnostics);
}

var TDP = TsDiagnostics.prototype;

TDP.hasErrors = function() {
  return !! this.semanticErrors.length ||
    !! this.syntacticErrors.length;
}

TDP.hasUnresolvedModules = function() {
  var index = _.findIndex(this.semanticErrors, function(msg) {
    return msg.code === ts.Diagnostics.Cannot_find_module_0.code;
  });
  return index !== -1;
};

function flattenDiagnostics(tsDiagnostics) {
  var diagnostics = [];

  var dLen = tsDiagnostics.length;
  for (var i = 0; i < dLen; i++) {
    var diagnostic = tsDiagnostics[i];
    if (! diagnostic.file) continue;

    var pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    var line = pos.line + 1;
    var column = pos.character + 1;

    diagnostics.push({
      code: diagnostic.code,
      fileName: diagnostic.file.fileName,
      message: message,
      line: line,
      column: column
    });
  }

  return diagnostics;
}

function hasErrors(diagnostics) {
  if (! diagnostics) return true;

  return !! diagnostics.semanticErrors.length ||
    !! diagnostics.syntacticErrors.length;
}

function isSourceMap(fileName) {
  return ts.fileExtensionIs(fileName, '.map');
}

function isTypings(fileName) {
  return ts.fileExtensionIs(fileName, '.d.ts');
}

function getExcludeRegExp(exclude) {
  if (! exclude) return exclude;

  return ts.getRegularExpressionForWildcard(exclude, "", "exclude");
}

exports.ts = {
  TsDiagnostics,
  normalizePath,
  prepareSourceMap,
  getReferences,
  createDiagnostics,
  hasErrors,
  flattenDiagnostics,
  isSourceMap,
  isTypings,
  getExcludeRegExp
};

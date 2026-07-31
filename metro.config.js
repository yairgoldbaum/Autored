const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// El SDK de Anthropic (@anthropic-ai/sdk) referencia módulos estándar de Node
// (node:fs, node:path, node:crypto, ...) en rutas de código que solo corren en
// Node.js (carga de credenciales desde disco / Workload Identity Federation).
// En la app nunca se ejecutan porque el cliente se crea con apiKey explícita,
// pero Metro resuelve los imports estáticamente y rompe el bundle. Los
// resolvemos como módulos vacíos para React Native.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('node:')) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

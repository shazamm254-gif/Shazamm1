'use strict';
/**
 * AI layer entry point. Registers every provider once, at require time, so the
 * rest of the app only ever talks to the AIProvider abstraction.
 */

const AIProvider = require('./AIProvider');

AIProvider.register(require('./providers/local'));
AIProvider.register(require('./providers/anthropic'));
AIProvider.register(require('./providers/openai'));

const autoEdit = require('./autoEdit');
const presets = require('./presets');

module.exports = { AIProvider, ...autoEdit, presets };

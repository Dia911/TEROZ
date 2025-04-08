import ChatCore from '../core/app.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

class NexusEngine {
  constructor(config = {}) {
    this._validateConfig(config);
    this.core = new ChatCore(config.coreOptions || {});
    this.sessionState = new Map();
    this.context = new Map();
    this.plugins = [];
    this.config = {
      sessionTimeout: config.sessionTimeout || 1800,
      contextTTL: config.contextTTL || 300,
      maxHistory: config.maxHistory || 50,
      ...config
    };
    this._cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  async handleUserSession(userId, message, platformData = {}) {
    try {
      const requestId = uuidv4();
      logger.info(`[${requestId}] Start handling session for ${userId}`);

      const processedData = await this._runPlugins('pre-process', {
        userId,
        message,
        platformData,
        requestId
      });

      const session = this._getOrCreateSession(userId);

      if (this._isSpecialCommand(message)) {
        return this._handleSpecialCommand(userId, message, session, requestId);
      }

      const response = await this._processByFlow(session, userId, message, requestId);

      const finalResponse = await this._runPlugins('post-process', {
        userId,
        message,
        response,
        sessionState: this._cloneSession(session),
        requestId
      });

      logger.info(`[${requestId}] Successfully handled session`);
      return finalResponse;

    } catch (error) {
      logger.error(`Engine error: ${error.message}`, {
        userId,
        error: error.stack,
        message
      });

      return this.getErrorMessage('system_error', {
        errorId: uuidv4().slice(0, 8),
        originalMessage: message
      });
    }
  }

  registerPlugin(plugin) {
    try {
      if (!plugin || typeof plugin !== 'object') {
        throw new Error('Plugin must be an object');
      }

      const requiredMethods = ['name', 'execute', 'hooks'];
      const missingMethods = requiredMethods.filter(m => !(m in plugin));

      if (missingMethods.length > 0) {
        throw new Error(`Missing required plugin methods: ${missingMethods.join(', ')}`);
      }

      if (!Array.isArray(plugin.hooks)) {
        throw new Error('Plugin hooks must be an array');
      }

      this.plugins.push(plugin);
      logger.info(`Registered plugin: ${plugin.name}`);

    } catch (error) {
      logger.error(`Failed to register plugin: ${error.message}`);
    }
  }

  setContext(key, value, options = {}) {
    const ttl = options.ttl || this.config.contextTTL;
    const namespace = options.namespace || 'global';

    const contextKey = `${namespace}:${key}`;
    this.context.set(contextKey, {
      value,
      expiresAt: Date.now() + (ttl * 1000),
      namespace
    });
  }

  getContext(key, namespace = 'global') {
    const contextKey = `${namespace}:${key}`;
    const item = this.context.get(contextKey);

    if (item && item.expiresAt > Date.now()) {
      return item.value;
    }

    this.context.delete(contextKey);
    return null;
  }

  _validateConfig(config) {
    const validKeys = ['sessionTimeout', 'contextTTL', 'maxHistory', 'coreOptions'];
    const invalidKeys = Object.keys(config).filter(k => !validKeys.includes(k));

    if (invalidKeys.length > 0) {
      logger.warn(`Invalid config keys: ${invalidKeys.join(', ')}`);
    }
  }

  async _runPlugins(hookType, data) {
    let result = data;

    try {
      for (const plugin of this.plugins) {
        if (plugin.hooks.includes(hookType)) {
          const startTime = Date.now();
          result = await plugin.execute(hookType, result);
          logger.debug(`Plugin ${plugin.name} executed in ${Date.now() - startTime}ms`);
        }
      }
    } catch (error) {
      logger.error(`Plugin error in ${hookType} hook: ${error.message}`);
    }

    return result;
  }

  _getOrCreateSession(userId) {
    if (!this.sessionState.has(userId)) {
      this.sessionState.set(userId, {
        id: uuidv4(),
        step: 'init',
        history: [],
        createdAt: Date.now(),
        lastActive: Date.now(),
        data: {}
      });
    }

    const session = this.sessionState.get(userId);
    session.lastActive = Date.now();
    return session;
  }

  _cloneSession(session) {
    return JSON.parse(JSON.stringify(session));
  }

  _cleanup() {
    const now = Date.now();
    const timeout = this.config.sessionTimeout * 1000;

    for (const [userId, session] of this.sessionState) {
      if (now - session.lastActive > timeout) {
        this.sessionState.delete(userId);
        logger.info(`Cleaned up inactive session for ${userId}`);
      }
    }

    for (const [key, item] of this.context) {
      if (now > item.expiresAt) {
        this.context.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.sessionState.clear();
    this.context.clear();
    this.plugins = [];
    logger.info('NexusEngine destroyed');
  }

  // Dummy methods to avoid reference errors if they are used elsewhere
  _isSpecialCommand() {
    return false;
  }

  _handleSpecialCommand() {
    return null;
  }

  _processByFlow() {
    return null;
  }

  getErrorMessage(code, data) {
    return {
      code,
      message: 'An error occurred.',
      data
    };
  }
}

export default NexusEngine;
